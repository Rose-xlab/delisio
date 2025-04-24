import { Request, Response, NextFunction } from 'express';
/**
 * Get user's subscription status and usage information
 */
export declare const getSubscriptionDetails: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Create a checkout session for subscription purchase
 */
export declare const createCheckoutSessionController: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Create customer portal session for managing subscription
 */
export declare const createCustomerPortalSessionController: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Cancel subscription
 */
export declare const cancelSubscriptionController: (req: Request, res: Response, next: NextFunction) => Promise<void>;
