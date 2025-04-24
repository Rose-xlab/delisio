"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancellationRoutes = exports.cleanupRequest = exports.cancelRequest = exports.isRequestCancelled = exports.registerRequest = void 0;
const logger_1 = require("../utils/logger");
// In-memory store to track cancellation status of recipe generations
const activeRequests = new Map();
/**
 * Register a new generation request
 * @param requestId Unique ID for the generation request
 * @returns The request ID
 */
const registerRequest = (requestId) => {
    activeRequests.set(requestId, {
        cancelled: false,
        timestamp: Date.now()
    });
    logger_1.logger.info(`Registered new generation request: ${requestId}`);
    return requestId;
};
exports.registerRequest = registerRequest;
/**
 * Check if a generation request has been cancelled
 * @param requestId The request ID to check
 * @returns True if the request has been cancelled
 */
const isRequestCancelled = (requestId) => {
    const request = activeRequests.get(requestId);
    if (!request) {
        logger_1.logger.warn(`Request ID not found in tracking system: ${requestId}`);
        return false; // If not found, assume not cancelled
    }
    logger_1.logger.debug(`Checking cancellation status for ${requestId}: ${request.cancelled}`);
    return request.cancelled;
};
exports.isRequestCancelled = isRequestCancelled;
/**
 * Cancel a generation request
 * @param requestId The request ID to cancel
 * @returns True if the request was found and cancelled, false otherwise
 */
const cancelRequest = (requestId) => {
    const request = activeRequests.get(requestId);
    if (!request) {
        logger_1.logger.warn(`Attempted to cancel non-existent request: ${requestId}`);
        return false;
    }
    request.cancelled = true;
    request.timestamp = Date.now(); // Update timestamp for cleanup tracking
    logger_1.logger.info(`Cancelled generation request: ${requestId}`);
    return true;
};
exports.cancelRequest = cancelRequest;
/**
 * Clean up completed request data
 * @param requestId The request ID to clean up
 */
const cleanupRequest = (requestId) => {
    const wasDeleted = activeRequests.delete(requestId);
    if (wasDeleted) {
        logger_1.logger.debug(`Cleaned up generation request: ${requestId}`);
    }
    else {
        logger_1.logger.warn(`Attempted to clean up non-existent request: ${requestId}`);
    }
};
exports.cleanupRequest = cleanupRequest;
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
        logger_1.logger.info(`Cancellation middleware cleanup ran, removed ${cleanedCount} old requests. Remaining active requests: ${activeRequests.size}`);
    }
    else {
        logger_1.logger.debug(`Cancellation middleware cleanup ran, no old requests to remove. Active requests: ${activeRequests.size}`);
    }
}, 15 * 60 * 1000); // Run every 15 minutes
/**
 * Express middleware to handle recipe generation cancellation
 */
const cancellationRoutes = (req, res, next) => {
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
        logger_1.logger.info(`Received cancellation request for requestId: ${requestId}`);
        const cancelled = (0, exports.cancelRequest)(requestId);
        return res.status(200).json({
            success: cancelled,
            message: cancelled
                ? 'Recipe generation cancellation request received'
                : 'Request ID not found or already completed'
        });
    }
    next();
};
exports.cancellationRoutes = cancellationRoutes;
//# sourceMappingURL=cancellationMiddleware.js.map