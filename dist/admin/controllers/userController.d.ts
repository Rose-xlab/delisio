import { Request, Response, NextFunction } from 'express';
/**
 * Get paginated list of users with filters
 */
export declare const getUsers: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get detailed information about a specific user
 */
export declare const getUserDetails: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Update a user's subscription
 */
export declare const updateUserSubscription: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Reset a user's usage limits
 */
export declare const resetUserLimits: (req: Request, res: Response, next: NextFunction) => Promise<void>;
