// src/services/subscriptionService.ts
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import {
  Subscription,
  SubscriptionTier as ModelSubscriptionTier,
  SubscriptionStatus as ModelSubscriptionStatus,
  SUBSCRIPTION_FEATURE_LIMITS,
  SubscriptionResponse,
} from '../models/Subscription';
import { isStripeConfigured } from '../config/stripe';

export interface SubscriptionSyncParams {
  userId: string;
  tier: ModelSubscriptionTier;
  status: ModelSubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

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
      logger.info(`No subscription found in DB for user ${userId}. Attempting to create/ensure free tier.`);
      return await createFreeSubscription(userId);
    }

    // Correctly handle string | null from Supabase data for dates
    const currentPeriodStart = data.current_period_start ? new Date(data.current_period_start) : null;
    const currentPeriodEnd = data.current_period_end ? new Date(data.current_period_end) : null;

    return {
      id: data.id,
      userId: data.user_id,
      stripeCustomerId: data.stripe_customer_id ?? undefined,
      stripeSubscriptionId: data.stripe_subscription_id ?? undefined,
      tier: data.tier as ModelSubscriptionTier,
      status: data.status as ModelSubscriptionStatus,
      currentPeriodStart: currentPeriodStart, // Now Date | null
      currentPeriodEnd: currentPeriodEnd,     // Now Date | null
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
      tier: 'free' as ModelSubscriptionTier,
      status: 'active' as ModelSubscriptionStatus,
      current_period_start: now.toISOString(), // NOT NULL for new free sub
      current_period_end: periodEnd.toISOString(), // NOT NULL for new free sub
      cancel_at_period_end: false,
    };

    const { data: subInsertData, error: subInsertError } = await supabase
      .from('subscriptions')
      .insert(subscriptionDataToInsert)
      .select()
      .single();

    if (subInsertError) {
      if (subInsertError.code === '23505') {
        logger.warn(`createFreeSubscription: Unique violation for user ${userId}, subscription likely already exists. Fetching existing.`);
        return await getUserSubscription(userId);
      }
      logger.error(`Error creating free subscription in DB for user ${userId}:`, subInsertError);
      return null;
    }
    if (!subInsertData) {
        logger.error(`No data returned after inserting free subscription for ${userId}.`);
        return null;
    }
    
    const newPeriodStart = new Date(subInsertData.current_period_start!); // Should be non-null here
    const newPeriodEnd = new Date(subInsertData.current_period_end!);   // Should be non-null here

    await resetUsageCounter(userId, newPeriodStart, newPeriodEnd);

    logger.info(`Free subscription and initial usage records created/ensured for user ${userId}`);
    return { // Map to Subscription, ensuring dates are Date objects
      id: subInsertData.id, userId: subInsertData.user_id, tier: subInsertData.tier as ModelSubscriptionTier,
      status: subInsertData.status as ModelSubscriptionStatus, currentPeriodStart: newPeriodStart,
      currentPeriodEnd: newPeriodEnd, createdAt: new Date(subInsertData.created_at),
      updatedAt: new Date(subInsertData.updated_at), cancelAtPeriodEnd: subInsertData.cancel_at_period_end,
    };
  } catch (error) {
    logger.error(`Unexpected error in createFreeSubscription for user ${userId}:`, error);
    return null;
  }
};

export const resetUsageCounter = async (userId: string, newPeriodStart: Date | null, newPeriodEnd: Date | null): Promise<void> => {
  if (!newPeriodStart || !newPeriodEnd) {
    logger.warn(`resetUsageCounter: Cannot reset usage for user ${userId} due to null period start or end dates.`);
    return;
  }
  logger.info(`Resetting/Ensuring usage counters for user ${userId} for period ${newPeriodStart.toISOString()} to ${newPeriodEnd.toISOString()}`);
  try {
    const commonUsageData = {
      user_id: userId,
      count: 0,
      period_start: newPeriodStart.toISOString(),
      period_end: newPeriodEnd.toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error: recipeError } = await supabase.from('recipe_usage').upsert(commonUsageData, { onConflict: 'user_id, period_start' });
    if (recipeError) logger.error(`Error resetting/upserting recipe_usage for user ${userId}:`, recipeError);
    else logger.info(`Recipe usage counter reset/upserted for user ${userId}.`);

    const { error: chatError } = await supabase.from('ai_chat_usage').upsert(commonUsageData, { onConflict: 'user_id, period_start' });
    if (chatError) logger.error(`Error resetting/upserting ai_chat_usage for user ${userId}:`, chatError);
    else logger.info(`AI chat usage counter reset/upserted for user ${userId}.`);
  } catch (error) {
    logger.error(`Unexpected error in resetUsageCounter for user ${userId}:`, error);
  }
};

