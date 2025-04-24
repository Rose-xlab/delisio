//workers\image.worker.ts

import dotenv from 'dotenv';
dotenv.config(); // Load environment variables for this worker process

import { logger } from '../utils/logger';
// Import only the specific worker instance needed for this process
import { imageWorker } from '../queues/imageQueue';
// Import Sentry for this worker
import { initWorkerSentry } from '../config/sentry';

// Initialize Sentry for this worker
const Sentry = initWorkerSentry('image-worker');

logger.info('Image worker process started...');

// The imageWorker instance imported above handles connecting to Redis
// and processing jobs from the 'image-generation' queue.

// Graceful shutdown handling for this specific worker process
const gracefulShutdown = async () => {
  logger.info('[Worker] Shutting down image worker process...');
  try {
    // Close the BullMQ worker connection gracefully
    await imageWorker.close();
    logger.info('[Worker] Image worker connection closed.');
  } catch(e) {
    logger.error('[Worker] Error closing image worker:', e);
    // Capture exception in Sentry
    Sentry.captureException(e);
  }
  process.exit(0);
};

// Listen for termination signals
process.on('SIGINT', gracefulShutdown); // Ctrl+C
process.on('SIGTERM', gracefulShutdown); // Docker stop, kill, etc.

// Optional: Keep the process alive explicitly if needed
// setInterval(() => {}, 1 << 30);

// Optional: Add unhandled rejection/exception handlers
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  // Send to Sentry
  Sentry.captureException(reason);
  // process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error });
  // Send to Sentry
  Sentry.captureException(error);
  // process.exit(1);
});