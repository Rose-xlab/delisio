// src/controllers/webhookControllers.ts
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorMiddleware';
import {
  getUserSubscription,
  createFreeSubscription, // To ensure a subscription record exists
  resetUsageCounter, // RENAMED from resetUsageCountersForNewPeriod
} from '../services/subscriptionService';
import { SubscriptionTier, SubscriptionStatus } from '../models/Subscription';

interface RevenueCatEventPayload {
  api_version: string;
  event: {
    id: string;
    type: string;
    app_user_id: string;
    original_app_user_id: string; // Important for transfers/aliases
    aliases?: string[];
    product_id?: string;
    entitlement_ids?: string[] | null;
    period_type?: string;
    purchased_at_ms?: number;
    original_purchased_at_ms?: number;
    grace_period_expires_at_ms?: number | null;
    expiration_at_ms?: number | null;
    store?: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'MAC_APP_STORE' | 'AMAZON' | 'PROMOTIONAL';
    is_sandbox?: boolean;
    event_timestamp_ms: number;
    presented_offering_id?: string | null;
    price_in_purchased_currency?: number;
    currency?: string | null;
    unsubscribe_detected_at_ms?: number | null;
    billing_issues_detected_at_ms?: number | null;
  };
}

const mapRevenueCatEntitlementsToTier = (entitlementIds?: string[] | null): SubscriptionTier => {
  if (!entitlementIds || entitlementIds.length === 0) {
    return 'free';
  }
  // IMPORTANT: Replace 'TestPro' with your actual "pro" (premium) entitlement ID from RevenueCat
  if (entitlementIds.includes('TestPro')) {
    return 'premium';
  }
  // Add other mappings if you have more tiers, e.g., 'basic'
  // if (entitlementIds.includes('your_basic_rc_entitlement_id')) {
  //   return 'basic';
  // }
  return 'free';
};

