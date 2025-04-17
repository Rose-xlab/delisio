"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = void 0;
const logger_1 = require("../utils/logger");
// Configuration
const WINDOW_SIZE_IN_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = {
    default: 100, // Default limit
    '/api/recipes': 15, // Recipe generation is expensive
    '/api/chat': 50, // Chat is less expensive than recipes
    authenticated: 150 // Higher limit for authenticated users
};
// In-memory store
const requestStore = {};
// Clean up old records every hour
setInterval(() => {
    const now = Date.now();
    Object.keys(requestStore).forEach(key => {
        if (requestStore[key].resetTime < now) {
            delete requestStore[key];
        }
    });
}, 60 * 60 * 1000);
/**
 * Rate limiting middleware
 */
const rateLimiter = (req, res, next) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') {
        return next();
    }
    // Determine client identifier
    const clientId = req.user?.id || req.ip || 'unknown';
    const key = `${clientId}:${req.path}`;
    // Get current timestamp
    const now = Date.now();
    // Initialize or reset record if needed
    if (!requestStore[key] || requestStore[key].resetTime < now) {
        requestStore[key] = {
            count: 0,
            resetTime: now + WINDOW_SIZE_IN_MINUTES * 60 * 1000
        };
    }
    // Increment count
    requestStore[key].count += 1;
    // Determine limit based on path and authentication status
    let limit = MAX_REQUESTS_PER_WINDOW.default;
    if (req.path.startsWith('/api/recipes')) {
        limit = MAX_REQUESTS_PER_WINDOW['/api/recipes'];
    }
    else if (req.path.startsWith('/api/chat')) {
        limit = MAX_REQUESTS_PER_WINDOW['/api/chat'];
    }
    // Higher limit for authenticated users
    if (req.user) {
        limit = Math.max(limit, MAX_REQUESTS_PER_WINDOW.authenticated);
    }
    // Check if limit exceeded
    if (requestStore[key].count > limit) {
        // Calculate reset time in seconds
        const resetInSeconds = Math.ceil((requestStore[key].resetTime - now) / 1000);
        // Log rate limit exceeded
        logger_1.logger.warn(`Rate limit exceeded for ${clientId} on ${req.path}`);
        // Send rate limit response
        return res.status(429).json({
            error: {
                message: 'Too many requests, please try again later',
                status: 429,
                retryAfter: resetInSeconds
            }
        });
    }
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', (limit - requestStore[key].count).toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(requestStore[key].resetTime / 1000).toString());
    next();
};
exports.rateLimiter = rateLimiter;
//# sourceMappingURL=rateLimiter.js.map