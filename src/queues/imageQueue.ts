// src/queues/imageQueue.ts
import { Queue, Worker, Job, JobProgress } from 'bullmq';
import axios from 'axios';
import { Buffer } from 'buffer';
import { redisClient } from '../config/redis';
import { generateImage } from '../services/dalleService';
import { uploadImageToStorage } from '../services/supabaseService';
import { logger } from '../utils/logger';
// --- IMPORT THE REFACTORED FUNCTION ---
// Import from the new service file location
import { updatePartialRecipe } from '../services/recipeUpdateService'; // Adjust path as needed
// Import SubscriptionTier type
import { SubscriptionTier } from '../models/Subscription';

// Interface for image job data
export interface ImageJobData {
  prompt: string;
  recipeId: string;
  stepIndex: number;
  requestId?: string;
  recipeData?: any; // Consider defining a specific type for this partial data
  subscriptionTier: SubscriptionTier; // Added this property
}

// Interface for image job result
export interface ImageJobResult {
  imageUrl?: string;
  error?: string;
  stepIndex?: number;
  requestId?: string;
}

// --- Queue Definition ---
const QUEUE_NAME = 'image-generation'; // Ensure this matches QueueEvents in recipeQueue.ts
const CONNECTION_OPTIONS = {
  connection: redisClient,
  prefix: 'delisio_image_' // Ensure this matches QueueEvents in recipeQueue.ts
};

// Export the Queue instance for potential use elsewhere (e.g., recipeQueue)
export const imageQueue = new Queue<ImageJobData, ImageJobResult>(
  QUEUE_NAME,
  {
    ...CONNECTION_OPTIONS,
    defaultJobOptions: {
      removeOnComplete: 500,
      removeOnFail: 1000,
      attempts: 4,
      backoff: { type: 'exponential', delay: 3000 }
    }
  }
);

