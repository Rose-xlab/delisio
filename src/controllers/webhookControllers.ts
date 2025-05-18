// src/controllers/webhookControllers.ts
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorMiddleware'; // If you want to use AppError for internal errors
import { 
    getUserSubscription, // To fetch existing sub details if needed
    createFreeSubscription, // To ensure a user record exists or to revert to free
    resetUsageCountersForNewPeriod // Crucial for resetting limits on new period
} from '../services/subscriptionService';
import { SubscriptionTier, SubscriptionStatus } from '../models/Subscription';
import crypto from 'crypto'; // For webhook signature verification, though RevenueCat might use a simpler auth header.

// Define a simplified type for the expected RevenueCat event structure.
// Refer to RevenueCat's official documentation for the complete and accurate payload structure.
interface RevenueCatEventPayload {
  api_version: string;
  event: {
    id: string; // Event ID
    type: string; // e.g., INITIAL_PURCHASE, RENEWAL, CANCELLATION, PRODUCT_CHANGE, EXPIRATION, SUBSCRIBER_ALIAS, TEST
    app_user_id: string; // YOUR internal user ID, if you set it as App User ID in RevenueCat SDK
    original_app_user_id: string; // Original App User ID
    aliases?: string[];

    product_id?: string; // Store-specific product ID
    entitlement_ids?: string[] | null; // Array of active entitlement identifiers
    
    period_type?: string; // NORMAL, INTRO, TRIAL
    purchased_at_ms?: number;
    original_purchased_at_ms?: number;
    grace_period_expires_at_ms?: number | null;
    expiration_at_ms?: number | null; // When access expires
    store?: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'MAC_APP_STORE' | 'AMAZON' | 'PROMOTIONAL';
    is_sandbox?: boolean;
    
    // For transfers/aliases
    original_app_user_id_new?: string;

    // For renewals, period start/end might be important
    // RevenueCat docs suggest checking entitlement status rather than relying solely on event dates for access.
    // However, for resetting usage, period start/end from the event or current subscription is key.
    // These might not be directly in all events, sometimes you fetch current CustomerInfo.
    // For simplicity, we'll assume the webhook gives enough or we fetch current state.
    event_timestamp_ms: number;
    presented_offering_id?: string | null;
    price_in_purchased_currency?: number;
    currency?: string | null;

    // If it's a cancellation or expiration
    unsubscribe_detected_at_ms?: number | null;
    billing_issues_detected_at_ms?: number | null;
  };
}

// Helper to map RevenueCat entitlement IDs to your internal SubscriptionTier
// This needs to be customized based on YOUR RevenueCat entitlement identifiers.
const mapRevenueCatEntitlementsToTier = (entitlementIds?: string[] | null): SubscriptionTier => {
  if (!entitlementIds || entitlementIds.length === 0) {
    return 'free';
  }
  // Example: Your "Pro" plan in Flutter uses 'MyOfferings.pro' which is "TestPro"
  if (entitlementIds.includes('TestPro')) { // This should be your actual "pro" entitlement ID from RevenueCat
    return 'premium'; // Maps to your internal 'premium' tier
  }
  // Add other mappings if you have, e.g., a 'basic' tier entitlement from RevenueCat
  // if (entitlementIds.includes('your_basic_entitlement_id_in_rc')) {
  //   return 'basic';
  // }
  return 'free'; // Default if no recognized paid entitlements are active
};


