// src/middleware/subscriptionMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import {
  getUserSubscription,
  hasReachedRecipeLimit, // This import relies on the export from subscriptionService.ts
  trackRecipeGeneration,
} from '../services/subscriptionService';
import { AppError } from './errorMiddleware';
import { logger } from '../utils/logger';
import {
  SUBSCRIPTION_FEATURE_LIMITS, // Changed from SUBSCRIPTION_LIMITS
  FeatureLimits,
  SubscriptionTier,
} from '../models/Subscription';

declare global {
  namespace Express {
    interface Request {
      subscriptionTier?: SubscriptionTier;
      subscriptionLimits?: FeatureLimits; // Use the full FeatureLimits type
    }
  }
}

export const checkRecipeGenerationAllowed = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Authentication required for this action', 401));
    }
    
    const userId = req.user.id;
    logger.info(`Checking recipe generation permissions for user ${userId}`);
    
    const subscription = await getUserSubscription(userId);
    
    if (!subscription) {
      logger.error(`No subscription could be determined for user ${userId}.`);
      return next(new AppError('Subscription information not found. Please try again.', 500));
    }
    
    if (subscription.status !== 'active') {
      logger.warn(`User ${userId} has inactive subscription: ${subscription.status}`);
      return next(new AppError(`Your subscription is not active (status: ${subscription.status}). Recipe generation is disabled.`, 402));
    }
    
    req.subscriptionTier = subscription.tier;
    const limits = SUBSCRIPTION_FEATURE_LIMITS[subscription.tier] || SUBSCRIPTION_FEATURE_LIMITS.free;
    req.subscriptionLimits = limits;
    
    if (limits.recipeGenerationsPerMonth === Infinity) {
      if (subscription.tier === 'premium') {
         logger.info(`Premium user ${userId} generating recipe (unlimited recipe generations).`);
      } else {
         logger.info(`User ${userId} (Tier: ${subscription.tier}) generating recipe (unlimited recipe generations for this tier).`);
      }
      await trackRecipeGeneration(userId);
      return next();
    }
    
    const reachedRecipeLimit = await hasReachedRecipeLimit(userId);
    
    if (reachedRecipeLimit) {
      let message = `You have reached your recipe generation limit of ${limits.recipeGenerationsPerMonth} for this period (Tier: ${subscription.tier}). Please upgrade for more.`;
      if (subscription.tier === 'free') {
        message = `You have reached your limit of ${limits.recipeGenerationsPerMonth} recipe generation(s) this period for the free plan. Upgrade to our Basic plan for more recipes per month, or Premium for unlimited recipes.`;
      } else if (subscription.tier === 'basic') { // Assuming 'basic' is a defined tier
        message = `You have reached your limit of ${limits.recipeGenerationsPerMonth} recipe generation(s) this period for the ${subscription.tier} plan. Upgrade to Premium for unlimited recipes.`;
      }
      logger.warn(`User ${userId} has reached recipe generation limit for tier ${subscription.tier}`);
      return next(new AppError(message, 402));
    }
    
    await trackRecipeGeneration(userId);
    logger.info(`User ${userId} generating recipe (Tier: ${subscription.tier}, Limit: ${limits.recipeGenerationsPerMonth}).`);
    
    next();
  } catch (error) {
    logger.error('Error in checkRecipeGenerationAllowed middleware:', error);
    next(new AppError('Error checking subscription status for recipe generation', 500));
  }
};

export const attachSubscriptionInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      req.subscriptionTier = 'free';
      req.subscriptionLimits = SUBSCRIPTION_FEATURE_LIMITS.free;
      return next();
    }
    
    const userId = req.user.id;
    const subscription = await getUserSubscription(userId);
    
    if (subscription) {
      req.subscriptionTier = subscription.tier;
      req.subscriptionLimits = SUBSCRIPTION_FEATURE_LIMITS[subscription.tier] || SUBSCRIPTION_FEATURE_LIMITS.free;
    } else {
      logger.warn(`No subscription record found for user ${userId} in attachSubscriptionInfo, defaulting to free tier limits.`);
      req.subscriptionTier = 'free';
      req.subscriptionLimits = SUBSCRIPTION_FEATURE_LIMITS.free;
    }
    
    next();
  } catch (error) {
    logger.error('Error attaching subscription info:', error);
    req.subscriptionTier = req.subscriptionTier || 'free';
    req.subscriptionLimits = req.subscriptionLimits || SUBSCRIPTION_FEATURE_LIMITS.free;
    next();
  }
};