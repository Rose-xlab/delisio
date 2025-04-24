"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisClient = void 0;
// src/config/redis.ts
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
// Get Redis connection string from environment
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
// Create Redis client
const createRedisClient = () => {
    try {
        // Parse the URL to determine if it's an Upstash URL
        const isUpstash = redisUrl.includes('upstash.io');
        const redis = new ioredis_1.default(redisUrl, {
            // --- CORRECTED LINE ---
            maxRetriesPerRequest: null, // Set this to null for BullMQ Worker compatibility
            // --- END CORRECTION ---
            enableReadyCheck: true,
            // Add TLS configuration for Upstash
            tls: isUpstash ? { rejectUnauthorized: false } : undefined,
            retryStrategy(times) {
                // Keep your retry strategy for connection attempts, this is different
                if (times > 3) {
                    logger_1.logger.error('Redis connection failed after 3 retries');
                    return null;
                }
                // Exponential backoff: 100ms, 200ms, 400ms
                return Math.min(times * 100, 3000);
            },
        });
        redis.on('connect', () => {
            logger_1.logger.info('Redis client connected successfully to ' +
                (isUpstash ? 'Upstash' : 'local') + ' Redis');
        });
        redis.on('error', (err) => {
            logger_1.logger.error('Redis connection error:', err);
        });
        return redis;
    }
    catch (error) {
        logger_1.logger.error('Error creating Redis client:', error);
        throw new Error('Failed to initialize Redis client');
    }
};
// Export the Redis connection factory
exports.redisClient = createRedisClient();
//# sourceMappingURL=redis.js.map