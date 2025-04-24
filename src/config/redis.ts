// src/config/redis.ts
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get Redis connection string from environment
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis client
const createRedisClient = (): Redis => {
  try {
    // Parse the URL to determine if it's an Upstash URL
    const isUpstash = redisUrl.includes('upstash.io');

    const redis = new Redis(redisUrl, {
      // --- CORRECTED LINE ---
      maxRetriesPerRequest: null, // Set this to null for BullMQ Worker compatibility
      // --- END CORRECTION ---

      enableReadyCheck: true,
      // Add TLS configuration for Upstash
      tls: isUpstash ? { rejectUnauthorized: false } : undefined,
      retryStrategy(times: number): number | null {
        // Keep your retry strategy for connection attempts, this is different
        if (times > 3) {
          logger.error('Redis connection failed after 3 retries');
          return null;
        }
        // Exponential backoff: 100ms, 200ms, 400ms
        return Math.min(times * 100, 3000);
      },
    });

    redis.on('connect', () => {
      logger.info('Redis client connected successfully to ' +
        (isUpstash ? 'Upstash' : 'local') + ' Redis');
    });

    redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    return redis;
  } catch (error) {
    logger.error('Error creating Redis client:', error);
    throw new Error('Failed to initialize Redis client');
  }
};

// Export the Redis connection factory
export const redisClient = createRedisClient();