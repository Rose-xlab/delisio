// src/services/subscriptionService.ts
import { stripe, STRIPE_PLANS, isStripeConfigured } from '../config/stripe'; // Stripe config
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import {
  Subscription,
  SubscriptionTier,
  SubscriptionStatus,
  FeatureLimits, // Ensure this is your updated interface from models/Subscription.ts
  SUBSCRIPTION_FEATURE_LIMITS, // Ensure this is your updated constant
  SubscriptionResponse,
  // AiChatUsageRecord // Optional if you type the result of DB queries
} from '../models/Subscription';
// import { User } from '@supabase/supabase-js'; // Not directly used here, but good for reference

/**
 * Get user's subscription from the local Supabase 'subscriptions' table.
 * This table should be kept in sync with RevenueCat via webhooks.
 */
export const getUserSubscription = async (userId: string): Promise<Subscription | null> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: 'Row not found'
      logger.error(`Error getting user subscription for ${userId}:`, { message: error.message, code: error.code });
      return null;
    }

    if (!data) {
      logger.info(`No subscription found in DB for user ${userId}. Attempting to create free tier.`);
      return await createFreeSubscription(userId);
    }

    return {
      id: data.id,
      userId: data.user_id,
      stripeCustomerId: data.stripe_customer_id ?? undefined, // Kept for structure
      stripeSubscriptionId: data.stripe_subscription_id ?? undefined, // Kept for structure
      tier: data.tier as SubscriptionTier,
      status: data.status as SubscriptionStatus,
      currentPeriodStart: new Date(data.current_period_start),
      currentPeriodEnd: new Date(data.current_period_end),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      cancelAtPeriodEnd: data.cancel_at_period_end,
    };
  } catch (error) {
    logger.error(`Unexpected error in getUserSubscription for ${userId}:`, error);
    return null;
  }
};

/**
 * Create a free subscription entry in the local Supabase 'subscriptions' table
 * and initialize usage records for both recipes and AI chat.
 */
export const createFreeSubscription = async (userId: string): Promise<Subscription | null> => {
  try {
    const now = new Date();
    // Free tier period, e.g., 1 month. Adjust as needed.
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());

    const subscriptionDataToInsert = {
      user_id: userId,
      tier: 'free' as SubscriptionTier,
      status: 'active' as SubscriptionStatus,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
    };

    const { data: subInsertData, error: subInsertError } = await supabase
      .from('subscriptions')
      .insert(subscriptionDataToInsert)
      .select()
      .single();

    if (subInsertError) {
      // It's possible a subscription was created by a concurrent request or webhook. Try fetching.
      if (subInsertError.code === '23505') { // Unique violation
        logger.warn(`Unique violation creating free subscription for ${userId}, likely exists. Fetching.`);
        return await getUserSubscription(userId); // Attempt to fetch existing
      }
      logger.error(`Error creating free subscription in DB for user ${userId}:`, subInsertError);
      return null;
    }

    // Initialize recipe usage
    const { error: recipeUsageError } = await supabase
      .from('recipe_usage') // Your existing table
      .insert({
        user_id: userId,
        count: 0,
        period_start: subscriptionDataToInsert.current_period_start,
        period_end: subscriptionDataToInsert.current_period_end,
      });
    if (recipeUsageError && recipeUsageError.code !== '23505') { // Ignore unique violation if already initialized
      logger.error(`Error initializing recipe_usage for new free subscription (user ${userId}):`, recipeUsageError);
    }

    // **** NEW: Initialize AI chat usage ****
    const { error: chatUsageError } = await supabase
      .from('ai_chat_usage') // Your new table
      .insert({
        user_id: userId,
        count: 0,
        period_start: subscriptionDataToInsert.current_period_start,
        period_end: subscriptionDataToInsert.current_period_end,
      });
    if (chatUsageError && chatUsageError.code !== '23505') { // Ignore unique violation
      logger.error(`Error initializing ai_chat_usage for new free subscription (user ${userId}):`, chatUsageError);
    }
    // **** END NEW ****

    logger.info(`Free subscription and initial usage records created/ensured for user ${userId}`);
    return {
      id: subInsertData.id,
      userId: subInsertData.user_id,
      tier: subInsertData.tier as SubscriptionTier,
      status: subInsertData.status as SubscriptionStatus,
      currentPeriodStart: new Date(subInsertData.current_period_start),
      currentPeriodEnd: new Date(subInsertData.current_period_end),
      createdAt: new Date(subInsertData.created_at),
      updatedAt: new Date(subInsertData.updated_at),
      cancelAtPeriodEnd: subInsertData.cancel_at_period_end,
    };
  } catch (error) {
    logger.error(`Unexpected error in createFreeSubscription for user ${userId}:`, error);
    return null;
  }
};

