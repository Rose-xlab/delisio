import { Request, Response, NextFunction } from 'express';
/**
 * Get dashboard statistics
 */
export declare const getStats: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get trends data for charts
 */
export declare const getTrends: (req: Request, res: Response, next: NextFunction) => Promise<void>;
