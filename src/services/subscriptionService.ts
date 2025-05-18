// src/services/subscriptionService.ts
import { stripe, STRIPE_PLANS, isStripeConfigured } from '../config/stripe';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import {
  Subscription,
  SubscriptionTier,
  SubscriptionStatus,
  FeatureLimits,
  SUBSCRIPTION_FEATURE_LIMITS,
  SubscriptionResponse,
} from '../models/Subscription';

export const getUserSubscription = async (userId: string): Promise<Subscription | null> => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
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
      stripeCustomerId: data.stripe_customer_id ?? undefined,
      stripeSubscriptionId: data.stripe_subscription_id ?? undefined,
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

export const createFreeSubscription = async (userId: string): Promise<Subscription | null> => {
  try {
    const now = new Date();
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
      if (subInsertError.code === '23505') {
        logger.warn(`Unique violation creating free subscription for ${userId}, likely exists. Fetching.`);
        return await getUserSubscription(userId);
      }
      logger.error(`Error creating free subscription in DB for user ${userId}:`, subInsertError);
      return null;
    }

    const currentPeriodStartISO = subInsertData.current_period_start ? new Date(subInsertData.current_period_start).toISOString() : now.toISOString();
    const currentPeriodEndISO = subInsertData.current_period_end ? new Date(subInsertData.current_period_end).toISOString() : periodEnd.toISOString();


    // Initialize recipe usage
    const { error: recipeUsageError } = await supabase
      .from('recipe_usage')
      .insert({
        user_id: userId,
        count: 0,
        period_start: currentPeriodStartISO,
        period_end: currentPeriodEndISO,
      });
    if (recipeUsageError && recipeUsageError.code !== '23505') {
      logger.error(`Error initializing recipe_usage for new free subscription (user ${userId}):`, recipeUsageError);
    }

    // Initialize AI chat usage
    const { error: chatUsageError } = await supabase
      .from('ai_chat_usage')
      .insert({
        user_id: userId,
        count: 0,
        period_start: currentPeriodStartISO,
        period_end: currentPeriodEndISO,
      });
    if (chatUsageError && chatUsageError.code !== '23505') {
      logger.error(`Error initializing ai_chat_usage for new free subscription (user ${userId}):`, chatUsageError);
    }

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

export const getAiChatUsageCount = async (userId: string, periodStart: Date): Promise<number> => {
  try {
    const { data, error } = await supabase
      .from('ai_chat_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('period_start', periodStart.toISOString())
      .single();
    if (error && error.code !== 'PGRST116') {
      logger.error(`Error getting AI chat usage for user ${userId}, period ${periodStart.toISOString()}:`, error);
      return 0;
    }
    return data?.count || 0;
  } catch (error) {
    logger.error(`Unexpected error in getAiChatUsageCount for user ${userId}:`, error);
    return 0;
  }
};

export const trackAiChatReplyGeneration = async (userId: string): Promise<boolean> => {
  try {
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      logger.error(`Could not find subscription for user ${userId} to track AI chat reply.`);
      return false;
    }
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

export const getSubscriptionStatus = async (userId: string): Promise<SubscriptionResponse | null> => {
  try {
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      logger.error(`Failed to get or create subscription for user ${userId} in getSubscriptionStatus. Critical error.`);
      return null;
    }

    const userTier = subscription.tier;
    const limits = SUBSCRIPTION_FEATURE_LIMITS[userTier] || SUBSCRIPTION_FEATURE_LIMITS.free;

    const recipeUsageCount = await getUserRecipeUsage(userId, subscription.currentPeriodStart);
    const recipeLimit = limits.recipeGenerationsPerMonth;
    const recipeRemaining = recipeLimit === Infinity ? -1 : Math.max(0, recipeLimit - recipeUsageCount);

    let aiChatUsageCount = 0;
    if (userTier === 'free') {
      aiChatUsageCount = await getAiChatUsageCount(userId, subscription.currentPeriodStart);
    }
    const aiChatLimit = limits.aiChatRepliesPerPeriod;
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
 * This should be triggered by a webhook or an admin action.
 * Renamed from resetUsageCountersForNewPeriod to resetUsageCounter to match expected import.
 */
export const resetUsageCounter = async (userId: string, newPeriodStart: Date, newPeriodEnd: Date): Promise<void> => {
  logger.info(`Resetting all usage counters for user ${userId} for period starting ${newPeriodStart.toISOString()}`);
  try {
    // Reset recipe usage
    const { error: recipeError } = await supabase
      .from('recipe_usage')
      .upsert({
        user_id: userId,
        count: 0,
        period_start: newPeriodStart.toISOString(),
        period_end: newPeriodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id, period_start' });

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
      }, { onConflict: 'user_id, period_start' });

    if (chatError) {
      logger.error(`Error resetting ai_chat_usage for user ${userId}, period ${newPeriodStart.toISOString()}:`, chatError);
    } else {
      logger.info(`AI chat usage counter reset for user ${userId}, period starting ${newPeriodStart.toISOString()}`);
    }
  } catch (error) {
    logger.error(`Unexpected error in resetUsageCounter for user ${userId}:`, error);
  }
};

// ---- STRIPE RELATED FUNCTIONS ----
// Kept for structure as requested, but with warnings about RevenueCat usage.
export const getOrCreateStripeCustomer = async (userId: string): Promise<string | null> => {
  logger.warn(`[STRIPE-SPECIFIC] getOrCreateStripeCustomer called for user ${userId}. This is likely unused if RevenueCat is the IAP handler.`);
  if (!isStripeConfigured()) {
    logger.error('[STRIPE-SPECIFIC] Stripe is not configured.');
    return null;
  }
  // ... (Original Stripe logic would go here if it were still active for some purpose)
  // For now, assume it's not primary path with RevenueCat.
  const userSubscription = await getUserSubscription(userId); // Check if already have one from local DB
    if (userSubscription?.stripeCustomerId) {
        return userSubscription.stripeCustomerId;
    }
    // If you need to create one (e.g. for a direct Stripe product not via RC), implement user fetch & Stripe customer.create
  return null;
};

export const createCheckoutSession = async (
  userId: string,
  priceTier: 'basic' | 'premium',
  successUrl: string,
  cancelUrl: string
): Promise<string | null> => {
  logger.warn(`[STRIPE-SPECIFIC] createCheckoutSession called for user ${userId}. This is unused if RevenueCat handles payments.`);
  if (!isStripeConfigured()) return null;
  // ... (Original Stripe checkout session logic)
  return null;
};

export const createCustomerPortalSession = async (
  userId: string,
  returnUrl: string
): Promise<string | null> => {
  logger.warn(`[STRIPE-SPECIFIC] createCustomerPortalSession called for user ${userId}. RevenueCat typically handles subscription management links.`);
  if (!isStripeConfigured()) return null;
  // ... (Original Stripe portal session logic)
  return null;
};

export const cancelSubscription = async (userId: string): Promise<boolean> => {
  logger.warn(`[STRIPE-SPECIFIC] cancelSubscription (Stripe) called for user ${userId}. RevenueCat handles subscription lifecycle via app stores/webhooks.`);
  if (!isStripeConfigured()) return false;
  // ... (Original Stripe cancellation logic)
  return false;
};

export const updateSubscriptionFromStripe = async (
  stripeSubscriptionId: string,
  status: SubscriptionStatus,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: boolean,
  tier: SubscriptionTier
): Promise<boolean> => {
  logger.warn(`[STRIPE-SPECIFIC] updateSubscriptionFromStripe called. This should be replaced by RevenueCat webhook logic for IAP subscriptions.`);
  // ... (Original logic to update DB from Stripe event)
  // This will be superseded by RevenueCat webhook handling for subscriptions managed by RevenueCat.
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({
        status: status,
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        cancel_at_period_end: cancelAtPeriodEnd,
        tier: tier,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', stripeSubscriptionId);
    if (error) {
      logger.error(`[STRIPE-SPECIFIC] Error updating subscription from Stripe webhook (Stripe ID: ${stripeSubscriptionId}):`, error);
      return false;
    }
    return true;
  } catch(error) {
    logger.error(`[STRIPE-SPECIFIC] Unexpected error in updateSubscriptionFromStripe (Stripe ID: ${stripeSubscriptionId}):`, error);
    return false;
  }
};