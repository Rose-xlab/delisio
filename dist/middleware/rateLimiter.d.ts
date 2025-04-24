import { Request, Response, NextFunction } from 'express';
/**
 * Production-ready rate limiting middleware using Redis
 */
export declare const rateLimiter: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Fallback middleware if Redis is unavailable
 */
export declare const inMemoryRateLimiter: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
/**
 * Export a factory function that decides which rate limiter to use
 * based on Redis availability
 */
export declare const getRateLimiter: () => ((req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>) | ((req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>);
