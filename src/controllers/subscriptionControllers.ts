// src/controllers/subscriptionControllers.ts
import { Request, Response, NextFunction } from 'express';

import {
  getSubscriptionStatus,
  createCheckoutSession,
  createCustomerPortalSession,
  cancelSubscription,
  subscriptionSync
} from '../services/subscriptionService'; // Adjust path if needed

import { AppError } from '../middleware/errorMiddleware'; // Adjust path if needed
import { logger } from '../utils/logger';                 // Adjust path if needed
import { isStripeConfigured } from '../config/stripe';   // Adjust path if needed

import { SubscriptionTier as ModelSubscriptionTier, SubscriptionStatus as ModelSubscriptionStatus } from '../models/Subscription'; // Adjust path if needed

interface ClientSubscriptionSyncBody {
  tier: 'free' | 'pro';
  status: 'active' | 'inactive' | 'trialing';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

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
        clientPeriodStartStr === undefined || clientPeriodEndStr === undefined ||
        typeof cancelAtPeriodEnd !== 'boolean') {
      logger.warn(`Subscription Sync Validation Failed (Missing Fields) for User ${userId}:`, req.body);
      return next(new AppError('Missing or invalid subscription data in request body', 400));
    }

    // --- MAPPING LOGIC ---
    let modelTier: ModelSubscriptionTier;
    let modelStatus: ModelSubscriptionStatus;

    if (clientTier === 'free') {
      modelTier = 'free';
      modelStatus = 'active'; // *** ALWAYS "active" if client reports "free" tier ***
      logger.info(`Subscription Sync: Client tier is "free". Setting model tier to "free" and model status to "active" for user ${userId}.`);
    } else if (clientTier === 'pro') {
      modelTier = 'premium'; // Map "pro" from client to "premium" for backend model
      logger.info(`Subscription Sync: Client tier is "pro". Mapping to model tier "premium" for user ${userId}.`);
      // For 'pro' (premium) tier, derive status from clientStatus
      const validModelStatusesForPro: ModelSubscriptionStatus[] = ['active', 'canceled', 'past_due', 'incomplete', 'trialing'];
      switch (clientStatus) {
        case 'active': modelStatus = 'active'; break;
        case 'inactive': modelStatus = 'canceled'; break; // A Pro plan becoming inactive means it's canceled or expired
        case 'trialing': modelStatus = 'trialing'; break;
        default:
          // This case should ideally not be hit if clientStatus is from a controlled set for 'pro'
          if (validModelStatusesForPro.includes(clientStatus as ModelSubscriptionStatus)) {
              modelStatus = clientStatus as ModelSubscriptionStatus;
          } else {
              logger.warn(`Subscription Sync: Invalid clientStatus '${clientStatus}' for 'pro' tier, user ${userId}.`);
              return next(new AppError(`Invalid status value '${clientStatus}' provided for 'pro' tier.`, 400));
          }
      }
    } else {
      // This handles if client sends a tier like 'basic' directly (and your ModelSubscriptionTier supports it)
      const validModelTiers: ModelSubscriptionTier[] = ['free', 'basic', 'premium'];
       if (validModelTiers.includes(clientTier as ModelSubscriptionTier)) {
          modelTier = clientTier as ModelSubscriptionTier;
          // For 'basic' or other direct tiers, map status similarly to 'pro'
          const validModelStatuses: ModelSubscriptionStatus[] = ['active', 'canceled', 'past_due', 'incomplete', 'trialing'];
           if (validModelStatuses.includes(clientStatus as ModelSubscriptionStatus)) {
              modelStatus = clientStatus as ModelSubscriptionStatus;
          } else {
              logger.warn(`Subscription Sync: Invalid clientStatus '${clientStatus}' for tier '${clientTier}', user ${userId}.`);
              return next(new AppError(`Invalid status value provided for tier ${clientTier}: ${clientStatus}`, 400));
          }
      } else {
          logger.warn(`Subscription Sync: Invalid clientTier '${clientTier}' received for user ${userId}.`);
          return next(new AppError(`Invalid tier value provided: ${clientTier}. Expected 'pro' or 'free'.`, 400));
      }
    }
    // --- END OF MAPPING ---

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

// --- Other Controller Functions (Stripe related - kept as per your original structure) ---
export const createCheckoutSessionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // ... (Your existing logic, ensuring it maps planIdentifier to 'basic'/'premium' if calling the old Stripe service)
    logger.warn("Stripe createCheckoutSessionController called - verify if used/needed as RevenueCat is primary for mobile.");
    if (!isStripeConfigured()) return next(new AppError('Payment system (Stripe) is not configured', 503));
    const userId = req.user?.id;
    if (!userId) return next(new AppError('Authentication required', 401));
    const { planIdentifier, successUrl, cancelUrl } = req.body;
    if (!planIdentifier || !successUrl || !cancelUrl) return next(new AppError('planIdentifier (Stripe Price ID), successUrl, and cancelUrl are required', 400));

    let tierForStripe: 'basic' | 'premium';
    if (planIdentifier === process.env.STRIPE_PRICE_ID_BASIC_YOUR_APP) { // EXAMPLE
        tierForStripe = 'basic';
    } else if (planIdentifier === process.env.STRIPE_PRICE_ID_PREMIUM_YOUR_APP) { // EXAMPLE
        tierForStripe = 'premium';
    } else {
        logger.warn(`createCheckoutSessionController: Invalid planIdentifier '${planIdentifier}' for Stripe by user ${userId}.`);
        return next(new AppError('Invalid planIdentifier for Stripe checkout. Unknown Price ID.', 400));
    }
    try {
        const checkoutUrl = await createCheckoutSession(userId, tierForStripe, successUrl, cancelUrl);
        if (!checkoutUrl) return next(new AppError('Failed to create Stripe checkout session via service', 500));
        res.status(200).json({ checkoutUrl });
    } catch (error) {
        logger.error('Error creating Stripe checkout session:', error);
        next(new AppError('Failed to create Stripe checkout session', 500));
    }
};

export const createCustomerPortalSessionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logger.warn("Stripe createCustomerPortalSessionController called - verify if used/needed.");
    if (!isStripeConfigured()) return next(new AppError('Payment system (Stripe) is not configured', 503));
    const userId = req.user?.id;
    if (!userId) return next(new AppError('Authentication required', 401));
    const { returnUrl } = req.body;
    if (!returnUrl) return next(new AppError('Return URL is required', 400));
    try {
        const portalUrl = await createCustomerPortalSession(userId, returnUrl);
        if (!portalUrl) return next(new AppError('Failed to create Stripe customer portal session via service', 500));
        res.status(200).json({ portalUrl });
    } catch (error) {
        logger.error('Error creating Stripe customer portal session:', error);
        next(new AppError('Failed to create Stripe customer portal session', 500));
    }
};

export const cancelSubscriptionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logger.warn("Backend cancelSubscriptionController called - verify if used for Stripe or direct cancellation.");
    const userId = req.user?.id;
    if (!userId) return next(new AppError('Authentication required', 401));
    try {
        const success = await cancelSubscription(userId);
        if (!success) return next(new AppError('Failed to process subscription cancellation request', 500));
        res.status(200).json({ message: 'Subscription cancellation request processed. Status will reflect at the end of the current billing period.'});
    } catch (error) {
        logger.error('Error canceling subscription in controller:', error);
        next(new AppError('Failed to cancel subscription', 500));
    }
};