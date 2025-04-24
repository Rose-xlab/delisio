import { Request, Response, NextFunction } from 'express';
/**
 * Get subscription tiers overview
 */
export declare const getTiersOverview: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get revenue metrics
 */
export declare const getRevenueMetrics: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get churn analysis
 */
export declare const getChurnAnalysis: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get tier conversion rates
 */
export declare const getConversionRates: (req: Request, res: Response, next: NextFunction) => Promise<void>;
