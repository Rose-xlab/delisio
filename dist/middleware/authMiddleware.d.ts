import { Request, Response, NextFunction } from 'express';
/**
 * Extend Express Request interface to include user property
 */
declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}
/**
 * Middleware to check if user is authenticated
 */
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Optional authentication middleware
 * Does not reject if no token or invalid token, just doesn't set req.user
 */
export declare const optionalAuthenticate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
