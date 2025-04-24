import { Subscription, SubscriptionTier, SubscriptionStatus, SubscriptionResponse } from '../models/Subscription';
/**
 * Get user's subscription from database
 */
export declare const getUserSubscription: (userId: string) => Promise<Subscription | null>;
/**
 * Create a free subscription for a new user
 */
export declare const createFreeSubscription: (userId: string) => Promise<Subscription | null>;
/**
 * Get user's current recipe generation usage
 */
export declare const getUserRecipeUsage: (userId: string, periodStart: Date) => Promise<number>;
/**
 * Check if user has reached their recipe generation limit
 */
export declare const hasReachedRecipeLimit: (userId: string) => Promise<boolean>;
/**
 * Track recipe generation usage
 */
export declare const trackRecipeGeneration: (userId: string) => Promise<boolean>;
/**
 * Create or retrieve a Stripe customer for a user
 */
export declare const getOrCreateStripeCustomer: (userId: string) => Promise<string | null>;
/**
 * Create a checkout session for subscription
 */
export declare const createCheckoutSession: (userId: string, priceTier: "basic" | "premium", // Only allow paid tiers for checkout
successUrl: string, cancelUrl: string) => Promise<string | null>;
/**
 * Create a customer portal session
 */
export declare const createCustomerPortalSession: (userId: string, returnUrl: string) => Promise<string | null>;
/**
 * Cancel a subscription (sets cancel_at_period_end to true)
 */
export declare const cancelSubscription: (userId: string) => Promise<boolean>;
/**
 * Get user's subscription status with usage information
 */
export declare const getSubscriptionStatus: (userId: string) => Promise<SubscriptionResponse | null>;
/**
 * Update subscription in database after webhook event (e.g., payment success, cancellation)
 * Note: This function should ideally fetch the associated userId from the subscription metadata or DB
 * if only the stripeSubscriptionId is available from the webhook event.
 */
export declare const updateSubscriptionFromStripe: (stripeSubscriptionId: string, status: SubscriptionStatus, // Ensure webhook handler maps Stripe status correctly
currentPeriodStart: Date, currentPeriodEnd: Date, cancelAtPeriodEnd: boolean, tier: SubscriptionTier) => Promise<boolean>;
/**
 * Reset usage counter for a new billing period (e.g., called by webhook or cron job)
 * Uses upsert to create or update the usage record for the given period.
 */
export declare const resetUsageCounter: (userId: string, periodStart: Date, periodEnd: Date) => Promise<boolean>;
