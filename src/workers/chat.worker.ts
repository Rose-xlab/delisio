import dotenv from 'dotenv';
dotenv.config(); // Load environment variables for this worker process

import { logger } from '../utils/logger';
// Import only the specific worker instance needed for this process
import { chatWorker } from '../queues/chatQueue';
// Import Sentry for this worker
import { initWorkerSentry } from '../config/sentry';

// Initialize Sentry for this worker
const Sentry = initWorkerSentry('chat-worker');

logger.info('Chat worker process started...');

// The chatWorker instance imported above handles connecting to Redis
// and processing jobs from the 'chat-messages' queue.

// Graceful shutdown handling for this specific worker process
const gracefulShutdown = async () => {
  logger.info('[Worker] Shutting down chat worker process...');
  try {
    // Close the BullMQ worker connection gracefully
    await chatWorker.close();
    logger.info('[Worker] Chat worker connection closed.');
  } catch(e) {
    logger.error('[Worker] Error closing chat worker:', e);
    // Capture exception in Sentry
    Sentry.captureException(e);
  }
  process.exit(0);
};

// Listen for termination signals
process.on('SIGINT', gracefulShutdown); // Ctrl+C
process.on('SIGTERM', gracefulShutdown); // Docker stop, kill, etc.

// Optional: Keep the process alive explicitly if needed,
// although the worker's blocking connection usually does this.
// setInterval(() => {}, 1 << 30); // Keeps node running

// Optional: Add unhandled rejection/exception handlers for robustness
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  // Send to Sentry
  Sentry.captureException(reason);
  // Consider exiting process on critical unhandled errors
  // process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error });
  // Send to Sentry
  Sentry.captureException(error);
  // Consider exiting process on critical unhandled errors
  // process.exit(1);
});