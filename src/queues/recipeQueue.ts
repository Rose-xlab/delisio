// src/queues/recipeQueue.ts
import { Queue, Worker, Job, JobProgress, QueueEvents } from 'bullmq';
// Removed axios, Buffer imports - not used directly here
import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../config/redis';
import { generateRecipeContent } from '../services/gptService';
// Removed direct import of generateImage, uploadImageToStorage
import { Recipe, RecipeStep, NutritionInfo } from '../models/Recipe';
import { logger } from '../utils/logger';
// Import the image QUEUE instance (for adding jobs) using named import
import { imageQueue } from './imageQueue';
// Import the type for image job results
import { ImageJobResult } from './imageQueue';
// --- IMPORT THE REFACTORED FUNCTION ---
// Import from the new service file location
import { updatePartialRecipe } from '../services/recipeUpdateService'; // Adjust path as needed
// Import SubscriptionTier
import { SubscriptionTier } from '../models/Subscription';


// Interface for recipe job data
export interface RecipeJobData {
  query: string;
  userPreferences?: any;
  requestId: string;
  userId?: string;
  save?: boolean;
  cancelled?: boolean;
  enableProgressiveDisplay?: boolean;
  subscriptionTier: SubscriptionTier; // Added this property
}

// Interface for recipe job result
export interface RecipeJobResult {
  recipe?: Recipe;
  cancelled?: boolean;
  error?: string;
}

// --- Queue Definition ---
const QUEUE_NAME = 'recipe-generation';
const CONNECTION_OPTIONS = {
  connection: redisClient,
  prefix: 'delisio_recipe_'
};

// Export the Queue instance
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

// --- QueueEvents for Image Queue ---
// Export the QueueEvents instance needed by the worker process
export const imageQueueEvents = new QueueEvents('image-generation', { // Must match imageQueue's name
  connection: redisClient,
  prefix: 'delisio_image_' // Must match imageQueue's prefix
});