export const handleRevenueCatWebhook = async (req: Request, res: Response, next: NextFunction) => {
  // 1. Verify Webhook Authorization/Signature (IMPORTANT)
  // RevenueCat sends an 'Authorization' header with a Bearer token (your webhook secret).
  const authHeader = req.headers.authorization;
  const revenueCatWebhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET; // Set this in your .env

  if (!revenueCatWebhookSecret) {
    logger.error('REVENUECAT_WEBHOOK_SECRET is not configured on the server.');
    return res.status(500).send('Webhook error: Server misconfiguration.');
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('RevenueCat webhook: Missing or malformed Authorization header.');
    return res.status(401).send('Webhook error: Authorization header missing or malformed.');
  }

  const token = authHeader.substring(7); // Remove "Bearer "
  if (token !== revenueCatWebhookSecret) {
    logger.error('RevenueCat webhook: Invalid Authorization token (secret mismatch).');
    return res.status(403).send('Webhook error: Invalid token.');
  }
  // --- Signature verification passed (using shared secret token) ---

  const rcEventPayload = req.body as RevenueCatEventPayload;
  const event = rcEventPayload.event;

  if (!event || !event.app_user_id || !event.type) {
    logger.error('RevenueCat webhook: Invalid payload structure.', { body: req.body });
    return res.status(400).send('Webhook error: Invalid payload.');
  }

  logger.info(`Processing RevenueCat event type: ${event.type} for app_user_id: ${event.app_user_id}`);

  try {
    const appUserId = event.app_user_id; // This is the ID you set in Flutter with Purchases.logIn()

    // Find your internal Supabase user_id from the app_user_id (stored in your 'profiles' table)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id') // This 'id' is your internal auth.users.id
      .eq('user_app_id', appUserId) // Match against the RevenueCat App User ID
      .single();

    if (profileError || !profile) {
      logger.error(`RevenueCat Webhook: Profile not found for app_user_id ${appUserId}. Error: ${profileError?.message}`);
      // This might happen if a webhook arrives before your profile record is created or synced.
      // Depending on the event, you might want to retry later or log for investigation.
      return res.status(404).send(`User profile not found for app_user_id: ${appUserId}. Webhook for event ${event.type} cannot be fully processed.`);
    }
    const internalUserId = profile.id;

    // Default values, to be updated based on event
    let newTier: SubscriptionTier = 'free';
    let newStatus: SubscriptionStatus = 'active';
    let periodStart: Date = new Date(); // Fallback
    let periodEnd: Date = new Date(new Date().setMonth(new Date().getMonth() + 1)); // Fallback
    let cancelAtPeriodEnd = false;
    let needsUsageReset = false;

    // Determine new tier based on the event's active entitlements
    newTier = mapRevenueCatEntitlementsToTier(event.entitlement_ids);

    // It's often more reliable to fetch current CustomerInfo from RevenueCat API here
    // to get the absolute latest dates and status, rather than just relying on event payload dates.
    // However, for simplicity, we'll use event dates if available or fetch existing sub.
    const existingSubscription = await getUserSubscription(internalUserId);

    if (event.purchased_at_ms) periodStart = new Date(event.purchased_at_ms);
    else if (existingSubscription) periodStart = existingSubscription.currentPeriodStart;

    if (event.expiration_at_ms) periodEnd = new Date(event.expiration_at_ms);
    else if (existingSubscription) periodEnd = existingSubscription.currentPeriodEnd;


    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        newStatus = 'active';
        cancelAtPeriodEnd = false;
        needsUsageReset = true; // New period starts, reset usage
        // Use period_start and period_end from RevenueCat if available in the event,
        // otherwise, you might need to fetch CustomerInfo for accurate dates.
        // For renewals, the period usually rolls over.
        logger.info(`RC Event ${event.type}: User ${internalUserId} to tier ${newTier}, status ${newStatus}. Usage reset.`);
        break;

      case 'PRODUCT_CHANGE': // e.g., upgrade/downgrade
        newStatus = 'active';
        cancelAtPeriodEnd = false;
        needsUsageReset = true; // Tier changed, reset usage for the new tier's period
        logger.info(`RC Event ${event.type}: User ${internalUserId} changed to tier ${newTier}, status ${newStatus}. Usage reset.`);
        break;

      case 'CANCELLATION': // User has indicated they want to cancel, but access might continue
        newStatus = existingSubscription?.status || 'active'; // Keep current status until expiration
        cancelAtPeriodEnd = true;
        logger.info(`RC Event ${event.type}: User ${internalUserId} tier ${newTier} subscription set to cancel at period end.`);
        break;

      case 'EXPIRATION': // Access has ended
        newStatus = 'canceled'; // Or 'expired'
        newTier = 'free'; // Revert to free tier
        cancelAtPeriodEnd = true; // Ensure this is set
        needsUsageReset = true; // Reset usage for the new "free" period that effectively starts now
        // For the new free period:
        periodStart = new Date();
        periodEnd = new Date(new Date().setMonth(new Date().getMonth() + 1));
        logger.info(`RC Event ${event.type}: User ${internalUserId} subscription expired. Downgraded to free. Usage reset for new free period.`);
        break;
      
      case 'BILLING_ISSUE':
        newStatus = 'past_due';
        logger.info(`RC Event ${event.type}: User ${internalUserId} has billing issue. Status set to past_due.`);
        break;

      // Other important events:
      // SUBSCRIBER_ALIAS: When app_user_ids are merged.
      // TEST: For test events from RevenueCat dashboard.
      default:
        logger.info(`RC Webhook: Received unhandled event type: ${event.type} for app_user_id ${appUserId}.`);
        return res.status(200).send(`Webhook received (event type ${event.type} acknowledged but not specifically handled).`);
    }

    // Update or insert into your `subscriptions` table
    const { data: upsertData, error: upsertError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: internalUserId, // This is the linking key
        tier: newTier,
        status: newStatus,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: cancelAtPeriodEnd,
        // revenuecat_app_user_id: appUserId, // Optional: if you want to store it here too
        updated_at: new Date().toISOString(),
        // If it's an insert (first time for this user_id in subscriptions table),
        // set created_at. Supabase upsert might handle this if column defaults are set.
        // Otherwise, you might need to fetch first, then update or insert.
        // For simplicity, upsert will update if user_id exists, or insert if not.
        // Ensure your subscriptions table has a UNIQUE constraint on user_id for upsert to work as expected
        // or handle insert/update logic more explicitly.
      }, { onConflict: 'user_id' }) // Assuming user_id is unique and you want to update if it exists
      .select()
      .single();

    if (upsertError) {
      logger.error(`RC Webhook: Failed to upsert subscription for user_id ${internalUserId} (app_user_id ${appUserId}). Error: ${upsertError.message}`);
      return next(new AppError(`Failed to update subscription for user ${internalUserId} from webhook`, 500));
    }

    logger.info(`RC Webhook: Subscription record upserted for user_id ${internalUserId} to tier ${newTier}, status ${newStatus}.`);

    if (needsUsageReset) {
      await resetUsageCountersForNewPeriod(internalUserId, periodStart, periodEnd);
    }

    res.status(200).send('RevenueCat webhook processed successfully.');

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('Error processing RevenueCat webhook:', { error: errorMsg, eventType: req.body?.event?.type, appUserId: req.body?.event?.app_user_id });
    // It's crucial to respond with 2xx to RevenueCat even if there's an internal error,
    // to prevent retries for already processed or unprocessable events, unless the error is transient.
    // However, for persistent errors, logging is key.
    if (!res.headersSent) {
      // A 500 might cause RevenueCat to retry. A 4xx might not. Check RC docs.
      // For critical processing errors, a 500 is appropriate to signal an issue.
      res.status(500).send('Internal server error processing webhook.');
    }
  }
};