// --- Worker Definition ---
// Define the processor function separately
const processImageJob = async (job: Job<ImageJobData, ImageJobResult>): Promise<ImageJobResult> => {
  logger.info(`[Worker] Image Processor function ENTERED for job: ${job.id}`);
  const { prompt, recipeId, stepIndex, requestId, recipeData, subscriptionTier } = job.data;
  await job.log(`Starting image generation for recipe ${recipeId}, step ${stepIndex}`);
  logger.info(`Processing image job`, { jobId: job.id, recipeId, stepIndex });

  try {
    await job.updateProgress(10);

    // Step 1: Generate image (with retries)
    logger.info(`[Job ${job.id}] Generating image...`, { prompt });
    let tempImageUrl: string | null = null;
    let retryCount = 0; const maxRetries = 3; let lastError: any = null;
    while (retryCount < maxRetries && !tempImageUrl) {
        try {
          if (retryCount > 0) {
            const delay = Math.pow(2, retryCount) * 1000;
            await job.log(`Retrying image generation (attempt ${retryCount + 1}/${maxRetries}) after ${delay/1000}s delay`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          // Pass the subscription tier to the image generation service
          tempImageUrl = await generateImage(prompt, subscriptionTier);
          if (!tempImageUrl) throw new Error('No URL returned from image generation service');
        } catch (err) { lastError = err; retryCount++; if (retryCount >= maxRetries) await job.log(`All ${maxRetries} image generation attempts failed.`); }
    }
    if (!tempImageUrl) { await job.log('Image generation failed: ' + (lastError?.message || 'No URL returned')); throw lastError || new Error('Failed to generate image after all retries'); }
    await job.updateProgress(50); await job.log(`Generated temp URL: ${tempImageUrl}`);

    // Step 2: Download image (with retries)
    logger.info(`[Job ${job.id}] Downloading image...`);
    let imageData: Buffer | null = null;
    retryCount = 0; lastError = null;
    while (retryCount < maxRetries && !imageData) {
        try {
             if (retryCount > 0) {
                const delay = Math.pow(2, retryCount) * 1000;
                await job.log(`Retrying image download (attempt ${retryCount + 1}/${maxRetries}) after ${delay/1000}s delay`);
                await new Promise(resolve => setTimeout(resolve, delay));
             }
             const imageResponse = await axios.get(tempImageUrl, { responseType: 'arraybuffer', timeout: 30000 });
             imageData = Buffer.from(imageResponse.data);
             if (!imageData || imageData.length === 0) throw new Error('Downloaded image data is empty');
        } catch (err) { lastError = err; retryCount++; if (retryCount >= maxRetries) await job.log(`All ${maxRetries} image download attempts failed.`); }
    }
    if (!imageData) { await job.log('Image download failed: ' + (lastError?.message || 'Empty data received')); throw lastError || new Error('Failed to download image after all retries'); }
    await job.updateProgress(75); await job.log(`Downloaded image data (${imageData.length} bytes).`);

    // Step 3: Upload image (with retries)
    logger.info(`[Job ${job.id}] Uploading image...`);
    const filePath = `public/steps/${recipeId}/${stepIndex}.png`;
    let permanentUrl: string | null = null;
    retryCount = 0; lastError = null;
    while (retryCount < maxRetries && !permanentUrl) {
        try {
            if (retryCount > 0) {
                const delay = Math.pow(2, retryCount) * 1000;
                await job.log(`Retrying image upload (attempt ${retryCount + 1}/${maxRetries}) after ${delay/1000}s delay`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            permanentUrl = await uploadImageToStorage(imageData, filePath, 'image/png');
            if (!permanentUrl) throw new Error('No permanent URL returned after storage upload');
        } catch (err) { lastError = err; retryCount++; if (retryCount >= maxRetries) await job.log(`All ${maxRetries} image upload attempts failed.`); }
    }
    if (!permanentUrl) { await job.log('Image upload failed: ' + (lastError?.message || 'No URL returned')); throw lastError || new Error('Failed to upload image after all retries'); }
    await job.updateProgress(100); await job.log(`Uploaded image successfully: ${permanentUrl}`);

    // Step 4: Update partial recipe (using REFACTORED function from service)
    // This informs the cache that this step's image is ready
    if (requestId && recipeData) {
      // Call the refactored function (no 'req' needed)
      updatePartialRecipe(requestId, recipeData, stepIndex, permanentUrl)
        .then(() => logger.info(`[Job ${job.id}] Updated partial recipe step ${stepIndex} with image URL`))
        .catch(e => logger.error(`Failed updating partial recipe step ${stepIndex}`, { error: e }));
    }

    logger.info(`[Job ${job.id}] Image processing completed successfully.`);
    // Return the necessary info for the waiting recipeWorker
    return { imageUrl: permanentUrl, stepIndex, requestId };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await job.log(`ERROR: ${errorMessage}`);
    logger.error(`Error processing image job`, { jobId: job.id, error: errorMessage });
    // Attempt update on failure (using REFACTORED function)
    // Pass null for imageUrl to indicate failure for this step
    if (requestId && recipeData && stepIndex !== undefined) {
         updatePartialRecipe(requestId, recipeData, stepIndex, null) // Pass null URL
             .catch(updateErr => logger.error(`Failed to update partial recipe after job failure`, { error: updateErr }));
    }
    // Return error but include stepIndex and requestId for context
    return { error: errorMessage, stepIndex, requestId };
  }
};

// Create the worker instance (intended to be imported ONLY by the worker process)
export const imageWorker = new Worker<ImageJobData, ImageJobResult>(
  QUEUE_NAME,
  processImageJob, // Pass the processor function
  { // Worker Options
    connection: redisClient,
    prefix: CONNECTION_OPTIONS.prefix,
    concurrency: process.env.IMAGE_WORKER_CONCURRENCY ? parseInt(process.env.IMAGE_WORKER_CONCURRENCY, 10) : 2,
    stalledInterval: 45000,
    lockDuration: 180000,
    lockRenewTime: 60000,
  }
);

// --- Worker Event Handlers (Attached to the exported worker) ---
imageWorker.on('completed', (job, result) => {
  if (result.error) logger.warn(`Image job completed with error state`, { jobId: job.id, error: result.error });
  else logger.info(`Image job completed successfully`, { jobId: job.id, imageUrl: result.imageUrl });
});
imageWorker.on('failed', (job, err) => {
  if (job) logger.error(`Image job failed`, { jobId: job.id, error: err.message, stack: err.stack });
  else logger.error(`An image job failed (job details unavailable)`, { error: err.message, stack: err.stack });
});
imageWorker.on('error', (err) => {
  if (err.message.includes('rate limit') || err.message.includes('429')) logger.warn(`Image worker potentially rate limited: ${err.message}.`);
  else logger.error('Image worker error:', { error: err.message, stack: err.stack });
});
imageWorker.on('progress', (job, progress) => logger.debug(`Image job progress: ${JSON.stringify(progress)}`, { jobId: job.id }));
imageWorker.on('ready', () => logger.info('Image queue worker process connected to Redis.'));
imageWorker.on('closing', () => logger.warn('Image worker is closing connection to Redis.'));
imageWorker.on('closed', () => logger.warn('Image worker has closed connection to Redis.'));
imageWorker.on('drained', () => logger.info('Image queue is drained - all jobs processed.'));
imageWorker.on('stalled', (jobId, prev) => logger.warn(`Image job stalled`, { jobId, previousState: prev }));

// No default export, use named exports: import { imageQueue, imageWorker } from '...'