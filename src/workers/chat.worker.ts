// workers/chat.worker.ts
import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports
const envResult = dotenv.config();
console.log('[ChatWorker] Environment variables loaded:', envResult.error ? 'FAILED' : 'SUCCESS');
if (envResult.error) {
    console.error('[ChatWorker] Failed to load .env file:', envResult.error);
    // Don't exit immediately - environment vars might be set through other means (Docker, K8s, etc.)
}

// Log critical env vars (without exposing sensitive data)
console.log('[ChatWorker] Environment check:', {
    NODE_ENV: process.env.NODE_ENV || 'not-set',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? `Present (${process.env.OPENAI_API_KEY.substring(0, 7)}...)` : 'MISSING',
    REDIS_URL: process.env.REDIS_URL ? 'Present' : 'MISSING',
    GPT_MODEL: process.env.GPT_MODEL || 'using-default',
    CHAT_WORKER_CONCURRENCY: process.env.CHAT_WORKER_CONCURRENCY || 'using-default',
});

// Validate critical environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'REDIS_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error(`[ChatWorker] CRITICAL: Missing required environment variables: ${missingEnvVars.join(', ')}`);
    console.error('[ChatWorker] Worker cannot start without these variables. Exiting...');
    process.exit(1);
}

// Validate OpenAI API key format
if (!process.env.OPENAI_API_KEY?.startsWith('sk-')) {
    console.error('[ChatWorker] WARNING: OPENAI_API_KEY does not start with "sk-". This may not be a valid OpenAI API key.');
}

// NOW import other modules that depend on environment variables
console.log('[ChatWorker] Environment validated. Loading dependencies...');

import { logger } from '../utils/logger';
import { chatWorker } from '../queues/chatQueue';
import { initWorkerSentry } from '../config/sentry';

// Log that logger is ready
logger.info('[ChatWorker] Logger initialized successfully');

// Initialize Sentry for this worker
logger.info('[ChatWorker] Initializing Sentry...');
const Sentry = initWorkerSentry('chat-worker');
logger.info('[ChatWorker] Sentry initialized for chat-worker');

// Test Sentry integration
try {
    if (process.env.NODE_ENV === 'production') {
        logger.info('[ChatWorker] Production environment - skipping Sentry test message');
    } else {
        logger.info('[ChatWorker] Sending test message to Sentry...');
        Sentry.captureMessage('Chat worker started successfully', 'info');
        logger.info('[ChatWorker] Sentry test message sent');
    }
} catch (sentryError) {
    logger.error('[ChatWorker] Failed to send Sentry test message:', {
        error: sentryError instanceof Error ? sentryError.message : String(sentryError),
        stack: sentryError instanceof Error ? sentryError.stack : undefined
    });
}

// Log worker configuration
logger.info('[ChatWorker] Worker configuration:', {
    concurrency: process.env.CHAT_WORKER_CONCURRENCY || '3 (default)',
    queueName: 'chat-messages',
    prefix: 'delisio_chat_',
    environment: process.env.NODE_ENV || 'development',
});

logger.info('[ChatWorker] Chat worker process successfully started. Waiting for jobs...');

// Monitor worker health
let lastJobTime = Date.now();
let jobsProcessed = 0;

// Health check interval (every 5 minutes)
const healthCheckInterval = setInterval(() => {
    const timeSinceLastJob = Date.now() - lastJobTime;
    logger.info('[ChatWorker] Health check:', {
        jobsProcessed,
        timeSinceLastJob: `${Math.floor(timeSinceLastJob / 1000)}s`,
        memoryUsage: process.memoryUsage(),
        uptime: `${Math.floor(process.uptime())}s`,
    });
}, 5 * 60 * 1000);

// Track job processing
chatWorker.on('completed', (job) => {
    lastJobTime = Date.now();
    jobsProcessed++;
    logger.info(`[ChatWorker] Job completed. Total jobs processed: ${jobsProcessed}`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
    logger.info(`[ChatWorker] Received ${signal} signal. Starting graceful shutdown...`);
    
    try {
        // Stop health check
        clearInterval(healthCheckInterval);
        
        // Stop accepting new jobs
        logger.info('[ChatWorker] Pausing worker to stop accepting new jobs...');
        await chatWorker.pause();
        
        // Wait for current jobs to complete (max 30 seconds)
        logger.info('[ChatWorker] Waiting for active jobs to complete...');
        const shutdownTimeout = setTimeout(() => {
            logger.warn('[ChatWorker] Shutdown timeout reached. Force closing...');
            process.exit(1);
        }, 30000);
        
        // Close the worker connection
        await chatWorker.close();
        clearTimeout(shutdownTimeout);
        
        logger.info('[ChatWorker] Worker connection closed successfully');
        logger.info(`[ChatWorker] Final stats: ${jobsProcessed} jobs processed during this session`);
        
        // Flush Sentry
        if (Sentry) {
            logger.info('[ChatWorker] Flushing Sentry...');
            await Sentry.close(2000);
        }
        
        logger.info('[ChatWorker] Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[ChatWorker] Error during graceful shutdown:', {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
        });
        
        // Capture in Sentry before exit
        if (Sentry) {
            Sentry.captureException(error);
            await Sentry.close(1000);
        }
        
        process.exit(1);
    }
};

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker/K8s stop
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    logger.error('[ChatWorker] Unhandled Promise Rejection:', {
        reason: errorMessage,
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: String(promise)
    });
    
    // Send to Sentry
    if (Sentry) {
        Sentry.captureException(reason instanceof Error ? reason : new Error(`Unhandled rejection: ${errorMessage}`));
    }
    
    // Don't exit on unhandled rejection in production, but log it
    if (process.env.NODE_ENV !== 'production') {
        logger.error('[ChatWorker] Exiting due to unhandled rejection in non-production environment');
        gracefulShutdown('UNHANDLED_REJECTION');
    }
});

process.on('uncaughtException', (error) => {
    logger.error('[ChatWorker] Uncaught Exception:', {
        error: error.message,
        stack: error.stack
    });
    
    // Send to Sentry
    if (Sentry) {
        Sentry.captureException(error);
    }
    
    // Uncaught exceptions are critical - the process is in an unknown state
    logger.error('[ChatWorker] Exiting due to uncaught exception');
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Log successful startup
logger.info('[ChatWorker] Worker fully initialized and ready to process jobs');
console.log('[ChatWorker] Worker fully initialized and ready to process jobs');

// Optional: Log OpenAI client status (be careful not to import too early)
setTimeout(() => {
    try {
        // This import happens after env vars are loaded
        const { GPT_MODEL } = require('../services/openaiClient');
        logger.info('[ChatWorker] OpenAI configuration check:', {
            gptModel: GPT_MODEL,
            apiKeyStatus: process.env.OPENAI_API_KEY ? 'configured' : 'missing'
        });
    } catch (error) {
        logger.error('[ChatWorker] Failed to check OpenAI configuration:', error);
    }
}, 1000);