"use strict";
// src/models/Subscription.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBSCRIPTION_LIMITS = void 0;
exports.getSubscriptionLimits = getSubscriptionLimits;
/**
 * Configuration for subscription tiers and their limits
 */
exports.SUBSCRIPTION_LIMITS = {
    free: {
        tier: 'free',
        recipeGenerationsPerMonth: 1,
        imageQuality: 'standard',
        imageSize: '1024x1024'
    },
    basic: {
        tier: 'basic',
        recipeGenerationsPerMonth: 5,
        imageQuality: 'hd',
        imageSize: '1792x1024'
    },
    premium: {
        tier: 'premium',
        recipeGenerationsPerMonth: Infinity, // Unlimited
        imageQuality: 'hd',
        imageSize: '1792x1024'
    }
};
/**
 * Get subscription limits for a specific tier
 */
function getSubscriptionLimits(tier) {
    return exports.SUBSCRIPTION_LIMITS[tier];
}
//# sourceMappingURL=Subscription.js.map