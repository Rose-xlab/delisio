// src/controllers/webhookControllers.ts
import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe'; // Import the Stripe namespace for types
import { stripe, isStripeConfigured, STRIPE_PLANS } from '../config/stripe'; // Added STRIPE_PLANS assuming it's needed for mapping
import {
  updateSubscriptionFromStripe,
  resetUsageCounter,
  // getUserSubscription // This import seems unused in the provided webhook logic
} from '../services/subscriptionService';
// Removed AppError import as it seems unused here
// import { AppError } from '../middleware/errorMiddleware';
import { logger } from '../utils/logger';
import { supabase } from '../config/supabase';
import { SubscriptionTier, SubscriptionStatus } from '../models/Subscription';

// Define proper interfaces for Stripe objects to avoid type issues
interface StripeSubscriptionObject {
  id: string;
  status: string;
  customer: string;
  items?: {
    data?: Array<{
      price?: {
        id?: string;
      };
    }>;
  };
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
}

interface StripeInvoiceObject {
  id: string;
  subscription?: string;
  customer?: string;
}

interface StripeCustomerObject {
  deleted?: boolean;
  metadata?: {
    userId?: string;
  };
}

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction // next seems unused, consider removing if not needed by other middleware
): Promise<void> => {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      logger.error('Stripe webhook received but Stripe is not configured');
      res.status(503).json({ received: false, error: 'Payment system not configured' });
      return;
    }

    const signature = req.headers['stripe-signature'];

    if (!signature) {
      logger.error('Stripe webhook received without signature');
      res.status(400).json({ received: false, error: 'Webhook signature missing' });
      return;
    }

    // Stripe webhook secret should be in environment variables
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('Stripe webhook secret not configured');
      res.status(500).json({ received: false, error: 'Webhook secret not configured' });
      return;
    }

    // Raw body required for signature verification
    // Ensure middleware is configured: express.raw({ type: 'application/json' })
    // Use req.rawBody if available, otherwise req.body (ensure raw body middleware runs before this)
    const rawBody = (req as any).rawBody || req.body; // Adjust if your raw body middleware uses a different property name
    const event = stripe!.webhooks.constructEvent(rawBody, signature, webhookSecret);

    logger.info(`Received Stripe webhook: ${event.type}`);

    // Handle different event types using type-safe objects
    switch (event.type) {
      case 'customer.subscription.created':
        // Fix: Convert to unknown first, then to our custom type
        await handleSubscriptionCreated(event.data.object as unknown as StripeSubscriptionObject);
        break;

      case 'customer.subscription.updated':
        // Fix: Convert to unknown first, then to our custom type
        await handleSubscriptionUpdated(event.data.object as unknown as StripeSubscriptionObject);
        break;

      case 'customer.subscription.deleted':
        // Fix: Convert to unknown first, then to our custom type
        await handleSubscriptionDeleted(event.data.object as unknown as StripeSubscriptionObject);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as unknown as StripeInvoiceObject);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as unknown as StripeInvoiceObject);
        break;

      // Add other event types as needed

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }

    // Respond to Stripe that the webhook was received successfully
    res.status(200).json({ received: true });

  } catch (error: any) { // Catch specific errors if needed (e.g., StripeSignatureVerificationError)
    logger.error('Error handling Stripe webhook:', error);
    // Respond directly to Stripe with an error status
    // Avoid calling next(error) as Stripe expects a direct 2xx or 4xx/5xx response
    res.status(400).json({ received: false, error: `Webhook error: ${error.message || 'Unknown error'}` });
  }
};

/**
 * Handle subscription created event
 */