export const handleRevenueCatWebhook = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const revenueCatWebhookKey = process.env.REVENUECAT_WEBHOOK_KEY; // Use REVENUECAT_WEBHOOK_KEY

  if (!revenueCatWebhookKey) {
    logger.error('REVENUECAT_WEBHOOK_KEY is not configured on the server.');
    return res.status(500).send('Webhook error: Server misconfiguration.');
  }
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('RevenueCat webhook: Missing or malformed Authorization header.');
    return res.status(401).send('Webhook error: Authorization header missing or malformed.');
  }
  const token = authHeader.substring(7);
  if (token !== revenueCatWebhookKey) {
    logger.error('RevenueCat webhook: Invalid Authorization token (key mismatch).');
    return res.status(403).send('Webhook error: Invalid token.');
  }

  const rcEventPayload = req.body as RevenueCatEventPayload;
  const event = rcEventPayload.event;

  if (!event || !event.app_user_id || !event.type) {
    logger.error('RevenueCat webhook: Invalid payload structure.', { body: req.body });
    return res.status(400).send('Webhook error: Invalid payload.');
  }

  logger.info(`Processing RevenueCat event type: ${event.type} for app_user_id: ${event.app_user_id}`);

  try {
    const appUserId = event.app_user_id;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id') // This 'id' is your internal auth.users.id
      .eq('user_app_id', appUserId)
      .single();

    if (profileError || !profile) {
      logger.error(`RC Webhook: Profile not found for app_user_id ${appUserId}. Error: ${profileError?.message}. Event: ${event.type}`);
      return res.status(404).send(`User profile not found for app_user_id: ${appUserId}.`);
    }
    const internalUserId = profile.id;

    let newTier: SubscriptionTier = 'free';
    let newStatus: SubscriptionStatus = 'active';
    let periodStart: Date;
    let periodEnd: Date;
    let cancelAtPeriodEnd = false;
    let needsUsageReset = false;

    const existingSubscription = await getUserSubscription(internalUserId);
    periodStart = existingSubscription?.currentPeriodStart || new Date(event.event_timestamp_ms); // Default to event time if no sub
    periodEnd = existingSubscription?.currentPeriodEnd || new Date(new Date(event.event_timestamp_ms).setMonth(new Date(event.event_timestamp_ms).getMonth() + 1)); // Default to 1 month from event
    cancelAtPeriodEnd = existingSubscription?.cancelAtPeriodEnd || false;


    newTier = mapRevenueCatEntitlementsToTier(event.entitlement_ids);

    switch (event.type) {
      case 'TEST':
        logger.info(`RC Webhook: Received TEST event for ${appUserId}.`);
        return res.status(200).send('Test event received and acknowledged.');

      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        newStatus = 'active';
        cancelAtPeriodEnd = false;
        needsUsageReset = true;
        // Prefer event dates if they signify the new period accurately
        periodStart = event.purchased_at_ms ? new Date(event.purchased_at_ms) : periodStart; // For initial, purchased_at_ms is good. For renewal, this might be old.
                                                                                            // expiration_at_ms of previous period is start of new one for renewal.
                                                                                            // Let's assume CustomerInfo in RC is the source of truth for actual period dates after an event.
                                                                                            // The event often gives the expiration_at_ms of the *new* period.
        if (event.expiration_at_ms) periodEnd = new Date(event.expiration_at_ms);
        // For renewals, period_start should ideally be the old period_end.
        // If this event is a renewal, the `purchased_at_ms` is for the original purchase, not the renewal start.
        // The `event_timestamp_ms` might be closer to the renewal time.
        // Or, for true accuracy of period start on renewal, you might need to fetch CustomerInfo from RC API
        // if event payload is not sufficient. For simplicity here, we'll use event_timestamp_ms for renewal start if no purchased_at_ms
        if (event.type === 'RENEWAL') {
            periodStart = existingSubscription?.currentPeriodEnd || new Date(event.event_timestamp_ms); // Old end is new start
        }
        logger.info(`RC Event ${event.type}: User ${internalUserId} to tier ${newTier}, status ${newStatus}. Usage reset for period ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);
        break;

      case 'PRODUCT_CHANGE':
        newStatus = 'active';
        cancelAtPeriodEnd = false;
        needsUsageReset = true;
        if (event.purchased_at_ms) periodStart = new Date(event.purchased_at_ms);
        if (event.expiration_at_ms) periodEnd = new Date(event.expiration_at_ms);
        logger.info(`RC Event ${event.type}: User ${internalUserId} changed to tier ${newTier}. Usage reset for period ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);
        break;

      case 'CANCELLATION':
        newStatus = existingSubscription?.status || 'active'; // Usually status remains active
        cancelAtPeriodEnd = true;
        logger.info(`RC Event ${event.type}: User ${internalUserId} tier ${newTier} subscription set to cancel at period end.`);
        break;

      case 'EXPIRATION':
        newStatus = 'canceled';
        newTier = 'free';
        cancelAtPeriodEnd = true;
        needsUsageReset = true;
        periodStart = new Date(event.event_timestamp_ms); // Free period starts now
        periodEnd = new Date(new Date(event.event_timestamp_ms).setMonth(new Date(event.event_timestamp_ms).getMonth() + 1));
        logger.info(`RC Event ${event.type}: User ${internalUserId} subscription expired. Downgraded to free. Usage reset for new free period ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);
        break;
      
      case 'BILLING_ISSUE':
        newStatus = 'past_due';
        logger.info(`RC Event ${event.type}: User ${internalUserId} has billing issue. Status set to ${newStatus}.`);
        break;
      
      case 'SUBSCRIBER_ALIAS':
        const originalAppUserId = event.original_app_user_id;
        const newAppUserId = appUserId;
        logger.info(`RC Event ${event.type}: Alias event. Original App User ID: ${originalAppUserId}, New App User ID: ${newAppUserId}. Manual data migration might be needed in DB if you allow account merging that changes your internal user ID based on RC app_user_id.`);
        // Typically, you'd merge data from old internal user to new internal user if this implies an account merge.
        // For now, just logging.
        break;

      default:
        logger.info(`RC Webhook: Unhandled event type: ${event.type} for app_user_id ${appUserId}.`);
        return res.status(200).send(`Webhook received (event type ${event.type} acknowledged).`);
    }

    // Upsert subscription details
    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert(
        {
          user_id: internalUserId,
          tier: newTier,
          status: newStatus,
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: cancelAtPeriodEnd,
          updated_at: new Date().toISOString(),
          // Ensure stripe_customer_id and stripe_subscription_id are handled if you mix Stripe and RC,
          // or set to null if purely RC for IAPs.
          // stripe_customer_id: existingSubscription?.stripeCustomerId || null, 
          // stripe_subscription_id: existingSubscription?.stripeSubscriptionId|| null,
        },
        { onConflict: 'user_id' }
      ).select().single(); // Select to confirm

    if (upsertError) {
      logger.error(`RC Webhook: Failed to upsert subscription for user_id ${internalUserId} (app_user_id ${appUserId}). Error: ${upsertError.message}`);
      return next(new AppError(`Failed to update subscription for user ${internalUserId} from webhook`, 500));
    }

    logger.info(`RC Webhook: Subscription record upserted for user_id ${internalUserId} to tier ${newTier}, status ${newStatus}.`);

    if (needsUsageReset) {
      // Use the periodStart and periodEnd determined for the current event
      await resetUsageCounter(internalUserId, periodStart, periodEnd); // Using the renamed function
    }

    res.status(200).send('RevenueCat webhook processed successfully.');

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Critical error processing RevenueCat webhook:', { 
        error: errorMsg, 
        eventType: req.body?.event?.type, 
        appUserId: req.body?.event?.app_user_id,
        stack: error instanceof Error ? error.stack : undefined
    });
    if (!res.headersSent) {
      res.status(500).send('Internal server error processing webhook.');
    }
  }
};