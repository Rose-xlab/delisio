// src/middleware/cancellationMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Store for active generation requests
// Map: requestId -> { cancelled: boolean, timestamp: number }
interface RequestStatus {
  cancelled: boolean;
  timestamp: number; // Add timestamp for cleanup purposes
}

// In-memory store to track cancellation status of recipe generations
const activeRequests: Map<string, RequestStatus> = new Map();

/**
 * Register a new generation request
 * @param requestId Unique ID for the generation request
 * @returns The request ID
 */
export const registerRequest = (requestId: string): string => {
  activeRequests.set(requestId, { 
    cancelled: false,
    timestamp: Date.now()
  });
  logger.info(`Registered new generation request: ${requestId}`);
  return requestId;
};

/**
 * Check if a generation request has been cancelled
 * @param requestId The request ID to check
 * @returns True if the request has been cancelled
 */
export const isRequestCancelled = (requestId: string): boolean => {
  const request = activeRequests.get(requestId);
  if (!request) {
    logger.warn(`Request ID not found in tracking system: ${requestId}`);
    return false; // If not found, assume not cancelled
  }
  logger.debug(`Checking cancellation status for ${requestId}: ${request.cancelled}`);
  return request.cancelled;
};

/**
 * Cancel a generation request
 * @param requestId The request ID to cancel
 * @returns True if the request was found and cancelled, false otherwise
 */
export const cancelRequest = (requestId: string): boolean => {
  const request = activeRequests.get(requestId);
  if (!request) {
    logger.warn(`Attempted to cancel non-existent request: ${requestId}`);
    return false;
  }
  
  request.cancelled = true;
  request.timestamp = Date.now(); // Update timestamp for cleanup tracking
  logger.info(`Cancelled generation request: ${requestId}`);
  return true;
};

/**
 * Clean up completed request data
 * @param requestId The request ID to clean up
 */
export const cleanupRequest = (requestId: string): void => {
  const wasDeleted = activeRequests.delete(requestId);
  if (wasDeleted) {
    logger.debug(`Cleaned up generation request: ${requestId}`);
  } else {
    logger.warn(`Attempted to clean up non-existent request: ${requestId}`);
  }
};

// Clean up old requests every 15 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const fifteenMinutesAgo = now - (15 * 60 * 1000); // 15 minutes in milliseconds
  
  let cleanedCount = 0;
  for (const [requestId, status] of activeRequests.entries()) {
    if (status.timestamp < fifteenMinutesAgo) {
      activeRequests.delete(requestId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info(`Cancellation middleware cleanup ran, removed ${cleanedCount} old requests. Remaining active requests: ${activeRequests.size}`);
  } else {
    logger.debug(`Cancellation middleware cleanup ran, no old requests to remove. Active requests: ${activeRequests.size}`);
  }
}, 15 * 60 * 1000); // Run every 15 minutes

/**
 * Express middleware to handle recipe generation cancellation
 */
export const cancellationRoutes = (req: Request, res: Response, next: NextFunction) => {
  // Handle cancellation endpoint
  if (req.method === 'POST' && req.path === '/api/recipes/cancel') {
    const { requestId } = req.body;
    
    if (!requestId) {
      return res.status(400).json({
        error: {
          message: 'requestId is required',
          status: 400
        }
      });
    }
    
    logger.info(`Received cancellation request for requestId: ${requestId}`);
    const cancelled = cancelRequest(requestId);
    
    return res.status(200).json({
      success: cancelled,
      message: cancelled 
        ? 'Recipe generation cancellation request received' 
        : 'Request ID not found or already completed'
    });
  }
  
  next();
};