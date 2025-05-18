// src/models/Subscription.ts

/**
 * Subscription tiers available in the application
 */
export type SubscriptionTier = 'free' | 'basic' | 'premium'; // Ensure these match your RevenueCat entitlement identifiers or your internal mapping

/**
 * Subscription status values
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';

/**
 * Interface for the subscription object (from your DB)
 */
export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId?: string; // Keep if you still use Stripe for something or for legacy
  stripeSubscriptionId?: string; // Keep if you still use Stripe for something or for legacy
  // NEW: Consider adding RevenueCat App User ID if you store it here to link back,
  // though it's primarily on the 'profiles' table.
  // revenuecat_app_user_id?: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
  cancelAtPeriodEnd: boolean;
}

// UsageRecord for recipes remains the same
export interface UsageRecord {
  id: string;
  userId: string;
  recipeCount: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

// NEW: Interface for AI Chat Usage (maps to your new ai_chat_usage table)
export interface AiChatUsageRecord {
  id: string;
  userId: string;
  count: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}


/**
 * Interface for feature limits based on subscription tier
 */
export interface FeatureLimits {
  recipeGenerationsPerMonth: number;
  aiChatRepliesPerPeriod: number; // e.g., per month, matching subscription period
  // aiChatReplyPeriodType: 'month' | 'lifetime'; // Implicitly 'month' if tied to currentPeriodStart/End
  imageQuality: 'standard' | 'hd';
  imageSize: '1024x1024' | '1792x1024';
}

/**
 * Configuration for subscription tiers and their feature limits
 */
export const SUBSCRIPTION_FEATURE_LIMITS: Record<SubscriptionTier, FeatureLimits> = {
  free: {
    recipeGenerationsPerMonth: 1,
    aiChatRepliesPerPeriod: 3, // Your 3 AI replies for free users
    imageQuality: 'standard',
    imageSize: '1024x1024',
  },
  basic: { // Assuming 'basic' is a paid tier that might come from RevenueCat
    recipeGenerationsPerMonth: 10, // Example
    aiChatRepliesPerPeriod: 100,   // Example
    imageQuality: 'hd',
    imageSize: '1792x1024',
  },
  premium: { // This should map to your "pro" RevenueCat entitlement
    recipeGenerationsPerMonth: Infinity,
    aiChatRepliesPerPeriod: Infinity, // Unlimited for premium
    imageQuality: 'hd',
    imageSize: '1792x1024',
  },
};

export function getFeatureLimits(tier: SubscriptionTier): FeatureLimits {
  return SUBSCRIPTION_FEATURE_LIMITS[tier] || SUBSCRIPTION_FEATURE_LIMITS.free; // Fallback to free
}

/**
 * Type for subscription response to clients (Flutter app)
 */
export interface SubscriptionResponse {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string; // ISO date string
  cancelAtPeriodEnd: boolean;

  recipeGenerationsLimit: number;
  recipeGenerationsUsed: number;
  recipeGenerationsRemaining: number;

  // NEW Fields for AI Chat Replies
  aiChatRepliesLimit: number;
  aiChatRepliesUsed: number;
  aiChatRepliesRemaining: number;
}