export const subscriptionSync = async (params: SubscriptionSyncParams): Promise<Subscription | null> => {
  const {
    userId, tier, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd,
  } = params;

  try {
    const subscriptionUpsertData = {
      user_id: userId,
      tier: tier,
      status: status,
      current_period_start: currentPeriodStart ? currentPeriodStart.toISOString() : null,
      current_period_end: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    };

    logger.info(`Service: Upserting subscription for user ${userId} with tier "${tier}", status "${status}", cancelAtEnd: ${cancelAtPeriodEnd}`, {
        start: subscriptionUpsertData.current_period_start,
        end: subscriptionUpsertData.current_period_end
    });

    const { data, error } = await supabase
      .from('subscriptions')
      .upsert(subscriptionUpsertData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      logger.error(`Error upserting subscription in service for user ${userId}:`, error);
      throw error;
    }
    if (!data) {
      logger.error(`No data returned after upserting subscription for user ${userId} in service.`);
      throw new Error('Subscription sync (service) failed to return data after upsert.');
    }
    
    logger.info(`Subscription successfully synced in DB for user ${userId}. DB ID: ${data.id}, Tier: ${data.tier}, Status: ${data.status}`);

    const dbPeriodStartDate = data.current_period_start ? new Date(data.current_period_start) : null;
    const dbPeriodEndDate = data.current_period_end ? new Date(data.current_period_end) : null;

    const isNewRecord = new Date(data.created_at).getTime() === new Date(data.updated_at).getTime();
    const periodJustStarted = currentPeriodStart && dbPeriodStartDate && (dbPeriodStartDate.getTime() === currentPeriodStart.getTime());

    if (isNewRecord || periodJustStarted) {
      if (dbPeriodStartDate && dbPeriodEndDate) {
        logger.info(`New subscription or new billing period detected for ${userId}. Resetting usage counters.`);
        await resetUsageCounter(userId, dbPeriodStartDate, dbPeriodEndDate);
      } else {
        logger.warn(`Not resetting usage counters for ${userId} due to null period dates in synced DB record. Start: ${data.current_period_start}, End: ${data.current_period_end}`);
      }
    }

    return {
      id: data.id, userId: data.user_id, stripeCustomerId: data.stripe_customer_id ?? undefined,
      stripeSubscriptionId: data.stripe_subscription_id ?? undefined, tier: data.tier as ModelSubscriptionTier,
      status: data.status as ModelSubscriptionStatus,
      currentPeriodStart: dbPeriodStartDate, // Return Date | null
      currentPeriodEnd: dbPeriodEndDate,     // Return Date | null
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at), cancelAtPeriodEnd: data.cancel_at_period_end,
    };
  } catch (error) {
    logger.error(`Unexpected error in subscriptionSync service for user ${userId}:`, error);
    throw error;
  }
};

export const getUserRecipeUsage = async (userId: string, periodStart: Date | null): Promise<number> => {
  if (!periodStart) { logger.warn(`getUserRecipeUsage: periodStart is null for user ${userId}, returning 0.`); return 0; }
  try {
    const { data, error } = await supabase.from('recipe_usage').select('count').eq('user_id', userId).eq('period_start', periodStart.toISOString()).single();
    if (error && error.code !== 'PGRST116') { logger.error(`Error getting recipe usage for user ${userId}, period ${periodStart.toISOString()}:`, error); return 0; }
    return data?.count || 0;
  } catch (error) { logger.error(`Unexpected error in getUserRecipeUsage for user ${userId}:`, error); return 0; }
};

export const getAiChatUsageCount = async (userId: string, periodStart: Date | null): Promise<number> => {
  if (!periodStart) { logger.warn(`getAiChatUsageCount: periodStart is null for user ${userId}, returning 0.`); return 0; }
  try {
    const { data, error } = await supabase.from('ai_chat_usage').select('count').eq('user_id', userId).eq('period_start', periodStart.toISOString()).single();
    if (error && error.code !== 'PGRST116') { logger.error(`Error getting AI chat usage for user ${userId}, period ${periodStart.toISOString()}:`, error); return 0; }
    return data?.count || 0;
  } catch (error) { logger.error(`Unexpected error in getAiChatUsageCount for user ${userId}:`, error); return 0; }
};

