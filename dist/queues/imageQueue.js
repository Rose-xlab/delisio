"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.imageWorker = exports.imageQueue = void 0;
// src/queues/imageQueue.ts
const bullmq_1 = require("bullmq");
const axios_1 = __importDefault(require("axios"));
const buffer_1 = require("buffer");
const redis_1 = require("../config/redis");
const dalleService_1 = require("../services/dalleService");
const supabaseService_1 = require("../services/supabaseService");
const logger_1 = require("../utils/logger");
// --- IMPORT THE REFACTORED FUNCTION ---
// Import from the new service file location
const recipeUpdateService_1 = require("../services/recipeUpdateService"); // Adjust path as needed
// --- Queue Definition ---
const QUEUE_NAME = 'image-generation'; // Ensure this matches QueueEvents in recipeQueue.ts
const CONNECTION_OPTIONS = {
    connection: redis_1.redisClient,
    prefix: 'delisio_image_' // Ensure this matches QueueEvents in recipeQueue.ts
};
// Export the Queue instance for potential use elsewhere (e.g., recipeQueue)
exports.imageQueue = new bullmq_1.Queue(QUEUE_NAME, {
    ...CONNECTION_OPTIONS,
    defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: 1000,
        attempts: 4,
        backoff: { type: 'exponential', delay: 3000 }
    }
});
// --- Worker Definition ---
// Define the processor function separately
const processImageJob = async (job) => {
    logger_1.logger.info(`[Worker] Image Processor function ENTERED for job: ${job.id}`);
    const { prompt, recipeId, stepIndex, requestId, recipeData, subscriptionTier } = job.data;
    await job.log(`Starting image generation for recipe ${recipeId}, step ${stepIndex}`);
    logger_1.logger.info(`Processing image job`, { jobId: job.id, recipeId, stepIndex });
    try {
        await job.updateProgress(10);
        // Step 1: Generate image (with retries)
        logger_1.logger.info(`[Job ${job.id}] Generating image...`, { prompt });
        let tempImageUrl = null;
        let retryCount = 0;
        const maxRetries = 3;
        let lastError = null;
        while (retryCount < maxRetries && !tempImageUrl) {
            try {
                if (retryCount > 0) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    await job.log(`Retrying image generation (attempt ${retryCount + 1}/${maxRetries}) after ${delay / 1000}s delay`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                // Pass the subscription tier to the image generation service
                tempImageUrl = await (0, dalleService_1.generateImage)(prompt, subscriptionTier);
                if (!tempImageUrl)
                    throw new Error('No URL returned from image generation service');
            }
            catch (err) {
                lastError = err;
                retryCount++;
                if (retryCount >= maxRetries)
                    await job.log(`All ${maxRetries} image generation attempts failed.`);
            }
        }
        if (!tempImageUrl) {
            await job.log('Image generation failed: ' + (lastError?.message || 'No URL returned'));
            throw lastError || new Error('Failed to generate image after all retries');
        }
        await job.updateProgress(50);
        await job.log(`Generated temp URL: ${tempImageUrl}`);
        // Step 2: Download image (with retries)
        logger_1.logger.info(`[Job ${job.id}] Downloading image...`);
        let imageData = null;
        retryCount = 0;
        lastError = null;
        while (retryCount < maxRetries && !imageData) {
            try {
                if (retryCount > 0) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    await job.log(`Retrying image download (attempt ${retryCount + 1}/${maxRetries}) after ${delay / 1000}s delay`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                const imageResponse = await axios_1.default.get(tempImageUrl, { responseType: 'arraybuffer', timeout: 30000 });
                imageData = buffer_1.Buffer.from(imageResponse.data);
                if (!imageData || imageData.length === 0)
                    throw new Error('Downloaded image data is empty');
            }
            catch (err) {
                lastError = err;
                retryCount++;
                if (retryCount >= maxRetries)
                    await job.log(`All ${maxRetries} image download attempts failed.`);
            }
        }
        if (!imageData) {
            await job.log('Image download failed: ' + (lastError?.message || 'Empty data received'));
            throw lastError || new Error('Failed to download image after all retries');
        }
        await job.updateProgress(75);
        await job.log(`Downloaded image data (${imageData.length} bytes).`);
        // Step 3: Upload image (with retries)
        logger_1.logger.info(`[Job ${job.id}] Uploading image...`);
        const filePath = `public/steps/${recipeId}/${stepIndex}.png`;
        let permanentUrl = null;
        retryCount = 0;
        lastError = null;
        while (retryCount < maxRetries && !permanentUrl) {
            try {
                if (retryCount > 0) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    await job.log(`Retrying image upload (attempt ${retryCount + 1}/${maxRetries}) after ${delay / 1000}s delay`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                permanentUrl = await (0, supabaseService_1.uploadImageToStorage)(imageData, filePath, 'image/png');
                if (!permanentUrl)
                    throw new Error('No permanent URL returned after storage upload');
            }
            catch (err) {
                lastError = err;
                retryCount++;
                if (retryCount >= maxRetries)
                    await job.log(`All ${maxRetries} image upload attempts failed.`);
            }
        }
        if (!permanentUrl) {
            await job.log('Image upload failed: ' + (lastError?.message || 'No URL returned'));
            throw lastError || new Error('Failed to upload image after all retries');
        }
        await job.updateProgress(100);
        await job.log(`Uploaded image successfully: ${permanentUrl}`);
        // Step 4: Update partial recipe (using REFACTORED function from service)
        // This informs the cache that this step's image is ready
        if (requestId && recipeData) {
            // Call the refactored function (no 'req' needed)
            (0, recipeUpdateService_1.updatePartialRecipe)(requestId, recipeData, stepIndex, permanentUrl)
                .then(() => logger_1.logger.info(`[Job ${job.id}] Updated partial recipe step ${stepIndex} with image URL`))
                .catch(e => logger_1.logger.error(`Failed updating partial recipe step ${stepIndex}`, { error: e }));
        }
        logger_1.logger.info(`[Job ${job.id}] Image processing completed successfully.`);
        // Return the necessary info for the waiting recipeWorker
        return { imageUrl: permanentUrl, stepIndex, requestId };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await job.log(`ERROR: ${errorMessage}`);
        logger_1.logger.error(`Error processing image job`, { jobId: job.id, error: errorMessage });
        // Attempt update on failure (using REFACTORED function)
        // Pass null for imageUrl to indicate failure for this step
        if (requestId && recipeData && stepIndex !== undefined) {
            (0, recipeUpdateService_1.updatePartialRecipe)(requestId, recipeData, stepIndex, null) // Pass null URL
                .catch(updateErr => logger_1.logger.error(`Failed to update partial recipe after job failure`, { error: updateErr }));
        }
        // Return error but include stepIndex and requestId for context
        return { error: errorMessage, stepIndex, requestId };
    }
};
// Create the worker instance (intended to be imported ONLY by the worker process)
exports.imageWorker = new bullmq_1.Worker(QUEUE_NAME, processImageJob, // Pass the processor function
{
    connection: redis_1.redisClient,
    prefix: CONNECTION_OPTIONS.prefix,
    concurrency: process.env.IMAGE_WORKER_CONCURRENCY ? parseInt(process.env.IMAGE_WORKER_CONCURRENCY, 10) : 2,
    stalledInterval: 45000,
    lockDuration: 180000,
    lockRenewTime: 60000,
});
// --- Worker Event Handlers (Attached to the exported worker) ---
exports.imageWorker.on('completed', (job, result) => {
    if (result.error)
        logger_1.logger.warn(`Image job completed with error state`, { jobId: job.id, error: result.error });
    else
        logger_1.logger.info(`Image job completed successfully`, { jobId: job.id, imageUrl: result.imageUrl });
});
exports.imageWorker.on('failed', (job, err) => {
    if (job)
        logger_1.logger.error(`Image job failed`, { jobId: job.id, error: err.message, stack: err.stack });
    else
        logger_1.logger.error(`An image job failed (job details unavailable)`, { error: err.message, stack: err.stack });
});
exports.imageWorker.on('error', (err) => {
    if (err.message.includes('rate limit') || err.message.includes('429'))
        logger_1.logger.warn(`Image worker potentially rate limited: ${err.message}.`);
    else
        logger_1.logger.error('Image worker error:', { error: err.message, stack: err.stack });
});
exports.imageWorker.on('progress', (job, progress) => logger_1.logger.debug(`Image job progress: ${JSON.stringify(progress)}`, { jobId: job.id }));
exports.imageWorker.on('ready', () => logger_1.logger.info('Image queue worker process connected to Redis.'));
exports.imageWorker.on('closing', () => logger_1.logger.warn('Image worker is closing connection to Redis.'));
exports.imageWorker.on('closed', () => logger_1.logger.warn('Image worker has closed connection to Redis.'));
exports.imageWorker.on('drained', () => logger_1.logger.info('Image queue is drained - all jobs processed.'));
exports.imageWorker.on('stalled', (jobId, prev) => logger_1.logger.warn(`Image job stalled`, { jobId, previousState: prev }));
// No default export, use named exports: import { imageQueue, imageWorker } from '...'
//# sourceMappingURL=imageQueue.js.map