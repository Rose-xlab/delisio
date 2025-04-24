import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorMiddleware';
import { logger } from '../../utils/logger';
import * as jobService from '../services/jobService';

/**
 * Get status of all queues
 */
export const getQueueStatus = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const queues = await jobService.getAllQueueStats();
    res.status(200).json(queues);
  } catch (error) {
    logger.error('Error getting queue status:', error);
    next(new AppError('Failed to fetch queue status', 500));
  }
};

/**
 * Get failed jobs with pagination
 */
export const getFailedJobs = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      queue: req.query.queue as string || 'all'
    };
    
    const failedJobs = await jobService.getFailedJobs(filters);
    res.status(200).json(failedJobs);
  } catch (error) {
    logger.error('Error getting failed jobs:', error);
    next(new AppError('Failed to fetch failed jobs', 500));
  }
};

/**
 * Retry a failed job
 */
export const retryJob = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const jobId = req.params.id;
    const { queue } = req.body;
    
    if (!jobId || !queue) {
      throw new AppError('Job ID and queue name are required', 400);
    }
    
    const result = await jobService.retryJob(queue, jobId);
    
    res.status(200).json({
      success: true,
      message: `Job ${jobId} in queue ${queue} retried successfully`,
      result
    });
  } catch (error) {
    logger.error(`Error retrying job ${req.params.id}:`, error);
    
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to retry job', 500));
    }
  }
};

/**
 * Cancel a job
 */
export const cancelJob = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const jobId = req.params.id;
    const { queue } = req.body;
    
    if (!jobId || !queue) {
      throw new AppError('Job ID and queue name are required', 400);
    }
    
    const result = await jobService.cancelJob(queue, jobId);
    
    res.status(200).json({
      success: true,
      message: `Job ${jobId} in queue ${queue} cancelled successfully`,
      result
    });
  } catch (error) {
    logger.error(`Error cancelling job ${req.params.id}:`, error);
    
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to cancel job', 500));
    }
  }
};

/**
 * Get performance metrics for jobs
 */
export const getPerformanceMetrics = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const queue = req.query.queue as string || 'all';
    const period = req.query.period as string || '24h';
    
    const metrics = await jobService.getJobPerformanceMetrics(queue, period);
    
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('Error getting job performance metrics:', error);
    next(new AppError('Failed to fetch job performance metrics', 500));
  }
};