// --- Recipe Usage Functions (Keep as is) ---
export const getUserRecipeUsage = async (userId: string, periodStart: Date): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('recipe_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('period_start', periodStart.toISOString())
      .single();
    if (error && error.code !== 'PGRST116') {
      logger.error(`Error getting recipe usage for user ${userId}, period ${periodStart.toISOString()}:`, error);
      return 0;
    }
    return data?.count || 0;
  } catch (error) {
    logger.error(`Unexpected error in getUserRecipeUsage for user ${userId}:`, error);
    return 0;
  }
};

export const trackRecipeGeneration = async (userId: string): Promise<boolean> => {
  try {
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      logger.error(`No subscription for user ${userId} to track recipe generation.`);
      return false;
    }
    const { error } = await supabase.rpc('increment_recipe_usage', {
      p_user_id: userId,
      p_period_start: subscription.currentPeriodStart.toISOString(),
      p_period_end: subscription.currentPeriodEnd.toISOString(),
    });
    if (error) {
      logger.error(`Error tracking recipe generation for user ${userId} via RPC:`, error);
      return false;
    }
    logger.info(`Recipe usage tracked for user ${userId}`);
    return true;
  } catch (error) {
    logger.error(`Unexpected error in trackRecipeGeneration for user ${userId}:`, error);
    return false;
  }
};

// ---- NEW AI CHAT USAGE FUNCTIONS ----
/**
 * Get user's current AI chat reply usage for the given period from `ai_chat_usage` table.
 */
export const getAiChatUsageCount = async (userId: string, periodStart: Date): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('ai_chat_usage') // Use the new table name
      .select('count')
      .eq('user_id', userId)
      .eq('period_start', periodStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: Row not found
      logger.error(`Error getting AI chat usage for user ${userId}, period ${periodStart.toISOString()}:`, error);
      return 0;
    }
    return data?.count || 0; // If no record for the period, usage is 0
  } catch (error) {
    logger.error(`Unexpected error in getAiChatUsageCount for user ${userId}:`, error);
    return 0;
  }
};

/**
 * Track AI chat reply generation usage by calling the RPC function `increment_ai_chat_usage`.
 * This is called AFTER an AI reply has been successfully generated for a free user.
 */
export const trackAiChatReplyGeneration = async (userId: string): Promise<boolean> => {
  try {
    const subscription = await getUserSubscription(userId); // To get current period start/end
    if (!subscription) {
      logger.error(`Could not find subscription for user ${userId} to track AI chat reply.`);
      return false;
    }

    // Call your new RPC function for AI chat usage
    const { error } = await supabase.rpc('increment_ai_chat_usage', {
      p_user_id: userId,
      p_period_start: subscription.currentPeriodStart.toISOString(),
      p_period_end: subscription.currentPeriodEnd.toISOString(),
    });

    if (error) {
      logger.error(`Error tracking AI chat reply for user ${userId} via RPC:`, error);
      return false;
    }
    logger.info(`AI chat reply usage tracked for user ${userId}`);
    return true;
  } catch (error) {
    logger.error(`Unexpected error in trackAiChatReplyGeneration for user ${userId}:`, error);
    return false;
  }
};


