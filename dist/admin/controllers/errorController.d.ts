import { Request, Response, NextFunction } from 'express';
/**
 * Get error trends from Sentry
 */
export declare const getErrorTrends: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get most frequent errors from Sentry
 */
export declare const getFrequentErrors: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get user impact assessment from Sentry
 */
export declare const getUserImpact: (req: Request, res: Response, next: NextFunction) => Promise<void>;
