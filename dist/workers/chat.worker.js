"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // Load environment variables for this worker process
const logger_1 = require("../utils/logger");
// Import only the specific worker instance needed for this process
const chatQueue_1 = require("../queues/chatQueue");
// Import Sentry for this worker
const sentry_1 = require("../config/sentry");
// Initialize Sentry for this worker
const Sentry = (0, sentry_1.initWorkerSentry)('chat-worker');
logger_1.logger.info('Chat worker process started...');
// The chatWorker instance imported above handles connecting to Redis
// and processing jobs from the 'chat-messages' queue.
// Graceful shutdown handling for this specific worker process
const gracefulShutdown = async () => {
    logger_1.logger.info('[Worker] Shutting down chat worker process...');
    try {
        // Close the BullMQ worker connection gracefully
        await chatQueue_1.chatWorker.close();
        logger_1.logger.info('[Worker] Chat worker connection closed.');
    }
    catch (e) {
        logger_1.logger.error('[Worker] Error closing chat worker:', e);
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
    logger_1.logger.error('Unhandled Rejection at:', { promise, reason });
    // Send to Sentry
    Sentry.captureException(reason);
    // Consider exiting process on critical unhandled errors
    // process.exit(1);
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception thrown:', { error });
    // Send to Sentry
    Sentry.captureException(error);
    // Consider exiting process on critical unhandled errors
    // process.exit(1);
});
//# sourceMappingURL=chat.worker.js.map