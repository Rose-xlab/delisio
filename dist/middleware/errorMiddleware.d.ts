import { Request, Response, NextFunction } from 'express';
/**
 * Custom error class with status code
 */
export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(message: string, statusCode: number);
}
/**
 * Global error handling middleware
 */
export declare const errorHandler: (err: any, req: Request, res: Response, next: NextFunction) => void;
