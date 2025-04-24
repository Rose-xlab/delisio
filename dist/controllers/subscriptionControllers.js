"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelSubscriptionController = exports.createCustomerPortalSessionController = exports.createCheckoutSessionController = exports.getSubscriptionDetails = void 0;
const subscriptionService_1 = require("../services/subscriptionService");
const errorMiddleware_1 = require("../middleware/errorMiddleware");
const logger_1 = require("../utils/logger");
const stripe_1 = require("../config/stripe");
/**
 * Get user's subscription status and usage information
 */
const getSubscriptionDetails = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return next(new errorMiddleware_1.AppError('Authentication required', 401));
        }
        const subscriptionStatus = await (0, subscriptionService_1.getSubscriptionStatus)(userId);
        if (!subscriptionStatus) {
            return next(new errorMiddleware_1.AppError('Unable to retrieve subscription status', 500));
        }
        res.status(200).json({
            subscription: subscriptionStatus
        });
    }
    catch (error) {
        logger_1.logger.error('Error getting subscription details:', error);
        next(new errorMiddleware_1.AppError('Failed to get subscription details', 500));
    }
};
exports.getSubscriptionDetails = getSubscriptionDetails;
/**
 * Create a checkout session for subscription purchase
 */
const createCheckoutSessionController = async (req, res, next) => {
    try {
        // Check if Stripe is configured
        if (!(0, stripe_1.isStripeConfigured)()) {
            return next(new errorMiddleware_1.AppError('Payment system is not available', 503));
        }
        const userId = req.user?.id;
        if (!userId) {
            return next(new errorMiddleware_1.AppError('Authentication required', 401));
        }
        const { tier, successUrl, cancelUrl } = req.body;
        // Validate tier
        if (tier !== 'basic' && tier !== 'premium') {
            return next(new errorMiddleware_1.AppError('Invalid subscription tier. Must be "basic" or "premium"', 400));
        }
        // Validate URLs
        if (!successUrl || !cancelUrl) {
            return next(new errorMiddleware_1.AppError('Success URL and cancel URL are required', 400));
        }
        const checkoutUrl = await (0, subscriptionService_1.createCheckoutSession)(userId, tier, successUrl, cancelUrl);
        if (!checkoutUrl) {
            return next(new errorMiddleware_1.AppError('Failed to create checkout session', 500));
        }
        res.status(200).json({
            checkoutUrl
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating checkout session:', error);
        next(new errorMiddleware_1.AppError('Failed to create checkout session', 500));
    }
};
exports.createCheckoutSessionController = createCheckoutSessionController;
/**
 * Create customer portal session for managing subscription
 */
const createCustomerPortalSessionController = async (req, res, next) => {
    try {
        // Check if Stripe is configured
        if (!(0, stripe_1.isStripeConfigured)()) {
            return next(new errorMiddleware_1.AppError('Payment system is not available', 503));
        }
        const userId = req.user?.id;
        if (!userId) {
            return next(new errorMiddleware_1.AppError('Authentication required', 401));
        }
        const { returnUrl } = req.body;
        if (!returnUrl) {
            return next(new errorMiddleware_1.AppError('Return URL is required', 400));
        }
        const portalUrl = await (0, subscriptionService_1.createCustomerPortalSession)(userId, returnUrl);
        if (!portalUrl) {
            return next(new errorMiddleware_1.AppError('Failed to create customer portal session', 500));
        }
        res.status(200).json({
            portalUrl
        });
    }
    catch (error) {
        logger_1.logger.error('Error creating customer portal session:', error);
        next(new errorMiddleware_1.AppError('Failed to create customer portal session', 500));
    }
};
exports.createCustomerPortalSessionController = createCustomerPortalSessionController;
/**
 * Cancel subscription
 */
const cancelSubscriptionController = async (req, res, next) => {
    try {
        // Check if Stripe is configured
        if (!(0, stripe_1.isStripeConfigured)()) {
            return next(new errorMiddleware_1.AppError('Payment system is not available', 503));
        }
        const userId = req.user?.id;
        if (!userId) {
            return next(new errorMiddleware_1.AppError('Authentication required', 401));
        }
        const success = await (0, subscriptionService_1.cancelSubscription)(userId);
        if (!success) {
            return next(new errorMiddleware_1.AppError('Failed to cancel subscription', 500));
        }
        res.status(200).json({
            message: 'Subscription will be canceled at the end of the current billing period'
        });
    }
    catch (error) {
        logger_1.logger.error('Error canceling subscription:', error);
        next(new errorMiddleware_1.AppError('Failed to cancel subscription', 500));
    }
};
exports.cancelSubscriptionController = cancelSubscriptionController;
//# sourceMappingURL=subscriptionControllers.js.map