"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachSubscriptionInfo = exports.checkRecipeGenerationAllowed = void 0;
const subscriptionService_1 = require("../services/subscriptionService");
const errorMiddleware_1 = require("./errorMiddleware");
const logger_1 = require("../utils/logger");
const Subscription_1 = require("../models/Subscription");
/**
 * Middleware to check if user can generate a recipe
 * Only limits recipe generation, not chat functionality
 */
const checkRecipeGenerationAllowed = async (req, res, next) => {
    try {
        // Skip check if no user (guest mode) - authentication middleware should handle this
        if (!req.user) {
            return next(new errorMiddleware_1.AppError('Authentication required', 401));
        }
        const userId = req.user.id;
        logger_1.logger.info(`Checking recipe generation permissions for user ${userId}`);
        // Get subscription details
        const subscription = await (0, subscriptionService_1.getUserSubscription)(userId);
        if (!subscription) {
            logger_1.logger.error(`No subscription found for user ${userId}`);
            return next(new errorMiddleware_1.AppError('Subscription information not found', 500));
        }
        // Handle inactive subscriptions
        if (subscription.status !== 'active') {
            logger_1.logger.warn(`User ${userId} has inactive subscription: ${subscription.status}`);
            return next(new errorMiddleware_1.AppError(`Your subscription is not active (status: ${subscription.status})`, 402));
        }
        // Attach subscription tier to request for later use (e.g., for image quality)
        req.subscriptionTier = subscription.tier;
        // Attach image quality settings based on tier
        const limits = Subscription_1.SUBSCRIPTION_LIMITS[subscription.tier];
        req.subscriptionLimits = {
            imageQuality: limits.imageQuality,
            imageSize: limits.imageSize
        };
        // Premium tier has unlimited recipes, no need to check
        if (subscription.tier === 'premium') {
            // Still track usage for analytics, but don't limit
            await (0, subscriptionService_1.trackRecipeGeneration)(userId);
            logger_1.logger.info(`Premium user ${userId} generating recipe (unlimited)`);
            return next();
        }
        // Check if user has reached their recipe generation limit
        const reachedLimit = await (0, subscriptionService_1.hasReachedRecipeLimit)(userId);
        if (reachedLimit) {
            // Different messages based on tier
            let message = '';
            if (subscription.tier === 'free') {
                message = 'You have reached your limit of 1 recipe this month. Upgrade to our Basic plan for 5 recipes per month, or Premium for unlimited recipes.';
            }
            else { // basic tier
                message = 'You have reached your limit of 5 recipes this month. Upgrade to our Premium plan for unlimited recipes.';
            }
            logger_1.logger.warn(`User ${userId} has reached recipe generation limit for tier ${subscription.tier}`);
            return next(new errorMiddleware_1.AppError(message, 402));
        }
        // Track this generation against their limit
        await (0, subscriptionService_1.trackRecipeGeneration)(userId);
        logger_1.logger.info(`User ${userId} generating recipe (tier: ${subscription.tier})`);
        next();
    }
    catch (error) {
        logger_1.logger.error('Error in subscription middleware:', error);
        next(new errorMiddleware_1.AppError('Error checking subscription status', 500));
    }
};
exports.checkRecipeGenerationAllowed = checkRecipeGenerationAllowed;
/**
 * Lightweight middleware to just attach subscription info without limiting
 * Useful for routes that need tier info but shouldn't be limited
 */
const attachSubscriptionInfo = async (req, res, next) => {
    try {
        // Skip if no user
        if (!req.user) {
            return next();
        }
        const userId = req.user.id;
        // Get subscription details without checking limits
        const subscription = await (0, subscriptionService_1.getUserSubscription)(userId);
        if (subscription) {
            // Attach subscription tier to request
            req.subscriptionTier = subscription.tier;
            // Attach image quality settings based on tier
            const limits = Subscription_1.SUBSCRIPTION_LIMITS[subscription.tier];
            req.subscriptionLimits = {
                imageQuality: limits.imageQuality,
                imageSize: limits.imageSize
            };
        }
        next();
    }
    catch (error) {
        // Don't block the request on error, just log
        logger_1.logger.error('Error attaching subscription info:', error);
        next();
    }
};
exports.attachSubscriptionInfo = attachSubscriptionInfo;
//# sourceMappingURL=subscriptionMiddleware.js.map