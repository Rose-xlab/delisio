// src/middleware/subscriptionMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { getUserSubscription, hasReachedRecipeLimit, trackRecipeGeneration } from '../services/subscriptionService';
import { AppError } from './errorMiddleware';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_LIMITS } from '../models/Subscription';

// Extend Express Request interface for subscription info
declare global {
  namespace Express {
    interface Request {
      subscriptionTier?: 'free' | 'basic' | 'premium';
      subscriptionLimits?: {
        imageQuality: 'standard' | 'hd';
        imageSize: '1024x1024' | '1792x1024';
      };
    }
  }
}

/**
 * Middleware to check if user can generate a recipe
 * Only limits recipe generation, not chat functionality
 */
export const checkRecipeGenerationAllowed = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip check if no user (guest mode) - authentication middleware should handle this
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }
    
    const userId = req.user.id;
    logger.info(`Checking recipe generation permissions for user ${userId}`);
    
    // Get subscription details
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      logger.error(`No subscription found for user ${userId}`);
      return next(new AppError('Subscription information not found', 500));
    }
    
    // Handle inactive subscriptions
    if (subscription.status !== 'active') {
      logger.warn(`User ${userId} has inactive subscription: ${subscription.status}`);
      return next(new AppError(`Your subscription is not active (status: ${subscription.status})`, 402));
    }
    
    // Attach subscription tier to request for later use (e.g., for image quality)
    req.subscriptionTier = subscription.tier;
    
    // Attach image quality settings based on tier
    const limits = SUBSCRIPTION_LIMITS[subscription.tier];
    req.subscriptionLimits = {
      imageQuality: limits.imageQuality,
      imageSize: limits.imageSize
    };
    
    // Premium tier has unlimited recipes, no need to check
    if (subscription.tier === 'premium') {
      // Still track usage for analytics, but don't limit
      await trackRecipeGeneration(userId);
      logger.info(`Premium user ${userId} generating recipe (unlimited)`);
      return next();
    }
    
    // Check if user has reached their recipe generation limit
    const reachedLimit = await hasReachedRecipeLimit(userId);
    
    if (reachedLimit) {
      // Different messages based on tier
      let message = '';
      if (subscription.tier === 'free') {
        message = 'You have reached your limit of 1 recipe this month. Upgrade to our Basic plan for 5 recipes per month, or Premium for unlimited recipes.';
      } else { // basic tier
        message = 'You have reached your limit of 5 recipes this month. Upgrade to our Premium plan for unlimited recipes.';
      }
      
      logger.warn(`User ${userId} has reached recipe generation limit for tier ${subscription.tier}`);
      return next(new AppError(message, 402));
    }
    
    // Track this generation against their limit
    await trackRecipeGeneration(userId);
    logger.info(`User ${userId} generating recipe (tier: ${subscription.tier})`);
    
    next();
  } catch (error) {
    logger.error('Error in subscription middleware:', error);
    next(new AppError('Error checking subscription status', 500));
  }
};

/**
 * Lightweight middleware to just attach subscription info without limiting
 * Useful for routes that need tier info but shouldn't be limited
 */
export const attachSubscriptionInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip if no user
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    
    // Get subscription details without checking limits
    const subscription = await getUserSubscription(userId);
    
    if (subscription) {
      // Attach subscription tier to request
      req.subscriptionTier = subscription.tier;
      
      // Attach image quality settings based on tier
      const limits = SUBSCRIPTION_LIMITS[subscription.tier];
      req.subscriptionLimits = {
        imageQuality: limits.imageQuality,
        imageSize: limits.imageSize
      };
    }
    
    next();
  } catch (error) {
    // Don't block the request on error, just log
    logger.error('Error attaching subscription info:', error);
    next();
  }
};