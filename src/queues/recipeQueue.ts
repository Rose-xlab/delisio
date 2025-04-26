// src/queues/recipeQueue.ts

import { Queue, Worker, Job, JobProgress, QueueEvents } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../config/redis';
import { generateRecipeContent } from '../services/gptService';
// Ensure Recipe type includes thumbnail_url
import { Recipe, RecipeStep, NutritionInfo } from '../models/Recipe';
import { logger } from '../utils/logger';
import { imageQueue } from './imageQueue';
import { ImageJobResult } from './imageQueue';
import { updatePartialRecipe } from '../services/recipeUpdateService';
import { SubscriptionTier } from '../models/Subscription';
import { saveRecipe } from '../services/supabaseService';
// No longer need axios/Buffer/generateImage here for thumbnail

// Interface for recipe job data (no changes needed)
export interface RecipeJobData {
    query: string;
    userPreferences?: any;
    requestId: string;
    userId?: string; // Make userId optional as it might not always be present
    save?: boolean; // Keep this if the controller still sends it, though worker logic might ignore it for auto-save
    cancelled?: boolean;
    enableProgressiveDisplay?: boolean;
    subscriptionTier: SubscriptionTier;
}

// Interface for recipe job result (no changes needed)
export interface RecipeJobResult {
    recipe?: Recipe;
    cancelled?: boolean;
    error?: string;
}

// --- Queue Definition (no changes needed) ---
const QUEUE_NAME = 'recipe-generation';
const CONNECTION_OPTIONS = {
    connection: redisClient,
    prefix: 'delisio_recipe_'
};
export const recipeQueue = new Queue<RecipeJobData, RecipeJobResult, 'generate-recipe'>(
    QUEUE_NAME,
    {
        ...CONNECTION_OPTIONS,
        defaultJobOptions: {
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: 1,
        }
    }
);

// --- QueueEvents for Image Queue (no changes needed) ---
export const imageQueueEvents = new QueueEvents('image-generation', { // Must match imageQueue's name
    connection: redisClient,
    prefix: 'delisio_image_' // Must match imageQueue's prefix
});


