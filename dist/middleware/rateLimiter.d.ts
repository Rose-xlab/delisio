import { Request, Response, NextFunction } from 'express';
/**
 * Rate limiting middleware
 */
export declare const rateLimiter: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
