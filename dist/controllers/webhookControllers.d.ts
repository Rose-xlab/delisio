import { Request, Response, NextFunction } from 'express';
/**
 * Handle Stripe webhook events
 */
export declare const handleStripeWebhook: (req: Request, res: Response, next: NextFunction) => Promise<void>;
