"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // Load environment variables for this worker process
const logger_1 = require("../utils/logger");
// Import only the specific worker instance needed for this process
const recipeQueue_1 = require("../queues/recipeQueue");
// We also need access to the QueueEvents instance used by this worker
// Assuming it's exported from recipeQueue.ts or accessible otherwise.
// Let's refine the export in recipeQueue.ts if needed.
// --- Refinement: Ensure imageQueueEvents is exported from recipeQueue.ts ---
// Modify src/queues/recipeQueue.ts to add: export { imageQueueEvents };
// Then import it here:
const recipeQueue_2 = require("../queues/recipeQueue"); // Adjust path if needed
// Import Sentry for this worker
const sentry_1 = require("../config/sentry");
// Initialize Sentry for this worker
const Sentry = (0, sentry_1.initWorkerSentry)('recipe-worker');
logger_1.logger.info('Recipe worker process started...');
// The recipeWorker instance imported above handles connecting to Redis
// and processing jobs from the 'recipe-generation' queue.
// Graceful shutdown handling for this specific worker process
const gracefulShutdown = async () => {
    logger_1.logger.info('[Worker] Shutting down recipe worker process...');
    try {
        // Close both the worker and the queue events listener it uses
        await Promise.all([
            recipeQueue_1.recipeWorker.close(),
            recipeQueue_2.imageQueueEvents.close() // Close the events listener too
        ]);
        logger_1.logger.info('[Worker] Recipe worker and imageQueueEvents connection closed.');
    }
    catch (e) {
        logger_1.logger.error('[Worker] Error closing recipe worker or events:', e);
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
//# sourceMappingURL=recipe.worker.js.map