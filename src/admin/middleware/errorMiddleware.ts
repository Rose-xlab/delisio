// middleware/errorMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Custom error class with status code
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Default error status and message
  let statusCode = 500;
  let message = 'Internal Server Error';
  let stack: string | undefined;

  // Handle AppError instances with specific status codes
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    stack = err.stack;
  } else {
    // For regular errors, preserve message but use default status code
    message = err.message || message;
    stack = err.stack;
  }

  // Log error details
  logger.error(`Error (${statusCode}): ${message}`, {
    path: req.path,
    method: req.method,
    error: stack
  });

  // Send response based on environment
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  res.status(statusCode).json({
    status: 'error',
    message,
    ...(isDevelopment && { stack: stack })
  });
};