async function handleSubscriptionCreated(subscription: StripeSubscriptionObject): Promise<void> {
  try {
    // Get user ID from customer metadata
    const customerId = subscription.customer;
    const customer = await stripe!.customers.retrieve(customerId) as unknown as StripeCustomerObject;

    // Check for deleted customer
    if (customer.deleted) {
      logger.error('Customer deleted, cannot process subscription created:', customerId);
      return;
    }

    // Type-safe metadata access
    const userId = customer.metadata?.userId;

    if (!userId) {
      logger.error(`User ID not found in customer metadata for customer: ${customerId}, subscription: ${subscription.id}`);
      return;
    }

    // Get subscription details
    const stripeSubscriptionId = subscription.id;
    const status = mapStripeStatusToInternal(subscription.status);
    const currentPeriodStart = new Date(subscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;

    // Map subscription plan to tier (ensure items exist)
    const priceId = subscription.items?.data?.[0]?.price?.id;
    if (!priceId) {
        logger.error(`Price ID not found on subscription items for subscription: ${stripeSubscriptionId}`);
        return;
    }
    const tier = mapStripePriceToTier(priceId);

    logger.info(`Subscription created: ${stripeSubscriptionId} for user ${userId}, tier: ${tier}, status: ${status}`);

    // Update subscription in database (ensure record for userId exists, potentially created by getOrCreateStripeCustomer)
    // Using update assumes a record (e.g., free tier) was already created for the user.
    const { error: updateError } = await supabase.from('subscriptions').update({
      stripe_subscription_id: stripeSubscriptionId,
      tier,
      status,
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString()
    }).eq('user_id', userId); // Match on user_id

    if (updateError) {
        logger.error(`Failed to update subscription ${stripeSubscriptionId} in DB for user ${userId} on creation:`, updateError);
        // Decide how to handle this - webhook might retry, or log for manual check.
        return; // Stop processing if DB update fails
    }

    // Initialize usage tracking for the new period
    await resetUsageCounter(userId, currentPeriodStart, currentPeriodEnd);

  } catch (error) {
    logger.error(`Error handling 'customer.subscription.created' webhook for sub ID ${subscription?.id}:`, error);
    // Don't re-throw, allow Stripe to potentially retry if applicable based on response code.
  }
}

/**
 * Handle subscription updated event
 */
async function handleSubscriptionUpdated(subscription: StripeSubscriptionObject): Promise<void> {
  try {
    const stripeSubscriptionId = subscription.id;

    // Find the user ID associated with this subscription in our database
    // It's safer to look up by stripe_subscription_id which should be unique
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('user_id') // Select only the user_id
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single(); // Expect exactly one match

    if (subscriptionError || !subscriptionData?.user_id) {
      logger.error(`Subscription ${stripeSubscriptionId} not found in database or user_id missing during update. Error: ${subscriptionError?.message}`);
      return; // Cannot proceed without linking to our user
    }

    const userId = subscriptionData.user_id;

    // Get updated details
    const status = mapStripeStatusToInternal(subscription.status);
    const currentPeriodStart = new Date(subscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    const cancelAtPeriodEnd = subscription.cancel_at_period_end;

    // Map subscription plan to tier (ensure items exist)
    const priceId = subscription.items?.data?.[0]?.price?.id;
     if (!priceId) {
        logger.error(`Price ID not found on subscription items during update for subscription: ${stripeSubscriptionId}`);
        return; // Cannot determine tier
    }
    const tier = mapStripePriceToTier(priceId);

    logger.info(`Subscription updated event: ${stripeSubscriptionId} for user ${userId}, status: ${status}, tier: ${tier}, cancel_at_end: ${cancelAtPeriodEnd}`);

    // Update subscription in database using the dedicated service function
    const updateSuccess = await updateSubscriptionFromStripe(
      stripeSubscriptionId,
      status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      tier
    );

    if (!updateSuccess) {
      logger.error(`Failed to update subscription ${stripeSubscriptionId} in DB via service function during update event.`);
      // Decide handling - maybe raise alert?
    }

    // Optional: Reset usage if the period start date has changed significantly, indicating a renewal or plan change mid-cycle.
    // This might be better handled explicitly in 'invoice.payment_succeeded'.
    // Compare currentPeriodStart with previous period start if needed.

  } catch (error) {
    logger.error(`Error handling 'customer.subscription.updated' webhook for sub ID ${subscription?.id}:`, error);
  }
}

/**
 * Handle subscription deleted event (usually means cancellation is immediate or at end of trial without payment method)
 */
async function handleSubscriptionDeleted(subscription: StripeSubscriptionObject): Promise<void> {
  try {
    const stripeSubscriptionId = subscription.id;

    // Find the user ID associated with this subscription
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single();

    if (subscriptionError || !subscriptionData?.user_id) {
      logger.warn(`Subscription ${stripeSubscriptionId} not found in database during deletion webhook. May have already been handled or never fully created.`);
      return; // Can't proceed without user_id
    }

    const userId = subscriptionData.user_id;

    logger.info(`Subscription deleted event: ${stripeSubscriptionId} for user ${userId}. Downgrading to free.`);

    // Downgrade user to free tier in our database
    // Set status to 'canceled' or revert to 'free'/'active' depending on desired logic
    const now = new Date();
    // Set a nominal period for the free tier starting now
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    const { error: updateError } = await supabase.from('subscriptions').update({
      tier: 'free',
      status: 'canceled', // Or 'active' if free plan should be active immediately
      stripe_subscription_id: null, // Remove link to the deleted Stripe subscription
      current_period_start: now.toISOString(),
      current_period_end: nextMonth.toISOString(), // Set a new period for the free plan
      cancel_at_period_end: false, // Reset this flag
      updated_at: now.toISOString()
    }).eq('user_id', userId);

    if (updateError) {
        logger.error(`Failed to downgrade user ${userId} to free tier in DB after subscription ${stripeSubscriptionId} deletion:`, updateError);
        return;
    }

    // Reset usage counter for the new (free tier) period
    await resetUsageCounter(userId, now, nextMonth);

  } catch (error) {
    logger.error(`Error handling 'customer.subscription.deleted' webhook for sub ID ${subscription?.id}:`, error);
  }
}

/**
 * Handle payment succeeded event (typically indicates renewal)
 */
async function handlePaymentSucceeded(invoice: StripeInvoiceObject): Promise<void> {
  try {
    // Check if it's related to a subscription
    const stripeSubscriptionId = invoice.subscription;
    if (!stripeSubscriptionId) {
      logger.info(`Invoice ${invoice.id} payment succeeded, but not related to a subscription.`);
      return; // Ignore invoices not for subscriptions
    }

    // Find the user ID associated with this subscription
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single();

    if (subscriptionError || !subscriptionData?.user_id) {
      logger.error(`Subscription ${stripeSubscriptionId} (from invoice ${invoice.id}) not found in database during payment succeeded.`);
      return; // Cannot proceed
    }

    const userId = subscriptionData.user_id;

    logger.info(`Payment succeeded via invoice ${invoice.id} for subscription: ${stripeSubscriptionId}, user: ${userId}. Updating status and period.`);

    // Fetch the subscription details from Stripe to get the *new* period dates
    const stripeResponse = await stripe!.subscriptions.retrieve(stripeSubscriptionId);
    // Cast to our custom interface to avoid type issues
    const updatedSubscription = stripeResponse as unknown as StripeSubscriptionObject;

    const currentPeriodStart = new Date(updatedSubscription.current_period_start * 1000);
    const currentPeriodEnd = new Date(updatedSubscription.current_period_end * 1000);
    const status = mapStripeStatusToInternal(updatedSubscription.status); // Should usually be 'active' after payment

    // Update status to active and set the new period dates in our database
    const { error: updateError } = await supabase.from('subscriptions').update({
      status: status, // Update status just in case it wasn't active
      current_period_start: currentPeriodStart.toISOString(),
      current_period_end: currentPeriodEnd.toISOString(),
      updated_at: new Date().toISOString()
    }).eq('user_id', userId); // Match by user_id

    if (updateError) {
       logger.error(`Failed to update subscription period/status in DB for user ${userId} after successful payment for invoice ${invoice.id}:`, updateError);
       return; // Stop if DB update fails
    }

    // Reset usage counter for the new billing period that just started
    await resetUsageCounter(userId, currentPeriodStart, currentPeriodEnd);

  } catch (error) {
    logger.error(`Error handling 'invoice.payment_succeeded' webhook for invoice ID ${invoice?.id}:`, error);
  }
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(invoice: StripeInvoiceObject): Promise<void> {
  try {
    // Check if it's related to a subscription
    const stripeSubscriptionId = invoice.subscription;
    if (!stripeSubscriptionId) {
       logger.info(`Invoice ${invoice.id} payment failed, but not related to a subscription.`);
      return; // Ignore non-subscription invoices
    }

    // Find the user ID associated with this subscription
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .single();

    if (subscriptionError || !subscriptionData?.user_id) {
      logger.error(`Subscription ${stripeSubscriptionId} (from invoice ${invoice.id}) not found in database during payment failed.`);
      return; // Cannot proceed
    }

    const userId = subscriptionData.user_id;

    // Determine the correct status based on the subscription's status after failure
    // Stripe might set it to 'past_due' or 'unpaid'
    const stripeResponse = await stripe!.subscriptions.retrieve(stripeSubscriptionId);
    // Cast to our custom interface to avoid type issues
    const subscription = stripeResponse as unknown as StripeSubscriptionObject;
    const status = mapStripeStatusToInternal(subscription.status); // Use the actual status from Stripe

    logger.info(`Payment failed via invoice ${invoice.id} for subscription: ${stripeSubscriptionId}, user: ${userId}. Setting status to '${status}'.`);

    // Update status in our database (e.g., 'past_due', 'incomplete')
    const { error: updateError } = await supabase.from('subscriptions').update({
      status: status, // Use the mapped status
      updated_at: new Date().toISOString()
    }).eq('user_id', userId); // Match by user_id

    if (updateError) {
        logger.error(`Failed to update subscription status in DB for user ${userId} after failed payment for invoice ${invoice.id}:`, updateError);
    }

    // Optionally: Notify the user about the payment failure.

  } catch (error) {
    logger.error(`Error handling 'invoice.payment_failed' webhook for invoice ID ${invoice?.id}:`, error);
  }
}

/**
 * Map Stripe subscription status to internal status defined in models/Subscription.ts
 */
function mapStripeStatusToInternal(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'canceled': // Means terminated immediately or after period end based on cancel_at_period_end
      return 'canceled';
    case 'past_due':
      return 'past_due';
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'canceled'; // Or map to a specific 'expired' status if you have one
    case 'trialing':
      return 'trialing';
    case 'unpaid': // Often follows past_due if payment continues to fail
      return 'past_due'; // Or map to 'unpaid' if you add it to SubscriptionStatus
    default:
      logger.warn(`Unhandled Stripe subscription status encountered: ${stripeStatus}`);
      return 'incomplete'; // Default fallback
  }
}

/**
 * Map Stripe price ID to our internal subscription tier
 */
function mapStripePriceToTier(priceId: string): SubscriptionTier {
  // Retrieve plan IDs from config/env for flexibility
  const basicPriceId = process.env.STRIPE_BASIC_PRICE_ID || STRIPE_PLANS.BASIC; // Example using STRIPE_PLANS config
  const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID || STRIPE_PLANS.PREMIUM;

  switch (priceId) {
    case basicPriceId:
      return 'basic';
    case premiumPriceId:
      return 'premium';
    // Add other price IDs if needed (e.g., annual plans)
    default:
      logger.warn(`Unknown Stripe Price ID encountered: ${priceId}. Defaulting to 'free' tier.`);
      return 'free'; // Default to 'free' if price ID doesn't match known paid plans
  }
}