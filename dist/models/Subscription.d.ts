/**
 * Subscription tiers available in the application
 */
export type SubscriptionTier = 'free' | 'basic' | 'premium';
/**
 * Subscription status values
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
/**
 * Interface for the subscription object
 */
export interface Subscription {
    id: string;
    userId: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    createdAt: Date;
    updatedAt: Date;
    cancelAtPeriodEnd: boolean;
}
/**
 * Interface for usage tracking
 */
export interface UsageRecord {
    id: string;
    userId: string;
    recipeCount: number;
    periodStart: Date;
    periodEnd: Date;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Interface for subscription limits
 */
export interface SubscriptionLimits {
    tier: SubscriptionTier;
    recipeGenerationsPerMonth: number;
    imageQuality: 'standard' | 'hd';
    imageSize: '1024x1024' | '1792x1024';
}
/**
 * Configuration for subscription tiers and their limits
 */
export declare const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, SubscriptionLimits>;
/**
 * Get subscription limits for a specific tier
 */
export declare function getSubscriptionLimits(tier: SubscriptionTier): SubscriptionLimits;
/**
 * Type for subscription response to clients
 */
export interface SubscriptionResponse {
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    currentPeriodEnd: string;
    recipeGenerationsLimit: number;
    recipeGenerationsUsed: number;
    recipeGenerationsRemaining: number;
    cancelAtPeriodEnd: boolean;
}
