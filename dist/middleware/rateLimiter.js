"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRateLimiter = exports.inMemoryRateLimiter = exports.rateLimiter = void 0;
const logger_1 = require("../utils/logger");
const redis_1 = require("../config/redis");
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
// Configuration
const WINDOW_SIZE_IN_MINUTES = 15;
// Define different limits
const MAX_REQUESTS_PER_WINDOW = {
    default: 100, // Default limit
    '/api/recipes': 15, // Recipe generation is expensive
    '/api/recipes/status': 60, // Status checks - higher limit (1 req/15 sec)
    '/api/chat': 50, // Chat is less expensive than recipes
    authenticated: 150 // Higher limit for authenticated users
};
// Creating separate Redis-based rate limiters
const createRateLimiter = (points, prefix) => {
    return new rate_limiter_flexible_1.RateLimiterRedis({
        storeClient: redis_1.redisClient,
        keyPrefix: prefix,
        points, // Maximum number of requests
        duration: WINDOW_SIZE_IN_MINUTES * 60, // Duration in seconds
        blockDuration: 60, // Block for 1 minute if exceeded
    });
};
// Create a map of rate limiters
const rateLimiters = {
    default: createRateLimiter(MAX_REQUESTS_PER_WINDOW.default, 'rlim:default:'),
    recipes: createRateLimiter(MAX_REQUESTS_PER_WINDOW['/api/recipes'], 'rlim:recipes:'),
    recipeStatus: createRateLimiter(MAX_REQUESTS_PER_WINDOW['/api/recipes/status'], 'rlim:recipes-status:'),
    chat: createRateLimiter(MAX_REQUESTS_PER_WINDOW['/api/chat'], 'rlim:chat:'),
    authenticated: createRateLimiter(MAX_REQUESTS_PER_WINDOW.authenticated, 'rlim:auth:'),
};
/**
 * Production-ready rate limiting middleware using Redis
 */
const rateLimiter = async (req, res, next) => {
    // Skip rate limiting for health checks
    if (req.path === '/health') {
        return next();
    }
    // Determine client identifier
    const clientId = req.user?.id || req.ip || 'unknown';
    // Determine which rate limiter to use based on path
    let limiter = rateLimiters.default;
    let key = `${clientId}`;
    if (req.path.startsWith('/api/recipes/status')) {
        // Special case for status checking
        limiter = rateLimiters.recipeStatus;
        key = `${clientId}:status`;
    }
    else if (req.path.startsWith('/api/recipes')) {
        limiter = rateLimiters.recipes;
        key = `${clientId}:recipes`;
    }
    else if (req.path.startsWith('/api/chat')) {
        limiter = rateLimiters.chat;
        key = `${clientId}:chat`;
    }
    // Use higher limit for authenticated users if applicable
    if (req.user && limiter !== rateLimiters.recipeStatus) {
        limiter = rateLimiters.authenticated;
        key = `${clientId}:auth`;
    }
    try {
        const rateLimiterRes = await limiter.consume(key);
        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', limiter.points.toString());
        res.setHeader('X-RateLimit-Remaining', rateLimiterRes.remainingPoints.toString());
        res.setHeader('X-RateLimit-Reset', rateLimiterRes.msBeforeNext.toString());
        next();
    }
    catch (rejRes) {
        // Rate limit exceeded
        const resetInSeconds = Math.ceil(rejRes.msBeforeNext / 1000) || 60;
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
};
exports.rateLimiter = rateLimiter;
/**
 * Fallback middleware if Redis is unavailable
 */
exports.inMemoryRateLimiter = (() => {
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
    // Return the middleware
    return (req, res, next) => {
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
        if (req.path.startsWith('/api/recipes/status')) {
            limit = MAX_REQUESTS_PER_WINDOW['/api/recipes/status'];
        }
        else if (req.path.startsWith('/api/recipes')) {
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
})();
/**
 * Export a factory function that decides which rate limiter to use
 * based on Redis availability
 */
const getRateLimiter = () => {
    if (redis_1.redisClient && redis_1.redisClient.status === 'ready') {
        logger_1.logger.info('Using Redis-based rate limiter');
        return exports.rateLimiter;
    }
    else {
        logger_1.logger.warn('Redis unavailable, falling back to in-memory rate limiter');
        return exports.inMemoryRateLimiter;
    }
};
exports.getRateLimiter = getRateLimiter;
//# sourceMappingURL=rateLimiter.js.map