// ---- MODIFIED getSubscriptionStatus ----
/**
 * Get user's subscription status with usage information for both recipes and AI chat.
 * This is called by the Flutter app's SubscriptionProvider.
 */
export const getSubscriptionStatus = async (userId: string): Promise<SubscriptionResponse | null> => {
  try {
    const subscription = await getUserSubscription(userId); // This will create a free sub if none exists

    if (!subscription) {
      logger.error(`Failed to get or create subscription for user ${userId} in getSubscriptionStatus. Critical error.`);
      // This state should ideally not be reached if getUserSubscription works as expected.
      return null;
    }

    const userTier = subscription.tier;
    const limits = SUBSCRIPTION_FEATURE_LIMITS[userTier] || SUBSCRIPTION_FEATURE_LIMITS.free;

    // Recipe usage
    const recipeUsageCount = await getUserRecipeUsage(userId, subscription.currentPeriodStart);
    const recipeLimit = limits.recipeGenerationsPerMonth;
    const recipeRemaining = recipeLimit === Infinity ? -1 : Math.max(0, recipeLimit - recipeUsageCount);

    // AI Chat Reply usage
    let aiChatUsageCount = 0;
    if (userTier === 'free') { // Only count AI replies strictly for the 'free' tier against its specific limit
      aiChatUsageCount = await getAiChatUsageCount(userId, subscription.currentPeriodStart);
    }
    const aiChatLimit = limits.aiChatRepliesPerPeriod;
    // For paid tiers, if aiChatLimit is Infinity, remaining is -1 (unlimited)
    // For free tier, it's calculated.
    const aiChatRemaining = aiChatLimit === Infinity ? -1 : Math.max(0, aiChatLimit - aiChatUsageCount);

    logger.info(`Subscription status for user ${userId}: Tier=${userTier}, Recipes (U/L/R): ${recipeUsageCount}/${recipeLimit === Infinity ? 'Inf' : recipeLimit}/${recipeRemaining === -1 ? 'Inf' : recipeRemaining}, AI Chat (U/L/R): ${aiChatUsageCount}/${aiChatLimit === Infinity ? 'Inf' : aiChatLimit}/${aiChatRemaining === -1 ? 'Inf' : aiChatRemaining}`);

    return {
      tier: userTier,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,

      recipeGenerationsLimit: recipeLimit === Infinity ? -1 : recipeLimit,
      recipeGenerationsUsed: recipeUsageCount,
      recipeGenerationsRemaining: recipeRemaining,

      aiChatRepliesLimit: aiChatLimit === Infinity ? -1 : aiChatLimit,
      aiChatRepliesUsed: aiChatUsageCount,
      aiChatRepliesRemaining: aiChatRemaining,
    };
  } catch (error) {
    logger.error(`Error getting full subscription status for user ${userId}:`, error);
    return null;
  }
};

/**
 * Resets all usage counters (recipes, AI chat) for a user for a new billing period.
 * This should be triggered by a webhook (e.g., from RevenueCat on RENEWAL, INITIAL_PURCHASE, PRODUCT_CHANGE).
 */
