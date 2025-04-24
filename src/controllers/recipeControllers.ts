// src/controllers/recipeControllers.ts

import { Request, Response, NextFunction } from 'express';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { generateRecipeContent } from '../services/gptService';
import { generateImage } from '../services/dalleService';
import { extractNutrition } from '../services/nutritionService';
// Import saveRecipe FROM supabaseService - needed if save logic remained here, but we're moving it.
// import { uploadImageToStorage, saveRecipe } from '../services/supabaseService'; // <-- Keep if needed elsewhere
import { uploadImageToStorage } from '../services/supabaseService'; // <-- Keep upload if needed by sync flow
// --- IMPORT saveRecipe (we remove the call below, but keep import if sync flow uses it) ---
// --- IMPORT getRecipeById for fetching final data ---
import { saveRecipe, getRecipeById } from '../services/supabaseService'; // Import getRecipeById
// --- END IMPORT ---
import { Recipe, RecipeStep, NutritionInfo, validateRecipe } from '../models/Recipe'; // Assuming Ingredient type might be defined here too
import { AppError } from '../middleware/errorMiddleware';
import { registerRequest, isRequestCancelled, cleanupRequest, cancelRequest } from '../middleware/cancellationMiddleware';
import { evaluateRecipeQuality, enhanceRecipeQuality, categorizeRecipe } from '../services/qualityService';
import { checkForDuplicates, mergeRecipes, generateSimilarityHash } from '../services/duplicateDetectionService';
import { logger } from '../utils/logger';
import { Redis } from 'ioredis';
import { redisClient } from '../config/redis';
// Use named imports for queues
import { recipeQueue } from '../queues/recipeQueue';
import { updatePartialRecipe } from '../services/recipeUpdateService';
import { SubscriptionTier } from '../models/Subscription';

// Fallback cache (as provided before)
const recipeCache = new Map<string, string>();

/**
 * Generates a complete recipe including optional time fields and permanent image URLs.
 * Uses the queuing system.
 */
