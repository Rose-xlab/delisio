import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorMiddleware';
import { logger } from '../../utils/logger';
//import * as dashboardService from '../services/dashboardService';
import * as dashboardService from '../services/dashboardServiceFix';


/**
 * Get dashboard statistics
 */
export const getStats = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await dashboardService.getDashboardStats();
    res.status(200).json(stats);
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    next(new AppError('Failed to fetch dashboard statistics', 500));
  }
};

/**
 * Get trends data for charts
 */
export const getTrends = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const period = req.query.period as string || '30d';
    const trends = await dashboardService.getDashboardTrends(period);
    res.status(200).json(trends);
  } catch (error) {
    logger.error('Error getting dashboard trends:', error);
    next(new AppError('Failed to fetch trend data', 500));
  }
};