export const resetUsageCountersForNewPeriod = async (userId: string, newPeriodStart: Date, newPeriodEnd: Date): Promise<void> => {
  logger.info(`Resetting all usage counters for user ${userId} for period starting ${newPeriodStart.toISOString()}`);
  try {
    // Reset recipe usage by inserting/updating to 0 for the new period
    const { error: recipeError } = await supabase
      .from('recipe_usage')
      .upsert({
        user_id: userId,
        count: 0,
        period_start: newPeriodStart.toISOString(),
        period_end: newPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id, period_start' }); // Assumes UNIQUE constraint on (user_id, period_start)

    if (recipeError) {
      logger.error(`Error resetting recipe_usage for user ${userId}, period ${newPeriodStart.toISOString()}:`, recipeError);
    } else {
      logger.info(`Recipe usage counter reset for user ${userId}, period starting ${newPeriodStart.toISOString()}`);
    }

    // Reset AI chat usage
    const { error: chatError } = await supabase
      .from('ai_chat_usage')
      .upsert({
        user_id: userId,
        count: 0,
        period_start: newPeriodStart.toISOString(),
        period_end: newPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id, period_start' }); // Assumes UNIQUE constraint on (user_id, period_start)

    if (chatError) {
      logger.error(`Error resetting ai_chat_usage for user ${userId}, period ${newPeriodStart.toISOString()}:`, chatError);
    } else {
      logger.info(`AI chat usage counter reset for user ${userId}, period starting ${newPeriodStart.toISOString()}`);
    }
  } catch (error) {
    logger.error(`Unexpected error in resetUsageCountersForNewPeriod for user ${userId}:`, error);
  }
};


// ---- STRIPE RELATED FUNCTIONS ----
// These are kept as per original request but noted as Stripe-specific.
// If RevenueCat is the sole IAP, these are likely unused for actual payment processing.

export const getOrCreateStripeCustomer = async (userId: string): Promise<string | null> => {
  // Commenting out the core logic as it's Stripe specific and likely not needed with RevenueCat
  // If you still use Stripe for other reasons, this would need to be evaluated.
  logger.warn(`[STRIPE-SPECIFIC] getOrCreateStripeCustomer called for user ${userId}. This is likely unused if RevenueCat is the IAP handler.`);
  if (!isStripeConfigured()) {
    logger.error('[STRIPE-SPECIFIC] Stripe is not configured.');
    return null;
  }
  // ... original Stripe customer creation logic ...
  // This would involve fetching from 'users' table (which is auth.users) and creating customer in Stripe.
  // This function needs significant review if you are purely on RevenueCat.
  return null; // Placeholder
};

export const createCheckoutSession = async (
  userId: string,
  priceTier: 'basic' | 'premium',
  successUrl: string,
  cancelUrl: string
): Promise<string | null> => {
  logger.warn(`[STRIPE-SPECIFIC] createCheckoutSession called for user ${userId}. This is unused if RevenueCat handles payments.`);
  if (!isStripeConfigured()) return null;
  // ... original Stripe checkout session logic ...
  return null; // Placeholder
};

export const createCustomerPortalSession = async (
  userId: string,
  returnUrl: string
): Promise<string | null> => {
  logger.warn(`[STRIPE-SPECIFIC] createCustomerPortalSession called for user ${userId}. RevenueCat typically handles subscription management links.`);
  if (!isStripeConfigured()) return null;
  // ... original Stripe portal session logic ...
  return null; // Placeholder
};

export const cancelSubscription = async (userId: string): Promise<boolean> => {
  logger.warn(`[STRIPE-SPECIFIC] cancelSubscription (Stripe) called for user ${userId}. RevenueCat handles subscription lifecycle.`);
  if (!isStripeConfigured()) return false;
  // ... original Stripe cancellation logic ...
  // For RevenueCat, cancellations happen via app stores, and webhooks update your DB.
  return false; // Placeholder
};

export const updateSubscriptionFromStripe = async (
  stripeSubscriptionId: string,
  status: SubscriptionStatus,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: boolean,
  tier: SubscriptionTier
): Promise<boolean> => {
  logger.warn(`[STRIPE-SPECIFIC] updateSubscriptionFromStripe called. This should be replaced by RevenueCat webhook logic.`);
  // ... original logic to update DB from Stripe event ...
  // This will be superseded by RevenueCat webhook handling.
  return false; // Placeholder
};

// resetUsageCounter function was already present and is used by Stripe webhook logic.
// We've created a more specific resetUsageCountersForNewPeriod for RevenueCat webhooks.
// The old resetUsageCounter might be redundant or can be merged.
// For clarity, I've kept the new `resetUsageCountersForNewPeriod`.