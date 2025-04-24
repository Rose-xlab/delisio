"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recipeWorker = exports.imageQueueEvents = exports.recipeQueue = void 0;
// src/queues/recipeQueue.ts
const bullmq_1 = require("bullmq");
// Removed axios, Buffer imports - not used directly here
const uuid_1 = require("uuid");
const redis_1 = require("../config/redis");
const gptService_1 = require("../services/gptService");
const logger_1 = require("../utils/logger");
// Import the image QUEUE instance (for adding jobs) using named import
const imageQueue_1 = require("./imageQueue");
// --- IMPORT THE REFACTORED FUNCTION ---
// Import from the new service file location
const recipeUpdateService_1 = require("../services/recipeUpdateService"); // Adjust path as needed
// --- Queue Definition ---
const QUEUE_NAME = 'recipe-generation';
const CONNECTION_OPTIONS = {
    connection: redis_1.redisClient,
    prefix: 'delisio_recipe_'
};
// Export the Queue instance
exports.recipeQueue = new bullmq_1.Queue(QUEUE_NAME, {
    ...CONNECTION_OPTIONS,
    defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 1,
    }
});
// --- QueueEvents for Image Queue ---
// Export the QueueEvents instance needed by the worker process
exports.imageQueueEvents = new bullmq_1.QueueEvents('image-generation', {
    connection: redis_1.redisClient,
    prefix: 'delisio_image_' // Must match imageQueue's prefix
});
// --- Worker Definition ---
// Define the processor function separately
const processRecipeJob = async (job) => {
    logger_1.logger.info(`[Worker] Recipe Processor function ENTERED for job: ${job.id}`);
    const { query, userPreferences, requestId, userId, save, enableProgressiveDisplay, subscriptionTier } = job.data;
    const recipeId = (0, uuid_1.v4)();
    try {
        await job.updateProgress(5);
        logger_1.logger.info(`Processing recipe job`, { jobId: job.id, requestId });
        // Initial cancel check
        await job.updateData({ ...job.data });
        if (job.data.cancelled) {
            logger_1.logger.info(`Job cancelled before start`, { jobId: job.id });
            return { cancelled: true };
        }
        // Step 1: Generate content
        logger_1.logger.info(`[Job ${job.id}] Generating content...`);
        await job.updateProgress(10);
        const recipeContent = await (0, gptService_1.generateRecipeContent)(query, userPreferences);
        await job.updateProgress(30);
        // Cancel check
        await job.updateData({ ...job.data });
        if (job.data.cancelled) {
            logger_1.logger.info(`Job cancelled after content gen`, { jobId: job.id });
            return { cancelled: true };
        }
        // Step 2: Parse
        logger_1.logger.info(`[Job ${job.id}] Parsing content...`);
        let parsedRecipeData;
        try {
            parsedRecipeData = JSON.parse(recipeContent);
        }
        catch (parseError) {
            const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
            logger_1.logger.error(`[Job ${job.id}] Failed parse JSON: ${errorMsg}`, { rawContent: recipeContent });
            throw new Error('Failed parse recipe structure from AI.');
        }
        await job.updateProgress(35);
        // Step 3: Prepare initial object
        const initialRecipe = {
            id: recipeId,
            title: parsedRecipeData.title ?? 'Untitled',
            servings: parsedRecipeData.servings ?? 4,
            ingredients: parsedRecipeData.ingredients ?? [],
            steps: (Array.isArray(parsedRecipeData.steps) ? parsedRecipeData.steps : []).map((step) => ({
                text: step?.text || '', illustration: step?.illustration, image_url: undefined
            })),
            nutrition: {
                calories: parsedRecipeData.nutrition?.calories ?? 0,
                protein: String(parsedRecipeData.nutrition?.protein ?? '0g'),
                fat: String(parsedRecipeData.nutrition?.fat ?? '0g'),
                carbs: String(parsedRecipeData.nutrition?.carbs ?? '0g'),
            },
            query: query, createdAt: new Date(), prepTime: parsedRecipeData.prepTime,
            cookTime: parsedRecipeData.cookTime, totalTime: parsedRecipeData.totalTime,
            requestId: requestId, category: parsedRecipeData.category, tags: parsedRecipeData.tags,
            quality_score: parsedRecipeData.quality_score, similarity_hash: parsedRecipeData.similarity_hash,
        };
        // Save initial data (using REFACTORED function)
        if (enableProgressiveDisplay) {
            logger_1.logger.info(`[Job ${job.id}] Saving initial recipe data...`);
            // Use the refactored function imported from the service
            (0, recipeUpdateService_1.updatePartialRecipe)(requestId, initialRecipe)
                .catch(e => logger_1.logger.error('Failed initial partial update', { error: e, requestId }));
        }
        // Step 4: Generate images
        logger_1.logger.info(`[Job ${job.id}] Generating images (${initialRecipe.steps.length} steps)...`);
        const stepsWithImages = [];
        const totalSteps = initialRecipe.steps.length;
        if (totalSteps > 0) {
            const progressPerStep = 60 / totalSteps;
            const imageJobPromises = [];
            for (const [index, step] of initialRecipe.steps.entries()) {
                // Cancel check
                await job.updateData({ ...job.data });
                if (job.data.cancelled) {
                    logger_1.logger.info(`Job cancelled before image step ${index + 1}`, { jobId: job.id });
                    return { cancelled: true };
                }
                const stepText = step.text || `Step ${index + 1}`;
                const illustrationPrompt = step.illustration || stepText;
                // Create the prompt for realistic image
                const imagePrompt = `Step ${index + 1} for recipe '${initialRecipe.title}': ${illustrationPrompt}. Realistic food photography showing the cooking process.`;
                logger_1.logger.info(`[Job ${job.id}] Queueing realistic image job for step ${index + 1}...`);
                // Use the imported imageQueue instance (named import)
                const imageJob = await imageQueue_1.imageQueue.add('generate-step-image', {
                    prompt: imagePrompt,
                    recipeId: recipeId,
                    stepIndex: index,
                    requestId: enableProgressiveDisplay ? requestId : undefined,
                    recipeData: enableProgressiveDisplay ? initialRecipe : undefined,
                    subscriptionTier: subscriptionTier // Pass the subscription tier to the image job
                });
                stepsWithImages.push({ text: stepText, illustration: illustrationPrompt, image_url: undefined });
                logger_1.logger.info(`[Job ${job.id}] Queued realistic image generation job ${imageJob.id}`);
                // Use the imported imageQueueEvents instance (named import)
                imageJobPromises.push(imageJob.waitUntilFinished(exports.imageQueueEvents));
                const currentProgress = 35 + ((index + 1) * progressPerStep);
                await job.updateProgress(Math.min(95, Math.floor(currentProgress)));
            }
            // Wait for image jobs
            logger_1.logger.info(`[Job ${job.id}] Waiting for ${imageJobPromises.length} image jobs...`);
            const imageResultsSettled = await Promise.allSettled(imageJobPromises);
            // Process image results
            for (let i = 0; i < imageResultsSettled.length; i++) {
                const resultSettled = imageResultsSettled[i];
                if (resultSettled.status === 'fulfilled') {
                    const result = resultSettled.value; // Use imported type
                    if (result?.error) {
                        logger_1.logger.error(`[Job ${job.id}] Image job step ${i} completed with error:`, { error: result.error });
                    }
                    else if (result?.imageUrl && result.stepIndex === i) {
                        if (i < stepsWithImages.length)
                            stepsWithImages[i].image_url = result.imageUrl;
                        else {
                            logger_1.logger.warn(`[Job ${job.id}] Mismatched image result index. Expected ${i}, got ${result.stepIndex}`);
                        }
                    }
                    else {
                        logger_1.logger.warn(`[Job ${job.id}] Image job step ${i} completed unexpectedly`, { result });
                    }
                }
                else {
                    logger_1.logger.error(`[Job ${job.id}] Image job promise rejected step ${i}:`, { reason: resultSettled.reason });
                }
            }
        }
        else {
            logger_1.logger.info(`[Job ${job.id}] No steps, skipping image gen.`);
            await job.updateProgress(95);
        }
        // Final cancel check
        await job.updateData({ ...job.data });
        if (job.data.cancelled) {
            logger_1.logger.info(`Job cancelled after image steps`, { jobId: job.id });
            return { cancelled: true };
        }
        // Step 5: Build final recipe
        const completeRecipe = { ...initialRecipe, steps: stepsWithImages };
        logger_1.logger.info(`[Job ${job.id}] Recipe generation completed: "${completeRecipe.title}" with realistic images`);
        await job.updateProgress(100);
        return { recipe: completeRecipe };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger_1.logger.error(`Error processing recipe job`, { jobId: job.id, requestId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
        try {
            await job.updateProgress(100);
        }
        catch (progressError) { /* ignore */ }
        return { error: errorMessage };
    }
};
// Create the worker instance (intended to be imported ONLY by the worker process)
exports.recipeWorker = new bullmq_1.Worker(QUEUE_NAME, processRecipeJob, // Pass the processor function
{
    connection: redis_1.redisClient,
    prefix: CONNECTION_OPTIONS.prefix,
    concurrency: process.env.RECIPE_WORKER_CONCURRENCY ? parseInt(process.env.RECIPE_WORKER_CONCURRENCY, 10) : 2,
    stalledInterval: 60000,
    lockDuration: 300000,
    lockRenewTime: 150000,
});
// --- Worker Event Handlers (Attached to the exported worker) ---
exports.recipeWorker.on('completed', (job, result) => {
    if (result.cancelled)
        logger_1.logger.info(`Recipe job completed: Cancelled`, { jobId: job.id, requestId: job.data.requestId });
    else if (result.error)
        logger_1.logger.warn(`Recipe job completed with error state: ${result.error}`, { jobId: job.id, requestId: job.data.requestId });
    else if (result.recipe)
        logger_1.logger.info(`Recipe job completed successfully: "${result.recipe.title}"`, { jobId: job.id, requestId: job.data.requestId });
    else
        logger_1.logger.warn(`Recipe job completed unexpected state`, { jobId: job.id, requestId: job.data.requestId, result });
});
exports.recipeWorker.on('failed', (job, err) => {
    if (job)
        logger_1.logger.error(`Recipe job failed: ${err.message}`, { jobId: job.id, requestId: job.data?.requestId, error: err.message, stack: err.stack });
    else
        logger_1.logger.error(`Recipe job failed (details unavailable): ${err.message}`, { error: err.message, stack: err.stack });
});
exports.recipeWorker.on('error', (err) => { logger_1.logger.error('Recipe worker instance error:', { error: err.message, stack: err.stack }); });
exports.recipeWorker.on('progress', (job, progress) => logger_1.logger.debug(`Recipe job progress: ${JSON.stringify(progress)}`, { jobId: job.id, requestId: job.data.requestId }));
exports.recipeWorker.on('stalled', (jobId) => { logger_1.logger.warn(`Recipe job stalled`, { jobId }); });
exports.recipeWorker.on('ready', () => logger_1.logger.info('Recipe queue worker process connected to Redis.'));
// No default export, use named exports: import { recipeQueue, recipeWorker, imageQueueEvents } from '...'
//# sourceMappingURL=recipeQueue.js.map