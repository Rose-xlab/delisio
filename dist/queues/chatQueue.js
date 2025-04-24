"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWorker = exports.chatQueue = void 0;
// src/queues/chatQueue.ts
const bullmq_1 = require("bullmq"); // Keep QueueScheduler import if you uncomment its usage
const redis_1 = require("../config/redis");
const gptService_1 = require("../services/gptService"); // Assuming this service exists and works
const logger_1 = require("../utils/logger");
// Connection options - optimized for cloud Redis
const CONNECTION_OPTIONS = {
    connection: redis_1.redisClient,
    // Add a prefix to make queue names unique in shared Redis
    prefix: 'delisio_chat_' // Ensure this matches any worker prefix if set separately
};
// Create chat message queue
// Specifying the Job Name literal type 'process-message'
exports.chatQueue = new bullmq_1.Queue('chat-messages', // This is the Queue's name
{
    ...CONNECTION_OPTIONS,
    defaultJobOptions: {
        // These are valid DefaultJobOptions
        removeOnComplete: 100,
        removeOnFail: 200,
        attempts: 3, // Increased from 2 to be more resilient for cloud Redis
        backoff: {
            type: 'exponential',
            delay: 2000 // Increased from 1000ms to account for network latency
        },
    }
});
// Create a worker to process chat messages
// Worker listens to 'chat-messages' queue and processes jobs named 'process-message'
const chatWorker = new bullmq_1.Worker('chat-messages', // Must match the Queue's name
async (job) => {
    // --- ADDED LOG TO CHECK IF FUNCTION IS ENTERED ---
    logger_1.logger.info(`[Worker] Processor function ENTERED for job: ${job.id}`);
    // --- END ADDITION ---
    const { message, conversationId, messageHistory } = job.data;
    const startTime = Date.now();
    logger_1.logger.info(`[Worker] Processing chat message job STARTED`, { jobId: job.id, conversationId });
    try {
        await job.updateProgress(10);
        logger_1.logger.info(`[Worker] Calling generateChatResponse...`, { jobId: job.id });
        const callStartTime = Date.now();
        const chatJsonResponse = await (0, gptService_1.generateChatResponse)(message, messageHistory); // <-- The potentially slow part
        const callEndTime = Date.now();
        logger_1.logger.info(`[Worker] generateChatResponse returned. Duration: ${callEndTime - callStartTime}ms`, { jobId: job.id });
        await job.updateProgress(80);
        logger_1.logger.info(`[Worker] Parsing response...`, { jobId: job.id });
        let responseData;
        try {
            responseData = JSON.parse(chatJsonResponse);
        }
        catch (parseError) {
            logger_1.logger.error(`[Worker] Failed to parse JSON response`, { jobId: job.id, error: parseError, rawResponse: chatJsonResponse });
            throw new Error('Invalid JSON response from chat service');
        }
        logger_1.logger.info(`[Worker] Response parsed successfully.`, { jobId: job.id });
        await job.updateProgress(100);
        // Validate response structure
        if (typeof responseData?.reply !== 'string') { // Safe access
            logger_1.logger.error(`[Worker] Invalid chat response format, missing 'reply'`, { jobId: job.id, responseData });
            throw new Error('Invalid chat response format: missing or invalid reply field');
        }
        const endTime = Date.now();
        logger_1.logger.info(`[Worker] Processing chat message job COMPLETED SUCCESSFULLY. Total Duration: ${endTime - startTime}ms`, { jobId: job.id });
        // Return success result matching ChatJobResult
        return {
            reply: responseData.reply,
            suggestions: Array.isArray(responseData.suggestions) ? responseData.suggestions : null
        };
    }
    catch (error) {
        const endTime = Date.now();
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error(`[Worker] Error processing chat message job. Total Duration: ${endTime - startTime}ms`, { jobId: job.id, error: errorMessage });
        // Return error result matching ChatJobResult
        return {
            reply: `I'm sorry, I encountered an error while processing your message. Please try again later.`,
            error: errorMessage
        };
    }
}, {
    connection: redis_1.redisClient, // Uses the shared configured client
    prefix: CONNECTION_OPTIONS.prefix, // Ensure worker uses the same prefix
    concurrency: process.env.CHAT_WORKER_CONCURRENCY ? parseInt(process.env.CHAT_WORKER_CONCURRENCY, 10) : 3,
    stalledInterval: 30000,
    lockDuration: 60000,
    lockRenewTime: 30000,
});
exports.chatWorker = chatWorker;
// --- Worker Event Handlers ---
chatWorker.on('completed', (job, result) => {
    if (result.error) {
        logger_1.logger.warn(`[Worker] Chat job completed with handled error state`, { jobId: job.id, error: result.error });
    }
    else {
        logger_1.logger.info(`[Worker] Chat job completed successfully event received`, { jobId: job.id });
    }
});
chatWorker.on('failed', (job, err) => {
    if (job) {
        logger_1.logger.error(`[Worker] Chat job failed event received`, { jobId: job.id, error: err.message, stack: err.stack, data: job.data });
    }
    else {
        logger_1.logger.error(`[Worker] A chat job failed event received (job details unavailable)`, { error: err.message, stack: err.stack });
    }
});
chatWorker.on('error', (err) => {
    logger_1.logger.error('[Worker] Chat worker instance encountered an error:', { error: err.message, stack: err.stack });
});
chatWorker.on('ready', () => {
    // This log will now appear when the *dedicated worker process* connects
    logger_1.logger.info('[Worker] Chat queue worker process connected to Redis.');
});
chatWorker.on('closing', () => { logger_1.logger.warn('[Worker] Chat worker is closing connection to Redis.'); });
chatWorker.on('closed', () => { logger_1.logger.warn('[Worker] Chat worker has closed connection to Redis.'); });
chatWorker.on('drained', () => { logger_1.logger.info('[Worker] Chat queue is drained - all jobs processed.'); });
// Default export the queue instance for the API server/controllers
exports.default = exports.chatQueue;
//# sourceMappingURL=chatQueue.js.map