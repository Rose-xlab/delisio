// src/services/subscriptionService.ts
import { stripe, STRIPE_PLANS, isStripeConfigured } from '../config/stripe';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import {
  Subscription,
  SubscriptionTier,
  SubscriptionStatus,
  SubscriptionLimits,
  SUBSCRIPTION_LIMITS,
  SubscriptionResponse
} from '../models/Subscription';

/**
 * Get user's subscription from database
 */
export const getUserSubscription = async (userId: string): Promise<Subscription | null> => {
  try {
    // Get subscription from Supabase
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Important: Check for error *unless* it's the 'Row not found' error (PGRST116)
    // which is expected if the user has no subscription yet.
    if (error && error.code !== 'PGRST116') {
      logger.error('Error getting user subscription:', error);
      return null;
    }

    if (!data) {
      // No subscription found (or PGRST116 error occurred), create a free tier subscription
      logger.info(`No subscription found for user ${userId} or lookup returned no rows. Creating free tier.`);
      return await createFreeSubscription(userId);
    }

    // Convert to Subscription object
    return {
      id: data.id,
      userId: data.user_id,
      // FIX: Convert null from DB to undefined expected by Subscription model
      stripeCustomerId: data.stripe_customer_id ?? undefined,
      stripeSubscriptionId: data.stripe_subscription_id ?? undefined,
      // FIX: Assert string from DB to specific SubscriptionTier/Status types
      tier: data.tier as SubscriptionTier,
      status: data.status as SubscriptionStatus,
      currentPeriodStart: new Date(data.current_period_start),
      currentPeriodEnd: new Date(data.current_period_end),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      cancelAtPeriodEnd: data.cancel_at_period_end
    };
  } catch (error) {
    logger.error('Unexpected error in getUserSubscription:', error);
    return null;
  }
};

/**
 * Create a free subscription for a new user
 */
export const createFreeSubscription = async (userId: string): Promise<Subscription | null> => {
  try {
    const now = new Date();
    // Calculate period end (e.g., one month from now)
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

    // Define the data to insert using the specific types where possible
    const subscriptionDataToInsert = {
      user_id: userId,
      tier: 'free' as SubscriptionTier, // Assert here or ensure the initial object uses the correct type
      status: 'active' as SubscriptionStatus, // Assert here or ensure the initial object uses the correct type
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false
      // stripe_customer_id and stripe_subscription_id are omitted, will be null/default in DB
    };

    const { data, error } = await supabase
      .from('subscriptions')
      .insert(subscriptionDataToInsert)
      .select() // Select the inserted row
      .single(); // Expect a single row back

    if (error) {
      logger.error('Error creating free subscription in DB:', error);
      return null;
    }

    // Initialize usage tracking for the new subscription period
    const { error: usageError } = await supabase
      .from('recipe_usage')
      .insert({
        user_id: userId,
        count: 0,
        period_start: subscriptionDataToInsert.current_period_start,
        period_end: subscriptionDataToInsert.current_period_end
      });

     if (usageError) {
       // Log the error but potentially continue, as the subscription itself was created.
       // Depending on requirements, you might want to handle this more strictly.
       logger.error('Error initializing recipe usage for new free subscription:', usageError);
     }

    // Return the newly created subscription, mapped to the Subscription model
    return {
      id: data.id,
      userId: data.user_id,
      // FIX: Convert null from DB to undefined expected by Subscription model (though unlikely for new free tier)
      stripeCustomerId: data.stripe_customer_id ?? undefined,
      stripeSubscriptionId: data.stripe_subscription_id ?? undefined,
      // FIX: Assert string from DB to specific SubscriptionTier/Status types
      tier: data.tier as SubscriptionTier,
      status: data.status as SubscriptionStatus,
      currentPeriodStart: new Date(data.current_period_start),
      currentPeriodEnd: new Date(data.current_period_end),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      cancelAtPeriodEnd: data.cancel_at_period_end
    };
  } catch (error) {
    logger.error('Unexpected error in createFreeSubscription:', error);
    return null;
  }
};

/**
 * Get user's current recipe generation usage
 */
