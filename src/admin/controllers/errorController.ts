import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorMiddleware';
import { logger } from '../../utils/logger';
import * as errorService from '../services/errorService';

/**
 * Get error trends from Sentry
 */
export const getErrorTrends = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const period = req.query.period as string || '7d';
    
    const trends = await errorService.getSentryErrorTrends(period);
    
    res.status(200).json(trends);
  } catch (error) {
    logger.error('Error getting error trends from Sentry:', error);
    next(new AppError('Failed to fetch error trends', 500));
  }
};

/**
 * Get most frequent errors from Sentry
 */
export const getFrequentErrors = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    const errors = await errorService.getSentryFrequentErrors(limit);
    
    res.status(200).json(errors);
  } catch (error) {
    logger.error('Error getting frequent errors from Sentry:', error);
    next(new AppError('Failed to fetch frequent errors', 500));
  }
};

/**
 * Get user impact assessment from Sentry
 */
export const getUserImpact = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const impact = await errorService.getSentryUserImpact();
    
    res.status(200).json(impact);
  } catch (error) {
    logger.error('Error getting user impact from Sentry:', error);
    next(new AppError('Failed to fetch user impact assessment', 500));
  }
};