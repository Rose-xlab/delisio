// workers/chat.worker.ts
import dotenv from 'dotenv';
dotenv.config(); // Load environment variables for this worker process

// --- VERY EARLY LOG ---
console.log('[ChatWorker_DirectConsole] Worker process starting up...'); // Raw console log

import { logger } from '../utils/logger';
// Import only the specific worker instance needed for this process
import { chatWorker } from '../queues/chatQueue'; // This will also execute code in chatQueue.ts
// Import Sentry for this worker
import { initWorkerSentry } from '../config/sentry';

// --- LOG BEFORE SENTRY INIT ---
logger.info('[ChatWorker_Logger] Logger initialized. Attempting Sentry initialization...');
console.log('[ChatWorker_DirectConsole] Logger initialized via logger.info. Attempting Sentry init...');

// Initialize Sentry for this worker
const Sentry = initWorkerSentry('chat-worker');

// --- LOGS AND TEST AFTER SENTRY INIT ---
logger.info('[ChatWorker_Logger] Sentry initialized for chat-worker.');
console.log('[ChatWorker_DirectConsole] Sentry initialized for chat-worker.');

try {
  logger.info('[ChatWorker_Logger] Attempting to send a test message to Sentry...');
  console.log('[ChatWorker_DirectConsole] Attempting to send a test message to Sentry...');
  Sentry.captureMessage('Chat worker Sentry test message - startup', 'info');
  logger.info('[ChatWorker_Logger] Sentry test message sent.');
  console.log('[ChatWorker_DirectConsole] Sentry test message sent.');
} catch (sentryError) {
  logger.error('[ChatWorker_Logger] FAILED to send Sentry test message:', sentryError);
  console.error('[ChatWorker_DirectConsole] FAILED to send Sentry test message:', sentryError);
}
// --- END SENTRY TEST ---


logger.info('Chat worker process successfully started and Sentry initialized. BullMQ worker logic will now run.');
console.log('[ChatWorker_DirectConsole] Chat worker process successfully started and Sentry initialized. BullMQ worker logic will now run.');

// The chatWorker instance imported above handles connecting to Redis
// and processing jobs from the 'chat-messages' queue.
// Its event handlers (like 'ready', 'error', 'failed') in chatQueue.ts should also log.

// Graceful shutdown handling for this specific worker process
const gracefulShutdown = async () => {
  logger.info('[ChatWorker_Logger] Shutting down chat worker process (gracefulShutdown called)...');
  console.log('[ChatWorker_DirectConsole] Shutting down chat worker process (gracefulShutdown called)...');
  try {
    // Close the BullMQ worker connection gracefully
    await chatWorker.close(); // Ensure chatWorker is the actual BullMQ worker instance
    logger.info('[ChatWorker_Logger] Chat worker connection closed.');
    console.log('[ChatWorker_DirectConsole] Chat worker connection closed.');
  } catch(e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    logger.error('[ChatWorker_Logger] Error closing chat worker:', { error: errorMessage, stack: e instanceof Error ? e.stack : undefined });
    console.error('[ChatWorker_DirectConsole] Error closing chat worker:', e);
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
  const reasonMessage = reason instanceof Error ? reason.message : String(reason);
  logger.error('[ChatWorker_Logger] Unhandled Rejection at:', { promise, reason: reasonMessage, stack: reason instanceof Error ? reason.stack : undefined });
  console.error('[ChatWorker_DirectConsole] Unhandled Rejection at:', promise, reason);
  // Send to Sentry
  Sentry.captureException(reason || new Error('Unhandled Rejection with no reason provided'));
  // Consider exiting process on critical unhandled errors, but be careful in prod
  // process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('[ChatWorker_Logger] Uncaught Exception thrown:', { error: error.message, stack: error.stack });
  console.error('[ChatWorker_DirectConsole] Uncaught Exception thrown:', error);
  // Send to Sentry
  Sentry.captureException(error);
  // For uncaught exceptions, it's often recommended to exit,
  // as the application might be in an inconsistent state.
  // process.exit(1); // Consider the implications before enabling this in production.
});