// --- Worker Definition ---
// Define the processor function separately
const processRecipeJob = async (job: Job<RecipeJobData, RecipeJobResult, 'generate-recipe'>): Promise<RecipeJobResult> => {
  logger.info(`[Worker] Recipe Processor function ENTERED for job: ${job.id}`);
  const { query, userPreferences, requestId, userId, save, enableProgressiveDisplay, subscriptionTier } = job.data;
  const recipeId = uuidv4();

  try {
    await job.updateProgress(5);
    logger.info(`Processing recipe job`, { jobId: job.id, requestId });

    // Initial cancel check
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
    try {
        parsedRecipeData = JSON.parse(recipeContent);
    } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        logger.error(`[Job ${job.id}] Failed parse JSON: ${errorMsg}`, { rawContent: recipeContent });
        throw new Error('Failed parse recipe structure from AI.');
    }
    await job.updateProgress(35);

    // Step 3: Prepare initial object
    const initialRecipe: Recipe = {
        id: recipeId,
        title: parsedRecipeData.title ?? 'Untitled',
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
        query: query, createdAt: new Date(), prepTime: parsedRecipeData.prepTime,
        cookTime: parsedRecipeData.cookTime, totalTime: parsedRecipeData.totalTime,
        requestId: requestId, category: parsedRecipeData.category, tags: parsedRecipeData.tags,
        quality_score: parsedRecipeData.quality_score, similarity_hash: parsedRecipeData.similarity_hash,
    };

    // Save initial data (using REFACTORED function)
    if (enableProgressiveDisplay) {
      logger.info(`[Job ${job.id}] Saving initial recipe data...`);
      // Use the refactored function imported from the service
      updatePartialRecipe(requestId, initialRecipe)
        .catch(e => logger.error('Failed initial partial update', {error: e, requestId}));
    }

    // Step 4: Generate images
    logger.info(`[Job ${job.id}] Generating images (${initialRecipe.steps.length} steps)...`);
    const stepsWithImages: RecipeStep[] = [];
    const totalSteps = initialRecipe.steps.length;
    if (totalSteps > 0) {
      const progressPerStep = 60 / totalSteps;
      const imageJobPromises = [];
      for (const [index, step] of initialRecipe.steps.entries()) {
        // Cancel check
        await job.updateData({...job.data});
        if (job.data.cancelled) { logger.info(`Job cancelled before image step ${index+1}`, { jobId: job.id }); return { cancelled: true }; }

        const stepText = step.text || `Step ${index + 1}`;
        const illustrationPrompt = step.illustration || stepText;
        
        // Create the prompt for realistic image
        const imagePrompt = `Step ${index+1} for recipe '${initialRecipe.title}': ${illustrationPrompt}. Realistic food photography showing the cooking process.`;
        
        logger.info(`[Job ${job.id}] Queueing realistic image job for step ${index + 1}...`);

        // Use the imported imageQueue instance (named import)
        const imageJob = await imageQueue.add('generate-step-image', {
             prompt: imagePrompt, 
             recipeId: recipeId, 
             stepIndex: index,
             requestId: enableProgressiveDisplay ? requestId : undefined,
             recipeData: enableProgressiveDisplay ? initialRecipe : undefined,
             subscriptionTier: subscriptionTier // Pass the subscription tier to the image job
        });

        stepsWithImages.push({ text: stepText, illustration: illustrationPrompt, image_url: undefined });
        logger.info(`[Job ${job.id}] Queued realistic image generation job ${imageJob.id}`);

        // Use the imported imageQueueEvents instance (named import)
        imageJobPromises.push(imageJob.waitUntilFinished(imageQueueEvents));

        const currentProgress = 35 + ((index + 1) * progressPerStep);
        await job.updateProgress(Math.min(95, Math.floor(currentProgress)));
      }

      // Wait for image jobs
      logger.info(`[Job ${job.id}] Waiting for ${imageJobPromises.length} image jobs...`);
      const imageResultsSettled = await Promise.allSettled(imageJobPromises);

      // Process image results
      for (let i = 0; i < imageResultsSettled.length; i++) {
         const resultSettled = imageResultsSettled[i];
         if (resultSettled.status === 'fulfilled') {
            const result = resultSettled.value as ImageJobResult; // Use imported type
            if (result?.error) { logger.error(`[Job ${job.id}] Image job step ${i} completed with error:`, { error: result.error }); }
            else if (result?.imageUrl && result.stepIndex === i) {
                if (i < stepsWithImages.length) stepsWithImages[i].image_url = result.imageUrl;
                else { logger.warn(`[Job ${job.id}] Mismatched image result index. Expected ${i}, got ${result.stepIndex}`); }
            } else { logger.warn(`[Job ${job.id}] Image job step ${i} completed unexpectedly`, { result }); }
         } else { logger.error(`[Job ${job.id}] Image job promise rejected step ${i}:`, { reason: resultSettled.reason }); }
      }
    } else { logger.info(`[Job ${job.id}] No steps, skipping image gen.`); await job.updateProgress(95); }

    // Final cancel check
    await job.updateData({...job.data});
    if (job.data.cancelled) { logger.info(`Job cancelled after image steps`, { jobId: job.id }); return { cancelled: true }; }

    // Step 5: Build final recipe
    const completeRecipe: Recipe = { ...initialRecipe, steps: stepsWithImages };

    logger.info(`[Job ${job.id}] Recipe generation completed: "${completeRecipe.title}" with realistic images`);
    await job.updateProgress(100);
    return { recipe: completeRecipe };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error processing recipe job`, { jobId: job.id, requestId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    try { await job.updateProgress(100); } catch (progressError) { /* ignore */ }
    return { error: errorMessage };
  }
};


// Create the worker instance (intended to be imported ONLY by the worker process)
export const recipeWorker = new Worker<RecipeJobData, RecipeJobResult, 'generate-recipe'>(
  QUEUE_NAME,
  processRecipeJob, // Pass the processor function
  { // Worker Options
    connection: redisClient,
    prefix: CONNECTION_OPTIONS.prefix,
    concurrency: process.env.RECIPE_WORKER_CONCURRENCY ? parseInt(process.env.RECIPE_WORKER_CONCURRENCY, 10) : 2,
    stalledInterval: 60000,
    lockDuration: 300000,
    lockRenewTime: 150000,
  }
);

// --- Worker Event Handlers (Attached to the exported worker) ---
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