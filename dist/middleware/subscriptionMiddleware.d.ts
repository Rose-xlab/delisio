import { Request, Response, NextFunction } from 'express';
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
export declare const checkRecipeGenerationAllowed: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Lightweight middleware to just attach subscription info without limiting
 * Useful for routes that need tier info but shouldn't be limited
 */
export declare const attachSubscriptionInfo: (req: Request, res: Response, next: NextFunction) => Promise<void>;