export const getUserRecipeUsage = async (userId: string, periodStart: Date): Promise<number> => {
  try {
    // Calculate an approximate end for the query range based on the start date
    // Adding 31 days covers most month lengths safely for a >= start, < end query.
    // Ensure the periodEnd is handled correctly based on your exact logic (e.g., using subscription.currentPeriodEnd)
    const periodEndQueryLimit = new Date(periodStart.getTime() + 31 * 24 * 60 * 60 * 1000);

    // Get usage for current billing period
    const { data, error } = await supabase
      .from('recipe_usage')
      .select('count')
      .eq('user_id', userId)
      // Select the record whose period_start matches the subscription's current period start
      .eq('period_start', periodStart.toISOString())
      // The lt check might be redundant if period_start is the primary key part, but added for robustness based on original code
      // .lt('period_end', periodEndQueryLimit.toISOString())
      .single(); // Assuming one usage record per user per period_start

    if (error && error.code !== 'PGRST116') { // Ignore 'Row not found'
      logger.error('Error getting user recipe usage:', error);
      return 0; // Return 0 on error
    }

    // If data is null (no record found, PGRST116), return 0
    return data?.count || 0;
  } catch (error) {
    logger.error('Unexpected error in getUserRecipeUsage:', error);
    return 0;
  }
};

/**
 * Check if user has reached their recipe generation limit
 */
export const hasReachedRecipeLimit = async (userId: string): Promise<boolean> => {
  try {
    // Get user subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      logger.warn(`Could not retrieve subscription for user ${userId} in hasReachedRecipeLimit. Assuming limit reached.`);
      return true; // Default to limit reached if no subscription found/error occurs
    }

    // Premium has unlimited recipes
    if (subscription.tier === 'premium') {
      return false;
    }

    // Get limit based on tier
    const limits = SUBSCRIPTION_LIMITS[subscription.tier];
    if (!limits) {
        logger.error(`Could not find subscription limits for tier: ${subscription.tier}`);
        return true; // Default to limit reached if config is missing
    }

    // Check for Infinity explicitly
    if (limits.recipeGenerationsPerMonth === Infinity) {
        return false;
    }

    // Get current usage for the subscription's current period
    const usageCount = await getUserRecipeUsage(userId, subscription.currentPeriodStart);

    // Check if usage exceeds limit
    return usageCount >= limits.recipeGenerationsPerMonth;
  } catch (error) {
    logger.error('Error checking recipe limit:', error);
    return true; // Default to limit reached on error
  }
};

/**
 * Track recipe generation usage
 */
export const trackRecipeGeneration = async (userId: string): Promise<boolean> => {
  try {
    // Get current subscription to find the correct period start/end
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      logger.error(`Could not find subscription for user ${userId} to track recipe generation.`);
      return false;
    }

    // Update or create usage record using the RPC function
    // Assumes 'increment_recipe_usage' handles UPSERT logic based on user_id and period_start
    const { error } = await supabase.rpc('increment_recipe_usage', {
      p_user_id: userId,
      p_period_start: subscription.currentPeriodStart.toISOString(),
      p_period_end: subscription.currentPeriodEnd.toISOString()
    });

    if (error) {
      logger.error('Error tracking recipe generation via RPC:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Unexpected error in trackRecipeGeneration:', error);
    return false;
  }
};

/**
 * Create or retrieve a Stripe customer for a user
 */
export const getOrCreateStripeCustomer = async (userId: string): Promise<string | null> => {
  if (!isStripeConfigured()) {
    logger.error('Stripe is not configured. Cannot get/create Stripe customer.');
    return null;
  }

  try {
    // 1. Check if user's subscription record in our DB already has a customer ID
    // Ensure getUserSubscription handles the case where the user might not have a record yet
    // and potentially creates one. Or handle it here. Let's rely on getUserSubscription.
    const userSubscription = await getUserSubscription(userId);

    if (!userSubscription) {
        logger.error(`Failed to get or create initial subscription for user ${userId} in getOrCreateStripeCustomer.`);
        return null; // Cannot proceed without a subscription record
    }

    if (userSubscription.stripeCustomerId) {
      return userSubscription.stripeCustomerId;
    }

    // 2. FIX: Get user details from Supabase Auth, not a 'users' table
    const { data: { user }, error: authError } = await supabase.auth.getUser(); // Assumes user is authenticated

    if (authError || !user) {
      logger.error(`Error getting authenticated user data for ID ${userId}:`, authError);
      return null;
    }

    // Ensure email exists
    if (!user.email) {
        logger.error(`Authenticated user ${userId} has no email address.`);
        return null;
    }

    // Extract name - might be in metadata, fallback to email if needed
    // Adjust 'name'/'full_name' based on your actual user_metadata structure
    const userName = user.user_metadata?.name || user.user_metadata?.full_name || user.email;

    // 3. Create new customer in Stripe
    logger.info(`Creating Stripe customer for user ${userId}`);
    const customer = await stripe!.customers.create({
      email: user.email,
      name: userName,
      metadata: {
        // Link Stripe customer back to our internal userId
        userId: userId
      }
    });

    // 4. Update the user's subscription record in our database with the new customer ID
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ stripe_customer_id: customer.id })
      .eq('user_id', userId); // Match the user ID

    if (updateError) {
        logger.error(`Failed to update subscription for user ${userId} with Stripe customer ID ${customer.id}:`, updateError);
        // This is an inconsistency state: Stripe customer created, but DB link failed.
        // Depending on strategy, you might want to attempt a retry or log for manual fix.
        // Returning the ID allows checkout to proceed, but the DB is out of sync.
        // Consider returning null if DB sync is critical before proceeding.
        // For now, log error and return ID.
        return customer.id;
    }

    logger.info(`Successfully created Stripe customer ${customer.id} and linked to user ${userId}`);
    return customer.id;
  } catch (error) {
    // Catch potential errors from Stripe API calls or unexpected issues
    logger.error('Error creating or retrieving Stripe customer:', error);
    return null;
  }
};