export const getSubscriptionStatus = async (userId: string): Promise<SubscriptionResponse | null> => {
  try {
    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      logger.warn(`getSubscriptionStatus: No subscription object retrieved for user ${userId}.`);
      return null;
    }

    // Handle case where period dates might be null from getUserSubscription if DB allows and they are null
    if (subscription.currentPeriodStart === null || subscription.currentPeriodEnd === null) {
        logger.error(`getSubscriptionStatus: Subscription for user ${userId} (ID: ${subscription.id}) has NULL currentPeriodStart or currentPeriodEnd. This might indicate an issue with free tier creation or data sync if these are always expected for active subscriptions. Returning a default/error state.`);
        const defaultFreeLimits = SUBSCRIPTION_FEATURE_LIMITS.free;
        return {
            tier: 'free', status: 'incomplete',
            currentPeriodEnd: null, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, // Use what we have for cancelAtPeriodEnd
            recipeGenerationsLimit: defaultFreeLimits.recipeGenerationsPerMonth === Infinity ? -1 : defaultFreeLimits.recipeGenerationsPerMonth,
            recipeGenerationsUsed: defaultFreeLimits.recipeGenerationsPerMonth === Infinity ? 0 : defaultFreeLimits.recipeGenerationsPerMonth,
            recipeGenerationsRemaining: 0,
            aiChatRepliesLimit: defaultFreeLimits.aiChatRepliesPerPeriod === Infinity ? -1 : defaultFreeLimits.aiChatRepliesPerPeriod,
            aiChatRepliesUsed: defaultFreeLimits.aiChatRepliesPerPeriod === Infinity ? 0 : defaultFreeLimits.aiChatRepliesPerPeriod,
            aiChatRepliesRemaining: 0,
        };
    }

    const userTier = subscription.tier;
    const limits = SUBSCRIPTION_FEATURE_LIMITS[userTier] || SUBSCRIPTION_FEATURE_LIMITS.free;

    const recipeUsageCount = await getUserRecipeUsage(userId, subscription.currentPeriodStart);
    const recipeLimit = limits.recipeGenerationsPerMonth;
    const recipeRemaining = recipeLimit === Infinity ? -1 : Math.max(0, recipeLimit - recipeUsageCount);

    let aiChatUsageCount = 0;
    if (limits.aiChatRepliesPerPeriod !== Infinity) {
       aiChatUsageCount = await getAiChatUsageCount(userId, subscription.currentPeriodStart);
    }
    const aiChatLimit = limits.aiChatRepliesPerPeriod;
    const aiChatRemaining = aiChatLimit === Infinity ? -1 : Math.max(0, aiChatLimit - aiChatUsageCount);

    return {
      tier: userTier,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(), // Now safe if previous check passes
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      recipeGenerationsLimit: recipeLimit === Infinity ? -1 : recipeLimit,
      recipeGenerationsUsed: recipeUsageCount,
      recipeGenerationsRemaining: recipeRemaining,
      aiChatRepliesLimit: aiChatLimit === Infinity ? -1 : aiChatLimit,
      aiChatRepliesUsed: aiChatUsageCount,
      aiChatRepliesRemaining: aiChatRemaining,
    };
  } catch (error) {
    logger.error(`Error in service getSubscriptionStatus for user ${userId}:`, error);
    return null;
  }
};

// --- Stripe related functions (placeholders if not actively used for IAP) ---
export const createCheckoutSession = async (userId: string, priceTier: 'basic' | 'premium', successUrl: string, cancelUrl: string): Promise<string | null> => { logger.warn(`[STRIPE] createCheckoutSession called for user ${userId}.`); return null; };
export const createCustomerPortalSession = async (userId: string, returnUrl: string): Promise<string | null> => { logger.warn(`[STRIPE] createCustomerPortalSession called for user ${userId}.`); return null; };
export const cancelSubscription = async (userId: string): Promise<boolean> => { logger.warn(`[STRIPE/Backend] cancelSubscription called for user ${userId}.`); return false; };
export const updateSubscriptionFromStripe = async (stripeSubscriptionId: string, status: ModelSubscriptionStatus, currentPeriodStart: Date, currentPeriodEnd: Date, cancelAtPeriodEnd: boolean, tier: ModelSubscriptionTier): Promise<boolean> => { return false;};
export const getOrCreateStripeCustomer = async (userId: string): Promise<string | null> => { return null; };
export const trackRecipeGeneration = async (userId: string): Promise<boolean> => { /* Your logic */ return false;};
export const trackAiChatReplyGeneration = async (userId: string): Promise<boolean> => { /* Your logic */ return false;};
export const hasReachedRecipeLimit = async (userId: string): Promise<boolean> => { /* Your logic */ return true; };