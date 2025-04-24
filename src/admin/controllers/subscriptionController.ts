import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorMiddleware';
import { logger } from '../../utils/logger';
//import * as subscriptionService from '../services/subscriptionService';
import * as subscriptionService from '../services/subscriptionServiceFix';


/**
 * Get subscription tiers overview
 */
export const getTiersOverview = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const tiers = await subscriptionService.getSubscriptionTiersOverview();
    res.status(200).json(tiers);
  } catch (error) {
    logger.error('Error getting subscription tiers overview:', error);
    next(new AppError('Failed to fetch subscription tiers data', 500));
  }
};

/**
 * Get revenue metrics
 */
export const getRevenueMetrics = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const period = req.query.period as string || '30d';
    
    const revenue = await subscriptionService.getRevenueMetrics(period);
    
    res.status(200).json(revenue);
  } catch (error) {
    logger.error('Error getting revenue metrics:', error);
    next(new AppError('Failed to fetch revenue metrics', 500));
  }
};

/**
 * Get churn analysis
 */
export const getChurnAnalysis = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const period = req.query.period as string || '90d';
    
    const churn = await subscriptionService.getChurnAnalysis(period);
    
    res.status(200).json(churn);
  } catch (error) {
    logger.error('Error getting churn analysis:', error);
    next(new AppError('Failed to fetch churn analysis', 500));
  }
};

/**
 * Get tier conversion rates
 */
export const getConversionRates = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const conversions = await subscriptionService.getConversionRates();
    
    res.status(200).json(conversions);
  } catch (error) {
    logger.error('Error getting conversion rates:', error);
    next(new AppError('Failed to fetch conversion rates', 500));
  }
};