/**
 * Create a checkout session for subscription
 */
export const createCheckoutSession = async (
  userId: string,
  priceTier: 'basic' | 'premium', // Only allow paid tiers for checkout
  successUrl: string,
  cancelUrl: string
): Promise<string | null> => {
  if (!isStripeConfigured()) {
    logger.error('Stripe is not configured');
    return null;
  }

  try {
    // Get or create customer
    const customerId = await getOrCreateStripeCustomer(userId);

    if (!customerId) {
      logger.error(`Could not get or create Stripe customer for user ${userId}. Cannot create checkout session.`);
      return null;
    }

    // Get price ID based on the requested tier
    const priceId = STRIPE_PLANS[priceTier.toUpperCase() as keyof typeof STRIPE_PLANS]; // Assumes STRIPE_PLANS uses uppercase keys 'BASIC', 'PREMIUM'
    if (!priceId) {
      logger.error(`Could not find Stripe Price ID for tier: ${priceTier}`);
      return null;
    }

    // Create checkout session
    const session = await stripe!.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      mode: 'subscription',
      success_url: successUrl, // Redirect URL on successful payment
      cancel_url: cancelUrl,   // Redirect URL if the user cancels
      metadata: {
        // Include userId in metadata to potentially use in webhooks
        userId: userId
      }
    });

    return session.url; // Return the URL the user should be redirected to
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    return null;
  }
};

/**
 * Create a customer portal session
 */
export const createCustomerPortalSession = async (
  userId: string,
  returnUrl: string
): Promise<string | null> => {
  if (!isStripeConfigured()) {
    logger.error('Stripe is not configured');
    return null;
  }

  try {
    // Get subscription to find the Stripe Customer ID
    const subscription = await getUserSubscription(userId);

    if (!subscription?.stripeCustomerId) {
      logger.error(`No Stripe customer ID found for user ${userId}. Cannot create portal session.`);
      // Maybe the user never subscribed to a paid plan? Or getOrCreateStripeCustomer failed previously.
      return null;
    }

    // Create portal session
    const session = await stripe!.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: returnUrl // URL to return to after managing subscription
    });

    return session.url; // URL for the customer portal
  } catch (error) {
    logger.error('Error creating customer portal session:', error);
    return null;
  }
};

/**
 * Cancel a subscription (sets cancel_at_period_end to true)
 */
export const cancelSubscription = async (userId: string): Promise<boolean> => {
  if (!isStripeConfigured()) {
    logger.error('Stripe is not configured');
    return false;
  }

  try {
    // Get subscription details
    const subscription = await getUserSubscription(userId);

    if (!subscription?.stripeSubscriptionId) {
      // User might be on free tier or subscription ID is missing
      logger.error(`No Stripe subscription ID found for user ${userId}. Cannot cancel via Stripe.`);
      // If it's a free tier, maybe just update DB? Or return false as no Stripe action is needed.
      // Let's assume cancellation is only for active Stripe subscriptions.
      return false;
    }

    // Cancel in Stripe (at period end)
    logger.info(`Requesting cancellation at period end for Stripe subscription ${subscription.stripeSubscriptionId}`);
    await stripe!.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update in our database
    const { error: dbError } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString() // Update timestamp
      })
      .eq('user_id', userId); // Use user_id to ensure we update the correct record

    if (dbError) {
        logger.error(`Stripe subscription ${subscription.stripeSubscriptionId} set to cancel, but DB update failed for user ${userId}:`, dbError);
        // Return true because Stripe action succeeded, but log the DB error.
        return true;
    }

    logger.info(`Subscription for user ${userId} marked to cancel at period end in DB.`);
    return true;
  } catch (error) {
    logger.error('Error canceling subscription:', error);
    return false;
  }
};

/**
 * Get user's subscription status with usage information
 */
