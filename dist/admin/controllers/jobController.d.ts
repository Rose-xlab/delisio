import { Request, Response, NextFunction } from 'express';
/**
 * Get status of all queues
 */
export declare const getQueueStatus: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get failed jobs with pagination
 */
export declare const getFailedJobs: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Retry a failed job
 */
export declare const retryJob: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Cancel a job
 */
export declare const cancelJob: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Get performance metrics for jobs
 */
export declare const getPerformanceMetrics: (req: Request, res: Response, next: NextFunction) => Promise<void>;
