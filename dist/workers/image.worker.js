"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // Load environment variables for this worker process
const logger_1 = require("../utils/logger");
// Import only the specific worker instance needed for this process
const imageQueue_1 = require("../queues/imageQueue");
// Import Sentry for this worker
const sentry_1 = require("../config/sentry");
// Initialize Sentry for this worker
const Sentry = (0, sentry_1.initWorkerSentry)('image-worker');
logger_1.logger.info('Image worker process started...');
// The imageWorker instance imported above handles connecting to Redis
// and processing jobs from the 'image-generation' queue.
// Graceful shutdown handling for this specific worker process
const gracefulShutdown = async () => {
    logger_1.logger.info('[Worker] Shutting down image worker process...');
    try {
        // Close the BullMQ worker connection gracefully
        await imageQueue_1.imageWorker.close();
        logger_1.logger.info('[Worker] Image worker connection closed.');
    }
    catch (e) {
        logger_1.logger.error('[Worker] Error closing image worker:', e);
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
    logger_1.logger.error('Unhandled Rejection at:', { promise, reason });
    // Send to Sentry
    Sentry.captureException(reason);
    // process.exit(1);
});
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception thrown:', { error });
    // Send to Sentry
    Sentry.captureException(error);
    // process.exit(1);
});
//# sourceMappingURL=image.worker.js.map