export const getSubscriptionStatus = async (userId: string): Promise<SubscriptionResponse | null> => {
  try {
    // Get subscription
    const subscription = await getUserSubscription(userId);

    if (!subscription) {
      logger.warn(`Could not retrieve subscription for user ${userId} in getSubscriptionStatus.`);
      return null;
    }

    // Get limits for the user's tier
    const limits = SUBSCRIPTION_LIMITS[subscription.tier];
     if (!limits) {
        logger.error(`Could not find subscription limits for tier: ${subscription.tier}`);
        // Return partial data or null? Let's return null for consistency.
        return null;
    }


    // Get usage for the current period
    const usageCount = await getUserRecipeUsage(userId, subscription.currentPeriodStart);

    // Calculate remaining (handle Infinity for premium/unlimited)
    const isUnlimited = limits.recipeGenerationsPerMonth === Infinity;
    const limitValue = isUnlimited ? -1 : limits.recipeGenerationsPerMonth; // Use -1 to represent infinity for client
    const remaining = isUnlimited ? -1 : Math.max(0, limits.recipeGenerationsPerMonth - usageCount);

    // Construct response object matching SubscriptionResponse interface
    return {
      tier: subscription.tier,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      recipeGenerationsLimit: limitValue,
      recipeGenerationsUsed: usageCount,
      recipeGenerationsRemaining: remaining,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
    };
  } catch (error) {
    logger.error('Error getting subscription status:', error);
    return null;
  }
};

/**
 * Update subscription in database after webhook event (e.g., payment success, cancellation)
 * Note: This function should ideally fetch the associated userId from the subscription metadata or DB
 * if only the stripeSubscriptionId is available from the webhook event.
 */
export const updateSubscriptionFromStripe = async (
  stripeSubscriptionId: string,
  status: SubscriptionStatus, // Ensure webhook handler maps Stripe status correctly
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: boolean,
  tier: SubscriptionTier // Ensure webhook handler determines the correct tier from Price ID
): Promise<boolean> => {
  try {
    // Update the subscription record identified by the Stripe Subscription ID
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: status, // Already the correct specific type
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        cancel_at_period_end: cancelAtPeriodEnd,
        tier: tier, // Already the correct specific type
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', stripeSubscriptionId); // Match by Stripe ID

    if (error) {
      logger.error(`Error updating subscription from Stripe webhook (Stripe ID: ${stripeSubscriptionId}):`, error);
      return false;
    }

    // Consider if usage needs reset here based on status/period start change
    // If the period started anew, reset usage. We need userId for that.
    // Fetch userId based on stripeSubscriptionId if needed.
    // const { data: subData, error: fetchError } = await supabase.from('subscriptions').select('user_id').eq('stripe_subscription_id', stripeSubscriptionId).single();
    // if (subData?.user_id) { await resetUsageCounter(subData.user_id, currentPeriodStart, currentPeriodEnd); }

    logger.info(`Successfully updated subscription (Stripe ID: ${stripeSubscriptionId}) from webhook.`);
    return true;
  } catch (error) {
    logger.error('Unexpected error in updateSubscriptionFromStripe:', error);
    return false;
  }
};

/**
 * Reset usage counter for a new billing period (e.g., called by webhook or cron job)
 * Uses upsert to create or update the usage record for the given period.
 */
export const resetUsageCounter = async (userId: string, periodStart: Date, periodEnd: Date): Promise<boolean> => {
  try {
    // Upsert ensures that if a record for this user/period_start exists, it's updated (count reset to 0),
    // otherwise, a new record is created.
    // The ON CONFLICT clause needs to match your unique constraint in the DB (e.g., PRIMARY KEY(id) or UNIQUE(user_id, period_start))
    const { error } = await supabase
      .from('recipe_usage')
      .upsert({
        user_id: userId,
        count: 0, // Reset count
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString() // Update timestamp
        // created_at will be set automatically by DB on insert
        // id might be needed if it's not auto-generated or part of conflict target
      }, {
        // Specify the constraint name or columns for conflict resolution
        // Replace 'user_id_period_start_unique' with your actual constraint name if defined,
        // or use the column names directly.
        onConflict: 'user_id, period_start' // Assumes UNIQUE constraint on (user_id, period_start)
      });

    if (error) {
      logger.error(`Error resetting usage counter for user ${userId}, period ${periodStart.toISOString()}:`, error);
      return false;
    }

    logger.info(`Usage counter reset for user ${userId}, period starting ${periodStart.toISOString()}`);
    return true;
  } catch (error) {
    logger.error('Unexpected error in resetUsageCounter:', error);
    return false;
  }
};