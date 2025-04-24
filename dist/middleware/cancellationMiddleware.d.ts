import { Request, Response, NextFunction } from 'express';
/**
 * Register a new generation request
 * @param requestId Unique ID for the generation request
 * @returns The request ID
 */
export declare const registerRequest: (requestId: string) => string;
/**
 * Check if a generation request has been cancelled
 * @param requestId The request ID to check
 * @returns True if the request has been cancelled
 */
export declare const isRequestCancelled: (requestId: string) => boolean;
/**
 * Cancel a generation request
 * @param requestId The request ID to cancel
 * @returns True if the request was found and cancelled, false otherwise
 */
export declare const cancelRequest: (requestId: string) => boolean;
/**
 * Clean up completed request data
 * @param requestId The request ID to clean up
 */
export declare const cleanupRequest: (requestId: string) => void;
/**
 * Express middleware to handle recipe generation cancellation
 */
export declare const cancellationRoutes: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