export const generateRecipe = async (req: Request, res: Response, next: NextFunction) => {
  const { query, save = false } = req.body;
  const requestId = uuidv4();
  // Check if queue system is active (determined by existence of recipe queue)
  const useQueueSystem = !!recipeQueue; // Check if the imported queue exists

  if (useQueueSystem) {
    try {
      logger.info(`Recipe generation requested via Queue for query: ${query}, requestId: ${requestId}`);

      // Access user info safely from req object
      const userId = (req as any).user?.id;
      const userPreferences = (req as any).user?.preferences;
      const subscriptionTier = (req as any).subscriptionTier || 'free';

      // Add the job to the queue
      const job = await recipeQueue.add(
        'generate-recipe', // Job name
        { // Job data
          query,
          userPreferences: userPreferences,
          requestId,
          userId: userId, // Pass potentially undefined userId
          save, // Pass save flag to worker
          enableProgressiveDisplay: true,
          subscriptionTier: subscriptionTier
        },
        { // Job options
          jobId: requestId // Use requestId as jobId for easier tracking
        }
      );

      logger.info(`Recipe generation job ${job.id} added to queue`);

      // Return 202 Accepted immediately
      res.status(202).json({
        message: 'Recipe generation started',
        requestId,
        status: 'processing'
      });
    } catch (error) {
      logger.error('Error queuing recipe generation:', error);
      next(new AppError(
        `Failed to queue recipe generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      ));
    }
  } else {
    // Fall back to original non-queued implementation if queue doesn't exist
    logger.warn(`Recipe queue not found or inactive, falling back to synchronous generation for query: ${query}`);
    await generateRecipeOriginal(req, res, next);
  }
};

/**
 * Original non-queued recipe generation function
 * Kept for backward compatibility and fallback
 */
const generateRecipeOriginal = async (req: Request, res: Response, next: NextFunction) => {
  const { query, save } = req.body;
  const recipeId = uuidv4();
  const requestId = uuidv4();
  logger.info(`Generated unique ID for recipe: ${recipeId}, request ID: ${requestId} (Sync Flow)`);

  const userId = (req as any).user?.id;
  const userPreferences = (req as any).user?.preferences;
  const subscriptionTier = (req as any).subscriptionTier || 'free';

  registerRequest(requestId);

  let parsedRecipeData: Partial<Recipe> = {};

  try {
    // Step 1: Generate recipe content JSON string
    logger.info(`Starting GPT recipe generation for request: ${requestId} (Sync Flow)`);
    const gptJsonResponse = await generateRecipeContent(query, userPreferences);
    if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }
    logger.info("Received potential JSON response string from GPT service (Sync Flow).");

    // Step 2: Parse and Validate JSON
    try {
        parsedRecipeData = JSON.parse(gptJsonResponse);
        logger.info("Successfully parsed JSON response string.");
        logger.info("Time fields in GPT response:", {
            prepTime: parsedRecipeData.prepTime,
            cookTime: parsedRecipeData.cookTime,
            totalTime: parsedRecipeData.totalTime,
        });
    } catch (jsonError) {
        logger.error("JSON parsing error:", jsonError);
        throw new Error('Failed to parse recipe structure from AI response.');
    }

    if (!validateRecipe(parsedRecipeData)) {
        logger.error("Recipe validation failed:", parsedRecipeData);
        throw new Error('AI response did not match expected recipe structure after parsing.');
    }
    logger.info(`Parsed recipe title: "${parsedRecipeData.title}" (Sync Flow)`);
    parsedRecipeData.requestId = requestId;
    if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }

    // Step 3: Evaluate recipe quality
    logger.info(`Evaluating quality for recipe: ${parsedRecipeData.title} (Sync Flow)`);
    const initialRecipe: Recipe = {
      id: recipeId,
      title: parsedRecipeData.title ?? 'Untitled Recipe',
      servings: parsedRecipeData.servings ?? 4,
      ingredients: parsedRecipeData.ingredients ?? [],
      steps: parsedRecipeData.steps ?? [],
      nutrition: parsedRecipeData.nutrition ?? { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
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

    await updatePartialRecipe(requestId, initialRecipe);

    const qualityScore = await evaluateRecipeQuality(initialRecipe);
    logger.info(`Quality evaluation: ${qualityScore.overall}/10 (Sync Flow)`);
    let workingRecipe = initialRecipe;
    if (!qualityScore.isPassingThreshold) {
        logger.info(`Enhancing recipe quality (Sync Flow).`);
        workingRecipe = await enhanceRecipeQuality(initialRecipe, qualityScore);
        workingRecipe.quality_score = qualityScore.overall;
        await updatePartialRecipe(requestId, workingRecipe);
    } else {
        workingRecipe.quality_score = qualityScore.overall;
        await updatePartialRecipe(requestId, workingRecipe);
    }
    if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }

    // Step 4: Categorize the recipe
    logger.info(`Categorizing recipe: ${workingRecipe.title} (Sync Flow)`);
    const { category, tags } = await categorizeRecipe(workingRecipe);
    workingRecipe.category = category; workingRecipe.tags = tags;
    await updatePartialRecipe(requestId, workingRecipe);

    // Step 5: Check for duplicates
    logger.info(`Checking for duplicates: ${workingRecipe.title} (Sync Flow)`);
    const similarityHash = generateSimilarityHash(workingRecipe);
    workingRecipe.similarity_hash = similarityHash;
    await updatePartialRecipe(requestId, workingRecipe);
    const duplicateCheck = await checkForDuplicates(workingRecipe);
    let mergedRecipe: Recipe | null = null;
    if (duplicateCheck.isDuplicate && duplicateCheck.existingRecipeId) {
        logger.info(`Duplicate found (Existing ID: ${duplicateCheck.existingRecipeId}). Merging... (Sync Flow)`);
        mergedRecipe = await mergeRecipes(workingRecipe, duplicateCheck.existingRecipeId);
    } else {
        logger.info(`Recipe is not a duplicate (Sync Flow).`);
    }
    if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }

    // Step 6: Process images sequentially
    let stepsWithImages: RecipeStep[] = [];
    if (workingRecipe.steps && workingRecipe.steps.length > 0) {
        logger.info(`Processing images sequentially for ${workingRecipe.steps.length} steps (Sync Flow)...`);
        for (const [index, step] of workingRecipe.steps.entries()) {
            if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }
            const stepText = step.text || `Step ${index + 1}`;
            const illustrationPrompt = step.illustration || stepText;
            const imagePrompt = `Step ${index + 1} for recipe '${workingRecipe.title}': ${illustrationPrompt}. Professional food photography showing the cooking process.`;

            let permanentUrl: string | undefined = undefined;
            try {
                logger.info(`Requesting realistic temporary image URL for step ${index + 1}...`);
                const tempImageUrl = await generateImage(imagePrompt, subscriptionTier as SubscriptionTier);
                if (tempImageUrl) {
                    logger.info(`Downloading temporary image for step ${index + 1}...`);
                    const imageResponse = await fetch(tempImageUrl);
                    if (!imageResponse.ok) throw new Error(`Failed to download image: ${imageResponse.statusText}`);
                    const imageData = Buffer.from(await imageResponse.arrayBuffer());
                    logger.info(`Uploading image data for step ${index + 1} (${imageData.length} bytes)...`);
                    const filePath = `public/steps/${recipeId}/${index}.png`;
                    permanentUrl = await uploadImageToStorage(imageData, filePath, 'image/png');
                    logger.info(`Supabase Storage URL for step ${index + 1}: ${permanentUrl}`);

                    // Update the specific step in the working recipe
                    if (workingRecipe.steps) {
                        workingRecipe.steps[index] = { ...step, image_url: permanentUrl };
                        // Update the partial recipe in cache with the new image URL
                        await updatePartialRecipe(requestId, workingRecipe);
                    }

                } else { logger.warn(`No temporary image URL for step ${index + 1}.`); }
            } catch (error) { logger.error(`Failed to process image for step ${index + 1} (Sync Flow):`, error); }
            stepsWithImages.push({
                text: stepText,
                illustration: illustrationPrompt,
                image_url: permanentUrl
            });
            if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }
        }
        logger.info(`Finished processing realistic images sequentially (Sync Flow).`);
        workingRecipe.steps = stepsWithImages;
        await updatePartialRecipe(requestId, workingRecipe);
    } else { logger.info("Skipping image processing - no steps (Sync Flow)."); }
    if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }


    // Step 7: Nutrition Info
    let nutritionInfo: NutritionInfo = { calories: 0, protein: '0g', fat: '0g', carbs: '0g' };
    if (workingRecipe.nutrition && typeof workingRecipe.nutrition.calories === 'number') {
         logger.info("Using nutrition info parsed from AI response.");
         nutritionInfo = {
             calories: workingRecipe.nutrition.calories ?? 0,
             protein: String(workingRecipe.nutrition.protein ?? '0g'),
             fat: String(workingRecipe.nutrition.fat ?? '0g'),
             carbs: String(workingRecipe.nutrition.carbs ?? '0g'),
         };
    } else {
        logger.info("Nutrition info missing or invalid in AI response, trying to extract...");
        try {
            const ingredientsList = workingRecipe.ingredients?.map((ing: any) => `${ing.quantity ?? ''} ${ing.unit ?? ''} ${ing.name}`) ?? [];
            nutritionInfo = await extractNutrition(workingRecipe.title ?? query, ingredientsList);
            logger.info("Extracted nutrition info:", nutritionInfo);
        } catch (nutriError) {
            logger.error("Failed to extract nutrition info:", nutriError);
        }
    }
    workingRecipe.nutrition = nutritionInfo;
    await updatePartialRecipe(requestId, workingRecipe);


    // Step 8: Construct final complete recipe object
    const finalRecipeData = mergedRecipe ? mergedRecipe : workingRecipe;
    const completeRecipe: Recipe = {
      id: finalRecipeData.id,
      title: finalRecipeData.title,
      servings: finalRecipeData.servings,
      ingredients: finalRecipeData.ingredients,
      steps: finalRecipeData.steps,
      nutrition: finalRecipeData.nutrition,
      query: query,
      createdAt: finalRecipeData.createdAt ?? new Date(),
      prepTime: finalRecipeData.prepTime,
      cookTime: finalRecipeData.cookTime,
      totalTime: finalRecipeData.totalTime,
      requestId: requestId,
      category: finalRecipeData.category,
      tags: finalRecipeData.tags,
      similarity_hash: finalRecipeData.similarity_hash,
      quality_score: finalRecipeData.quality_score,
    };
    logger.info(`Constructed complete recipe: "${completeRecipe.title}" with realistic images (Sync Flow)`);


    // Step 9: Save to global database if not a duplicate
    if (!duplicateCheck.isDuplicate) {
        logger.info(`Saving new recipe ${completeRecipe.id} to global collection...`);
        try {
            // --- FIX: Pass null for global save case, assuming saveRecipe handles it ---
            await saveRecipe(completeRecipe, null); // Pass null for global save case
            logger.info(`Recipe ${completeRecipe.id} saved globally.`);
        } catch (saveError) {
            logger.error(`Failed to save recipe ${completeRecipe.id} globally:`, saveError);
        }
    } else if (mergedRecipe) {
        logger.info(`Skipping separate global save for ${completeRecipe.id} as it was merged into ${mergedRecipe.id}.`);
    }

    // Save to user's collection if requested and user exists
    if (userId && save) {
       logger.info(`Saving recipe ${completeRecipe.id} to user ${userId}'s collection...`);
       try {
           await saveRecipe(completeRecipe, userId);
           logger.info(`Recipe ${completeRecipe.id} saved for user ${userId}.`);
       } catch (userSaveError) {
           logger.error(`Failed to save recipe ${completeRecipe.id} for user ${userId}:`, userSaveError);
       }
    }

    cleanupRequest(requestId);
    res.status(200).json(completeRecipe);

  } catch (error) {
    logger.error('Error in generateRecipeOriginal controller (Sync Flow):', error);
    cleanupRequest(requestId);
    next(error);
  }
};


/**
 * Cancels a recipe generation job (handles both queued and non-queued)
 */
export const cancelRecipeGeneration = async (req: Request, res: Response, next: NextFunction) => {
  const { requestId } = req.body;
  if (!requestId) return next(new AppError('requestId is required', 400));

  const useQueueSystem = !!recipeQueue;

  try {
    logger.info(`Cancellation requested for recipe generation: ${requestId}`);

    if (useQueueSystem) {
      // Queue-based cancellation
      const job = await recipeQueue.getJob(requestId);

      if (!job) {
        const partialRecipe = await getPartialRecipeFromCache(requestId);
        if (partialRecipe) {
            logger.warn(`Job ${requestId} not found, but partial data exists. Cleaning up cache.`);
            await cleanupPartialRecipeCache(requestId);
             return res.status(200).json({
                 success: true,
                 message: 'Recipe generation likely completed or failed before cancellation, cache cleaned.',
                 status: 'unknown_job_state'
             });
        } else {
            logger.warn(`Job not found for cancellation: ${requestId} and no cache found.`);
            return res.status(404).json({
                success: false,
                message: 'Recipe generation job not found or already cleaned up'
            });
        }
      }

      const state = await job.getState();
      logger.info(`Job ${requestId} state before cancellation: ${state}`);

      if (state === 'completed' || state === 'failed') {
        logger.info(`Job ${requestId} already ${state}, no need to cancel further`);
        await cleanupPartialRecipeCache(requestId);
        return res.status(200).json({
          success: true,
          message: `Recipe generation already ${state}`
        });
      }

      await job.updateData({
        ...job.data,
        cancelled: true
      });

      if (state === 'waiting' || state === 'delayed') {
         try {
             await job.remove();
             logger.info(`Removed job ${requestId} from queue as it was ${state}.`);
         } catch (removeError) {
             logger.error(`Failed to remove job ${requestId} after marking cancelled: ${removeError}`);
         }
      } else if (state === 'active') {
         logger.info(`Job ${requestId} is active. Worker needs to check the cancellation flag.`);
      }

      logger.info(`Job ${requestId} marked as cancelled in queue data`);
      await cleanupPartialRecipeCache(requestId);

      return res.status(200).json({
        success: true,
        message: 'Recipe generation cancellation requested'
      });
    } else {
      // Non-queue based cancellation
      const cancelled = cancelRequest(requestId);
      if (cancelled) {
        logger.info(`Request ${requestId} marked as cancelled (non-queue)`);
        await cleanupPartialRecipeCache(requestId);
        return res.status(200).json({
          success: true,
          message: 'Recipe generation cancelled'
        });
      } else {
        logger.warn(`Request ${requestId} not found for cancellation (non-queue)`);
        const partialRecipe = await getPartialRecipeFromCache(requestId);
         if (partialRecipe) {
            logger.warn(`Request ${requestId} not found in cancellation map, but partial data exists. Cleaning up cache.`);
            await cleanupPartialRecipeCache(requestId);
             return res.status(200).json({
                 success: true,
                 message: 'Recipe generation likely completed or failed before cancellation, cache cleaned.',
                  status: 'unknown_request_state'
             });
         } else {
            return res.status(404).json({
                success: false,
                message: 'Recipe generation request not found or already completed/cleaned up'
            });
         }
      }
    }
  } catch (error) {
    logger.error('Error cancelling recipe generation:', error);
    next(new AppError(`Failed to cancel recipe generation: ${error instanceof Error ? error.message : 'Unknown error'}`, 500));
  }
};


/**
 * Gets the status of a recipe generation job (handles both queued and non-queued)
 */
export const getRecipeStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { requestId } = req.params;
  if (!requestId) return next(new AppError('requestId is required', 400));

  const useQueueSystem = !!recipeQueue;

  if (useQueueSystem) {
    try {
      logger.info(`Checking status for recipe generation: ${requestId}`);
      const job = await recipeQueue.getJob(requestId);

      if (!job) {
        logger.warn(`Job not found for status check: ${requestId}`);
        const partialRecipe = await getPartialRecipeFromCache(requestId);

        if (partialRecipe) {
            const isLikelyComplete = partialRecipe.similarity_hash && partialRecipe.quality_score !== undefined;
            if (isLikelyComplete) {
                logger.info(`Job ${requestId} not found but likely complete partial recipe exists in cache.`);
                return res.status(200).json({
                    ...partialRecipe,
                    status: "completed",
                    progress: 100
                });
            } else {
                 logger.info(`Job ${requestId} not found but incomplete partial recipe exists in cache. Treating as 'unknown' or 'processing'.`);
                 return res.status(200).json({
                     status: "processing",
                     progress: partialRecipe.progress || 50,
                     requestId,
                     partialRecipe: partialRecipe,
                     message: "Job status uncertain, but partial data found."
                 });
            }
        } else {
          return res.status(404).json({
            status: 'not_found',
            message: 'Recipe generation job not found',
            requestId: requestId
          });
        }
      }

      const state = await job.getState();
      const progress = await job.progress || 0; // Use await for progress
      const jobData = job.data;

      logger.info(`Job ${requestId} is in state: ${state}, progress: ${progress}%`);

       if (jobData.cancelled) {
           logger.info(`Job ${requestId} was marked as cancelled.`);
           await cleanupPartialRecipeCache(requestId);
           return res.status(200).json({
               status: 'cancelled',
               message: 'Recipe generation was cancelled',
               requestId
           });
       }

      if (state === 'completed') {
        const result = await job.returnvalue;

        if (result?.error) {
             logger.error(`Job ${requestId} completed but reported failure: ${result?.error || job.failedReason}`);
             await cleanupPartialRecipeCache(requestId);
             return res.status(500).json({
                 status: 'failed',
                 message: `Recipe generation failed: ${result?.error || job.failedReason || 'Unknown error'}`,
                 requestId
             });
         }

        // --- MODIFICATION START: Fetch final recipe from DB on completion ---
        let finalRecipeData = result?.recipe as Recipe | undefined | null; // Get recipe from job result

        // OPTIONAL BUT RECOMMENDED: Fetch from DB as the absolute source of truth on completion
        if (finalRecipeData?.id) {
            logger.info(`Job ${requestId} completed. Verifying final data from DB for recipe ID: ${finalRecipeData.id}`);
            try {
                // Assuming getRecipeById exists in supabaseService and returns Recipe or null
                const dbRecipe = await getRecipeById(finalRecipeData.id); // Fetch final from DB
                if (dbRecipe) {
                    finalRecipeData = dbRecipe; // Use DB version if found
                    logger.info(`Successfully fetched final recipe ${finalRecipeData.id} from DB for completed job ${requestId}`);
                } else {
                     logger.warn(`Job ${requestId} completed, but recipe ${finalRecipeData.id} not found in DB. Using job return value.`);
                     // Fallback to using finalRecipeData from job.returnvalue
                }
            } catch (dbError) {
                 logger.error(`Error fetching completed recipe ${finalRecipeData.id} from DB for job ${requestId}. Falling back to job return value.`, dbError);
                 // Fallback to using finalRecipeData from job.returnvalue
            }
        } else {
            logger.warn(`Job ${requestId} completed, but no recipe ID found in job result. Cannot verify with DB.`);
            // Continue with finalRecipeData from job.returnvalue (might be null)
        }
        // --- MODIFICATION END ---


        if (finalRecipeData) {
          logger.info(`Job ${requestId} completed successfully.`);

          // Add debug logging for image URLs from the final data
          if (finalRecipeData.steps) {
            logger.info(`Recipe ${requestId} has ${finalRecipeData.steps.length} steps with images:`);
            for (let i = 0; i < finalRecipeData.steps.length; i++) {
              logger.info(`Step ${i} image_url: ${finalRecipeData.steps[i].image_url || 'NOT SET'}`);
            }
          }

          await cleanupPartialRecipeCache(requestId); // Clean up cache on success

          // Log the data being sent just before sending
          logger.debug(`[Controller] Sending final completed recipe response for ${requestId}:`, { recipe: finalRecipeData });

          return res.status(200).json({ // Return the potentially DB-refreshed recipe
            ...finalRecipeData,
            status: 'completed', // Add status field for clarity
            progress: 100
          });
        } else {
            logger.error(`Job ${requestId} completed but no recipe data found or returned.`);
            await cleanupPartialRecipeCache(requestId);
            return res.status(500).json({
                status: 'failed',
                message: 'Job completed but no recipe was generated',
                requestId
            });
          }
        }
        else if (state === 'failed') {
          logger.error(`Job ${requestId} failed. Reason: ${job.failedReason}`);
          await cleanupPartialRecipeCache(requestId);
          return res.status(500).json({
            status: 'failed',
            message: `Recipe generation failed: ${job.failedReason || 'Unknown reason'}`,
            requestId,
          });
        }

        if ((state === 'active' || state === 'waiting' || state === 'delayed') && jobData?.enableProgressiveDisplay) {
          const partialRecipe = await getPartialRecipeFromCache(requestId);

          // Add debug logging for partial recipe image URLs being sent
          if (partialRecipe && partialRecipe.steps) {
            logger.debug(`[Controller] Partial recipe ${requestId} has ${partialRecipe.steps.length} steps with images:`);
            for (let i = 0; i < partialRecipe.steps.length; i++) {
              logger.debug(`Step ${i} partial image_url: ${partialRecipe.steps[i].image_url || 'NOT SET'}`);
            }
          }

          // Log the partial data being sent
          logger.debug(`[Controller] Sending partial recipe response for ${requestId} (State: ${state}, Progress: ${progress}):`, { partialRecipe });

          return res.status(200).json({
            status: state,
            progress: progress,
            requestId,
            partialRecipe: partialRecipe || null // Send partial data if found
          });
        }

        // Default status response if not completed/failed and not progressive
        return res.status(200).json({
          status: state,
          progress,
          requestId
        });

      } catch (error) {
        logger.error('Error checking recipe status:', error);
        next(new AppError(`Failed to check recipe status: ${error instanceof Error ? error.message : 'Unknown error'}`, 500));
      }
    } else {
      // Handle status check if not using queue system (sync flow)
      const cancelled = isRequestCancelled(requestId);
      const partialRecipe = await getPartialRecipeFromCache(requestId);

       if (cancelled) {
           logger.info(`Sync request ${requestId} was marked cancelled.`);
           await cleanupPartialRecipeCache(requestId);
           return res.status(200).json({
               status: 'cancelled',
               message: 'Recipe generation was cancelled (sync flow)',
               requestId: requestId,
               partialRecipe: partialRecipe || null
           });
       } else if (partialRecipe) {
           logger.warn(`Sync request ${requestId} status checked - found partial cache data but not marked cancelled. Assuming incomplete.`);
            return res.status(200).json({
               status: 'processing',
               message: 'Partial data found, original synchronous request may have been interrupted or failed.',
               requestId: requestId,
               partialRecipe: partialRecipe
           });
       }
       else {
            logger.warn(`Sync request ${requestId} status check - not found in cancellation map or cache.`);
            return res.status(404).json({
                status: 'not_found',
                message: 'Recipe generation request not found, already completed/failed, or queue system not active',
                requestId: requestId
            });
       }
    }
  };
/**
 * Helper function to get partial recipe from cache
 */
async function getPartialRecipeFromCache(requestId: string): Promise<any | null> {
  try {
    const cacheKey = `recipe:${requestId}:partial`;

    if (redisClient instanceof Redis) {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            try { return JSON.parse(cachedData); }
            catch (e) { logger.error(`Failed to parse cached partial recipe from Redis for ${requestId}`, { error: e }); return null; }
        }
    }

   if (recipeCache instanceof Map) {
      const cachedString = recipeCache.get(cacheKey);
      if (cachedString) {
          try { return JSON.parse(cachedString); }
          catch (e) { logger.error(`Failed to parse cached partial recipe from Map for ${requestId}`, { error: e }); return null; }
      }
   }

    return null;
  } catch (e) {
    logger.error(`Error retrieving partial recipe from cache for ${requestId}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}


/**
 * Helper function to clean up the cache (Redis and fallback Map)
 */
async function cleanupPartialRecipeCache(requestId: string): Promise<void> {
  try {
    const cacheKey = `recipe:${requestId}:partial`;

    if (redisClient instanceof Redis) {
        const deletedCount = await redisClient.del(cacheKey);
        if (deletedCount > 0) { logger.info(`Cleaned up Redis cache for requestId: ${requestId}`); }
    }

   if (recipeCache instanceof Map) {
      if (recipeCache.delete(cacheKey)) { logger.info(`Cleaned up local Map cache for requestId: ${requestId}`); }
   }
  } catch (e) {
    logger.error(`Error cleaning up cache for ${requestId}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Checks if a queue processing system is active for recipe generation
 */
export const getQueueStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const isQueuePotentiallyActive = !!recipeQueue;
    let isActive = false;
    let counts = {};
    let canConnect = false;

    if (isQueuePotentiallyActive) {
        try {
            counts = await recipeQueue.getJobCounts();
            isActive = true;
            canConnect = true;
            logger.info('Queue system is active and connected.');
        } catch (queueError) {
            logger.error('Queue system found but failed to connect or get counts:', queueError);
            isActive = false;
            canConnect = false;
        }
    } else {
        logger.info('Queue system is not configured (recipeQueue object not found).');
    }

    res.status(200).json({
        queueConfigured: isQueuePotentiallyActive,
        queueConnected: canConnect,
        isQueueActive: isActive,
        counts: isActive ? counts : {},
        pollingRecommended: isActive,
        progressiveDisplayEnabled: isActive
    });

  } catch (error) {
    logger.error('Error getting queue status:', error);
    next(new AppError(`Failed to get queue status: ${error instanceof Error ? error.message : 'Unknown error'}`, 500));
  }
};