// --- Worker Definition ---
// Define the processor function separately
const processRecipeJob = async (job: Job<RecipeJobData, RecipeJobResult, 'generate-recipe'>): Promise<RecipeJobResult> => {
    logger.info(`[Worker] Recipe Processor function ENTERED for job: ${job.id}`);
    const { query, userPreferences, requestId, userId, enableProgressiveDisplay, subscriptionTier } = job.data;
    const globalRecipeId = uuidv4();

    try {
        await job.updateProgress(5);
        logger.info(`Processing recipe job`, { jobId: job.id, requestId, globalRecipeId });

        // Cancel check
        await job.updateData({...job.data});
        if (job.data.cancelled) { logger.info(`Job cancelled before start`, { jobId: job.id }); return { cancelled: true }; }

        // Step 1: Generate content
        logger.info(`[Job ${job.id}] Generating content...`);
        await job.updateProgress(10);
        const recipeContent = await generateRecipeContent(query, userPreferences);
        await job.updateProgress(30);

        // Cancel check
        await job.updateData({...job.data});
        if (job.data.cancelled) { logger.info(`Job cancelled after content gen`, { jobId: job.id }); return { cancelled: true }; }

        // Step 2: Parse
        logger.info(`[Job ${job.id}] Parsing content...`);
        let parsedRecipeData: any;
        try { parsedRecipeData = JSON.parse(recipeContent); }
        catch (parseError) { /* ... error handling ... */ throw new Error('Failed parse recipe structure from AI.'); }
        await job.updateProgress(35);

        // Step 3: Prepare initial object using GLOBAL ID
        const initialRecipe: Recipe = {
            id: globalRecipeId, // Use the generated GLOBAL UUID
            title: parsedRecipeData.title ?? 'Untitled Recipe',
            servings: parsedRecipeData.servings ?? 4,
            ingredients: parsedRecipeData.ingredients ?? [],
            steps: (Array.isArray(parsedRecipeData.steps) ? parsedRecipeData.steps : []).map((step: any): RecipeStep => ({
                 text: step?.text || '', illustration: step?.illustration, image_url: undefined
             })),
            nutrition: {
                calories: parsedRecipeData.nutrition?.calories ?? 0,
                protein: String(parsedRecipeData.nutrition?.protein ?? '0g'),
                fat: String(parsedRecipeData.nutrition?.fat ?? '0g'),
                carbs: String(parsedRecipeData.nutrition?.carbs ?? '0g'),
            } as NutritionInfo,
            query: query,
            createdAt: new Date(),
            prepTime: parsedRecipeData.prepTime,
            cookTime: parsedRecipeData.cookTime,
            totalTime: parsedRecipeData.totalTime,
            requestId: requestId,
            category: parsedRecipeData.category,
            tags: parsedRecipeData.tags,
            quality_score: parsedRecipeData.quality_score,
            similarity_hash: parsedRecipeData.similarity_hash,
        };

        // Update partial recipe cache (as before)
        if (enableProgressiveDisplay) {
            logger.info(`[Job ${job.id}] Saving initial recipe data (for progressive display)...`);
            updatePartialRecipe(requestId, initialRecipe)
               .catch(e => logger.error('Failed initial partial update', {error: e, requestId}));
        }
        await job.updateProgress(40); // Progress update

        // --- REMOVED SEPARATE THUMBNAIL GENERATION BLOCK ---

        // --- Step 4: Generate STEP images (as before) ---
        logger.info(`[Job ${job.id}] Generating STEP images (${initialRecipe.steps.length} steps)...`);
        const stepsWithImages: RecipeStep[] = []; // Will hold final step data including URLs
        const totalSteps = initialRecipe.steps.length;
        if (totalSteps > 0) {
            const progressPerStep = 55 / totalSteps; // Allocate slightly more progress here now
            const imageJobPromises = [];

            for (const [index, step] of initialRecipe.steps.entries()) {
                // Cancel check
                await job.updateData({...job.data});
                if (job.data.cancelled) { logger.info(`Job cancelled before image step ${index+1}`, { jobId: job.id }); return { cancelled: true }; }

                const stepText = step.text || `Step ${index + 1}`;
                const illustrationPrompt = step.illustration || stepText;
                const imagePrompt = `Step ${index+1} for recipe '${initialRecipe.title}': ${illustrationPrompt}. Realistic food photography showing the cooking process.`;
                logger.info(`[Job ${job.id}] Queueing realistic image job for step ${index + 1}...`);

                const imageJob = await imageQueue.add('generate-step-image', {
                    prompt: imagePrompt,
                    recipeId: globalRecipeId, // Pass the global recipe ID
                    stepIndex: index,
                    requestId: enableProgressiveDisplay ? requestId : undefined,
                    recipeData: enableProgressiveDisplay ? initialRecipe : undefined, // Pass initial data for potential partial updates
                    subscriptionTier: subscriptionTier
                });

                stepsWithImages.push({ text: stepText, illustration: illustrationPrompt, image_url: undefined });
                logger.info(`[Job ${job.id}] Queued realistic image generation job ${imageJob.id}`);
                imageJobPromises.push(imageJob.waitUntilFinished(imageQueueEvents));

                const currentProgress = 40 + ((index + 1) * progressPerStep);
                await job.updateProgress(Math.min(95, Math.floor(currentProgress)));
            }

            logger.info(`[Job ${job.id}] Waiting for ${imageJobPromises.length} image jobs to complete...`);
            const imageResultsSettled = await Promise.allSettled(imageJobPromises);

            // Process results and populate stepsWithImages with URLs
            for (let i = 0; i < imageResultsSettled.length; i++) {
                const resultSettled = imageResultsSettled[i];
                if (resultSettled.status === 'fulfilled') {
                    const result = resultSettled.value as ImageJobResult;
                    if (result?.imageUrl && result.stepIndex !== undefined) {
                        const stepIndex = result.stepIndex;
                        if (stepIndex < stepsWithImages.length) {
                            // This line correctly populates the array with the final URL
                            stepsWithImages[stepIndex].image_url = result.imageUrl;
                            logger.info(`Populated image_url for step ${stepIndex}: ${result.imageUrl}`);
                        } else { logger.warn(`[Job ${job.id}] Invalid step index in image result: ${stepIndex}`); }
                    } else if (result?.error) { logger.error(`[Job ${job.id}] Image job step ${i} completed with error:`, { error: result.error }); }
                    else { logger.warn(`[Job ${job.id}] Image job step ${i} completed without valid URL`, { result }); }
                } else { logger.error(`[Job ${job.id}] Image job promise rejected step ${i}:`, { reason: resultSettled.reason }); }
            }
             // Log final URLs for debugging
             for (let i = 0; i < stepsWithImages.length; i++) {
                logger.debug(`Final image_url check for step ${i}: ${stepsWithImages[i].image_url || 'NOT SET'}`);
             }
        } else {
             logger.info(`[Job ${job.id}] No steps, skipping step image gen.`);
             await job.updateProgress(95);
        }


        // --- Step 5: Determine Thumbnail URL from Last Step ---
        let finalThumbnailUrl: string | undefined = undefined;
        if (stepsWithImages.length > 0) {
            // Get the last step object from the array populated with results
            const lastStep = stepsWithImages[stepsWithImages.length - 1];
            finalThumbnailUrl = lastStep?.image_url; // Use optional chaining
            if (finalThumbnailUrl) {
                logger.info(`[Job ${job.id}] Using image from last step (${stepsWithImages.length - 1}) as thumbnail: ${finalThumbnailUrl}`);
            } else {
                logger.warn(`[Job ${job.id}] Last step image URL is missing or generation failed. No thumbnail will be set.`);
            }
        } else {
             logger.info(`[Job ${job.id}] No steps found, cannot set thumbnail from last step.`);
        }


        // Final cancel check before saving
        await job.updateData({...job.data});
        if (job.data.cancelled) { logger.info(`Job cancelled before final save`, { jobId: job.id }); return { cancelled: true }; }


        // --- Step 6: Build final GLOBAL recipe object ---
        // Now includes the determined thumbnail_url
        const completeGlobalRecipe: Recipe = {
            ...initialRecipe,               // Contains globalRecipeId
            steps: stepsWithImages,         // Contains step image URLs
            thumbnail_url: finalThumbnailUrl // Assign the URL from the last step (or undefined)
        };


        // --- Step 7: Implement Automatic Dual Save Logic (as before) ---
        let userSpecificRecipeDataForResult: Recipe | null = null;

        // 7a. Save the Global Copy
        logger.info(`[Job ${job.id}] Attempting to save GLOBAL recipe copy ${globalRecipeId}...`);
        try {
            await saveRecipe(completeGlobalRecipe, null);
            logger.info(`[Job ${job.id}] GLOBAL recipe copy ${globalRecipeId} saved successfully.`);
        } catch (globalSaveError) {
             logger.error(`[Job ${job.id}] CRITICAL: Failed to save GLOBAL recipe copy ${globalRecipeId}:`, globalSaveError);
             throw globalSaveError; // Propagate error to fail the BullMQ job
        }

        // 7b. Save the User's Copy (Automatically IF userId exists)
        if (userId) {
            const userRecipeId = uuidv4();
            logger.info(`[Job ${job.id}] User detected (${userId}). Generating unique ID for user's recipe copy: ${userRecipeId}`);
            const userSpecificRecipeData: Recipe = {
                ...completeGlobalRecipe, // Copy global data (includes steps AND thumbnail_url)
                id: userRecipeId,
            };
            logger.info(`[Job ${job.id}] Attempting to save user-specific recipe copy ${userRecipeId} for user ${userId}...`);
            try {
                await saveRecipe(userSpecificRecipeData, userId);
                logger.info(`[Job ${job.id}] User-specific recipe copy ${userRecipeId} saved successfully for user ${userId}.`);
                userSpecificRecipeDataForResult = userSpecificRecipeData;
            } catch (userSaveError) {
                 logger.error(`[Job ${job.id}] Failed to save user-specific recipe copy ${userRecipeId} for user ${userId}:`, userSaveError);
                 // Logged the error, but the global copy is saved. Continue.
            }
        } else {
             logger.info(`[Job ${job.id}] No userId provided. Skipping user-specific copy save.`);
        }
        // --- End Saving Logic ---

        logger.info(`[Job ${job.id}] Recipe generation process completed successfully: "${completeGlobalRecipe.title}"`);
        await job.updateProgress(100);

        const resultRecipe = userSpecificRecipeDataForResult ?? completeGlobalRecipe;
        logger.debug(`[Worker] Returning final recipe object for job ${job.id}:`, { recipe: resultRecipe });
        return { recipe: resultRecipe }; // Return the final recipe object

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error processing recipe job`, { jobId: job.id, requestId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
        try { await job.updateProgress(100); } catch (progressError) { /* ignore */ }
        return { error: errorMessage };
    }
};


// Create the worker instance (Only ONE worker instance should process jobs from a queue)
export const recipeWorker = new Worker<RecipeJobData, RecipeJobResult, 'generate-recipe'>(
    QUEUE_NAME,
    processRecipeJob, // Pass the updated processor function
    { // Worker Options
        connection: redisClient,
        prefix: CONNECTION_OPTIONS.prefix,
        concurrency: process.env.RECIPE_WORKER_CONCURRENCY ? parseInt(process.env.RECIPE_WORKER_CONCURRENCY, 10) : 2,
        stalledInterval: 60000,
        lockDuration: 300000, // 5 minutes, adjust based on typical generation time
        lockRenewTime: 150000, // Renew lock halfway through duration
    }
);

// --- Worker Event Handlers (Keep exactly as they were) ---
recipeWorker.on('completed', (job, result) => {
    if (result.cancelled) logger.info(`Recipe job completed: Cancelled`, { jobId: job.id, requestId: job.data.requestId });
    else if (result.error) logger.warn(`Recipe job completed with error state: ${result.error}`, { jobId: job.id, requestId: job.data.requestId });
    else if (result.recipe) logger.info(`Recipe job completed successfully: "${result.recipe.title}"`, { jobId: job.id, requestId: job.data.requestId });
    else logger.warn(`Recipe job completed unexpected state`, { jobId: job.id, requestId: job.data.requestId, result });
});
recipeWorker.on('failed', (job, err) => {
    if (job) logger.error(`Recipe job failed: ${err.message}`, { jobId: job.id, requestId: job.data?.requestId, error: err.message, stack: err.stack });
    else logger.error(`Recipe job failed (details unavailable): ${err.message}`, { error: err.message, stack: err.stack });
});
recipeWorker.on('error', (err) => { logger.error('Recipe worker instance error:', { error: err.message, stack: err.stack }); });
recipeWorker.on('progress', (job, progress) => logger.debug(`Recipe job progress: ${JSON.stringify(progress)}`, { jobId: job.id, requestId: job.data.requestId }));
recipeWorker.on('stalled', (jobId) => { logger.warn(`Recipe job stalled`, { jobId }); });
recipeWorker.on('ready', () => logger.info('Recipe queue worker process connected to Redis.'));

// No default export, use named exports: import { recipeQueue, recipeWorker, imageQueueEvents } from '...'