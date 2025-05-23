// src/controllers/subscriptionControllers.ts
import { Request, Response, NextFunction } from 'express';

import { 
  getUserSubscription, 
  createCheckoutSession, 
  createCustomerPortalSession,
  getSubscriptionStatus,
  cancelSubscription,
  subscriptionSync
} from '../services/subscriptionService';

import { AppError } from '../middleware/errorMiddleware';
import { logger } from '../utils/logger';
import { isStripeConfigured } from '../config/stripe';

//
export type SubscriptionTier = 'free' | 'pro';


/**
 * Subscription status values
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';

//
export interface SubscriptionSyncParams {
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

/**
 * Get user's subscription status and usage information
 */
export const getSubscriptionDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }
    
    const subscriptionStatus = await getSubscriptionStatus(userId);
    
    if (!subscriptionStatus) {
      return next(new AppError('Unable to retrieve subscription status', 500));
    }
    
    res.status(200).json({
      subscription: subscriptionStatus
    });
  } catch (error) {
    logger.error('Error getting subscription details:', error);
    next(new AppError('Failed to get subscription details', 500));
  }
};

/*
*
* Sync subscription status
*/


export const subscriptionSyncController = async (
  req: Request, // Consider typing req.body if you have a specific DTO
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }

    // Extract all necessary parameters from the request body
    // You'll need to ensure these are actually sent by the client
    const {
      tier,
      status,
      currentPeriodStart, // This will likely be a string from JSON, needs conversion
      currentPeriodEnd,   // This will also likely be a string, needs conversion
      cancelAtPeriodEnd,
    } = req.body;
     
    console.log("================================= SUB CONTROLLER CALLED ===========================")
    console.log( tier,
      status,
      currentPeriodStart, // This will likely be a string from JSON, needs conversion
      currentPeriodEnd,   // This will also likely be a string, needs conversion
      cancelAtPeriodEnd)
    // **Crucial: Validate the incoming data**
    // This is a simplified check; use a validation library like Joi or Zod in a real app.
    if (!tier || !status || !currentPeriodStart || !currentPeriodEnd || typeof cancelAtPeriodEnd !== 'boolean') {
      return next(new AppError('Missing or invalid subscription data in request body', 400));
    }

    // Construct the params object for the service
    const syncParams: SubscriptionSyncParams = {
      userId,
      tier: tier as SubscriptionTier, // Add type assertion or proper validation/parsing
      status: status as SubscriptionStatus, // Add type assertion or proper validation/parsing
      currentPeriodStart: new Date(currentPeriodStart), // Convert string to Date
      currentPeriodEnd: new Date(currentPeriodEnd),     // Convert string to Date
    };

    const subscription = await subscriptionSync(syncParams);

    if (!subscription) {
      // The service function already logs errors, so we can be a bit more generic here
      return next(new AppError('Unable to sync subscription status', 500));
    }

    res.status(200).json({
      message: 'Subscription synced successfully',
      subscription: subscription,
    });

  } catch (error) {
    // Log the actual error for debugging
    logger.error('Error in subscriptionSyncController:', error);

    // Avoid sending detailed error internals to the client in production
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Failed to sync subscription details due to an unexpected error', 500));
  }
};

/**
 * Create a checkout session for subscription purchase
 */
export const createCheckoutSessionController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return next(new AppError('Payment system is not available', 503));
    }
    
    const userId = req.user?.id;
    
    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }
    
    const { tier, successUrl, cancelUrl } = req.body;
    
    // Validate tier
    if (tier !== 'basic' && tier !== 'premium') {
      return next(new AppError('Invalid subscription tier. Must be "basic" or "premium"', 400));
    }
    
    // Validate URLs
    if (!successUrl || !cancelUrl) {
      return next(new AppError('Success URL and cancel URL are required', 400));
    }
    
    const checkoutUrl = await createCheckoutSession(userId, tier, successUrl, cancelUrl);
    
    if (!checkoutUrl) {
      return next(new AppError('Failed to create checkout session', 500));
    }
    
    res.status(200).json({
      checkoutUrl
    });
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    next(new AppError('Failed to create checkout session', 500));
  }
};

/**
 * Create customer portal session for managing subscription
 */
export const createCustomerPortalSessionController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return next(new AppError('Payment system is not available', 503));
    }
    
    const userId = req.user?.id;
    
    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }
    
    const { returnUrl } = req.body;
    
    if (!returnUrl) {
      return next(new AppError('Return URL is required', 400));
    }
    
    const portalUrl = await createCustomerPortalSession(userId, returnUrl);
    
    if (!portalUrl) {
      return next(new AppError('Failed to create customer portal session', 500));
    }
    
    res.status(200).json({
      portalUrl
    });
  } catch (error) {
    logger.error('Error creating customer portal session:', error);
    next(new AppError('Failed to create customer portal session', 500));
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscriptionController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return next(new AppError('Payment system is not available', 503));
    }
    
    const userId = req.user?.id;
    
    if (!userId) {
      return next(new AppError('Authentication required', 401));
    }
    
    const success = await cancelSubscription(userId);
    
    if (!success) {
      return next(new AppError('Failed to cancel subscription', 500));
    }
    
    res.status(200).json({
      message: 'Subscription will be canceled at the end of the current billing period'
    });
  } catch (error) {
    logger.error('Error canceling subscription:', error);
    next(new AppError('Failed to cancel subscription', 500));
  }
};