// src/controllers/subscriptionControllers.ts
import { Request, Response, NextFunction } from 'express';

// Relative imports from src/controllers/
import {
  getSubscriptionStatus,
  createCheckoutSession,
  createCustomerPortalSession,
  cancelSubscription,
  subscriptionSync
} from '../services/subscriptionService';

import { AppError } from '../middleware/errorMiddleware';
import { logger } from '../utils/logger';
import { isStripeConfigured } from '../config/stripe';

import { SubscriptionTier as ModelSubscriptionTier, SubscriptionStatus as ModelSubscriptionStatus } from '../models/Subscription';

interface ClientSubscriptionSyncBody {
  tier: 'free' | 'pro';
  status: 'active' | 'inactive' | 'trialing';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

// This matches the updated SubscriptionSyncParams in your subscriptionService.ts
interface ServiceSubscriptionSyncParams {
  userId: string;
  tier: ModelSubscriptionTier;
  status: ModelSubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

export const getSubscriptionDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('getSubscriptionDetails: Authentication required, userId not found.');
      return next(new AppError('Authentication required', 401));
    }
    logger.info(`getSubscriptionDetails: Fetching subscription status for user ${userId}`);
    const subscriptionData = await getSubscriptionStatus(userId);
    if (!subscriptionData) {
      logger.warn(`getSubscriptionDetails: No subscription data returned for user ${userId}.`);
      return next(new AppError('Unable to retrieve subscription status. Please try again later.', 404));
    }
    res.status(200).json({ subscription: subscriptionData });
  } catch (error) {
    logger.error('Error in getSubscriptionDetails controller:', error);
    next(new AppError('Failed to get subscription details', 500));
  }
};

export const subscriptionSyncController = async (
  req: Request<{}, {}, ClientSubscriptionSyncBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      logger.warn('subscriptionSyncController: Authentication required, userId not found.');
      return next(new AppError('Authentication required', 401));
    }

    const {
      tier: clientTier,
      status: clientStatus,
      currentPeriodStart: clientPeriodStartStr,
      currentPeriodEnd: clientPeriodEndStr,
      cancelAtPeriodEnd,
    } = req.body;

    logger.info(`Subscription Sync Controller: User ${userId}, Received Body:`, JSON.stringify(req.body, null, 2));

    if (clientTier === undefined || clientStatus === undefined ||
        // clientPeriodStartStr & clientPeriodEndStr can be null, so checking undefined is correct
        clientPeriodStartStr === undefined || clientPeriodEndStr === undefined || 
        typeof cancelAtPeriodEnd !== 'boolean') {
      logger.warn(`Subscription Sync Validation Failed (Missing Fields) for User ${userId}:`, req.body);
      return next(new AppError('Missing or invalid subscription data in request body (tier, status, dates, or cancelAtPeriodEnd)', 400));
    }
    
    let modelTier: ModelSubscriptionTier;
    if (clientTier === 'pro') {
      modelTier = 'premium';
      logger.info(`Subscription Sync: Mapped client tier "pro" to "premium" for user ${userId}.`);
    } else if (clientTier === 'free') {
      modelTier = 'free';
    } else {
      const validModelTiers: ModelSubscriptionTier[] = ['free', 'basic', 'premium'];
      if (validModelTiers.includes(clientTier as ModelSubscriptionTier)) {
          modelTier = clientTier as ModelSubscriptionTier;
      } else {
          logger.warn(`Subscription Sync: Invalid clientTier '${clientTier}' for user ${userId}. Expected 'pro' or 'free'.`);
          return next(new AppError(`Invalid tier value provided: ${clientTier}. Expected 'pro' or 'free'.`, 400));
      }
    }

    let modelStatus: ModelSubscriptionStatus;
    const validModelStatuses: ModelSubscriptionStatus[] = ['active', 'canceled', 'past_due', 'incomplete', 'trialing'];
    switch (clientStatus) {
      case 'active': modelStatus = 'active'; break;
      case 'inactive': modelStatus = 'canceled'; break;
      case 'trialing': modelStatus = 'trialing'; break;
      default:
        if (validModelStatuses.includes(clientStatus as ModelSubscriptionStatus)) {
            modelStatus = clientStatus as ModelSubscriptionStatus;
        } else {
            logger.warn(`Subscription Sync: Invalid clientStatus '${clientStatus}' for user ${userId}.`);
            return next(new AppError(`Invalid status value provided: ${clientStatus}`, 400));
        }
    }

    if ((clientPeriodStartStr !== null && isNaN(new Date(clientPeriodStartStr).getTime())) ||
        (clientPeriodEndStr !== null && isNaN(new Date(clientPeriodEndStr).getTime()))) {
      logger.warn(`Subscription Sync: Invalid date format for user ${userId}. Start: ${clientPeriodStartStr}, End: ${clientPeriodEndStr}`);
      return next(new AppError('Invalid date format for currentPeriodStart or currentPeriodEnd', 400));
    }

    const syncServiceParams: ServiceSubscriptionSyncParams = {
      userId,
      tier: modelTier,
      status: modelStatus,
      currentPeriodStart: clientPeriodStartStr ? new Date(clientPeriodStartStr) : null,
      currentPeriodEnd: clientPeriodEndStr ? new Date(clientPeriodEndStr) : null,
      cancelAtPeriodEnd: cancelAtPeriodEnd,
    };

    logger.info(`Subscription Sync Controller: Calling service for user ${userId} with mapped params:`, JSON.stringify(syncServiceParams, null, 2));
    const subscription = await subscriptionSync(syncServiceParams);

    if (!subscription) {
      logger.error(`Subscription Sync Controller: Service call to subscriptionSync returned null for user ${userId}.`);
      return next(new AppError('Unable to sync subscription status with backend service.', 500));
    }

    res.status(200).json({
      message: 'Subscription synced successfully',
      subscription: subscription,
    });

  } catch (error) {
    logger.error('Error in subscriptionSyncController:', error);
    if (error instanceof AppError) return next(error);
    next(new AppError('Failed to sync subscription details due to an unexpected error', 500));
  }
};

export const createCheckoutSessionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logger.warn("Stripe createCheckoutSessionController called - verify if used/needed.");
    // Assuming RevenueCat is primary, this might be deprecated for mobile.
    if (!isStripeConfigured()) return next(new AppError('Payment system (Stripe) is not configured', 503));
    // ... your original logic for Stripe checkout ...
    res.status(501).json({ message: "Stripe Checkout not fully implemented or deprecated." });
};

export const createCustomerPortalSessionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logger.warn("Stripe createCustomerPortalSessionController called - verify if used/needed.");
    if (!isStripeConfigured()) return next(new AppError('Payment system (Stripe) is not configured', 503));
    // ... your original logic for Stripe portal ...
    res.status(501).json({ message: "Stripe Portal not fully implemented or deprecated." });
};

export const cancelSubscriptionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logger.warn("Backend cancelSubscriptionController called - verify if used for Stripe or direct cancellation.");
    // ... your original logic for backend cancellation ...
    res.status(501).json({ message: "Backend cancellation not fully implemented or deprecated." });
};