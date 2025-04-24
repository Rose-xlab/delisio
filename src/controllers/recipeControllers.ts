// src/controllers/recipeControllers.ts
import { Request, Response, NextFunction } from 'express';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { generateRecipeContent } from '../services/gptService';
import { generateImage } from '../services/dalleService';
import { extractNutrition } from '../services/nutritionService';
import { uploadImageToStorage, saveRecipe } from '../services/supabaseService';
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

// --- FIX START: Declare recipeCache as a fallback ---
// This serves as a simple in-memory cache if Redis is not configured/available.
// NOTE: This cache is process-specific and will be lost on restart.
// NOTE: Ensure `updatePartialRecipe` service also writes to this cache in the fallback scenario.
const recipeCache = new Map<string, string>(); // Storing as stringified JSON
// --- FIX END ---


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

      // --- Access user info safely from req object ---
      // Type assertion is needed if using custom middleware to attach user
      const userId = (req as any).user?.id;
      const userPreferences = (req as any).user?.preferences;
      // Get subscription tier from request (added by subscription middleware)
      const subscriptionTier = (req as any).subscriptionTier || 'free';
      // --- End safe access ---

      // Add the job to the queue
      const job = await recipeQueue.add(
        'generate-recipe', // Job name
        { // Job data
          query,
          userPreferences: userPreferences, // Pass potentially undefined preferences
          requestId,
          userId: userId, // Pass potentially undefined userId
          save,
          enableProgressiveDisplay: true, // Enable progressive display feature
          subscriptionTier: subscriptionTier // Add subscription tier to job data
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

  // --- Access user info safely from req object ---
  const userId = (req as any).user?.id; // Keep userId available in scope
  const userPreferences = (req as any).user?.preferences;
  // Get subscription tier from request (added by subscription middleware)
  const subscriptionTier = (req as any).subscriptionTier || 'free';
  // --- End safe access ---

  registerRequest(requestId); // Register for cancellation tracking

  // Initialize parsedRecipeData
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
        // Assuming time fields are part of parsedRecipeData if they exist
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
    parsedRecipeData.requestId = requestId; // Add requestId AFTER parsing
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
      // --- FIX: Removed userId property as it's not in Recipe type ---
    };

    // Pass initialRecipe to updatePartialRecipe
    // Assuming updatePartialRecipe stringifies the data for caching
    await updatePartialRecipe(requestId, initialRecipe);

    const qualityScore = await evaluateRecipeQuality(initialRecipe);
    logger.info(`Quality evaluation: ${qualityScore.overall}/10 (Sync Flow)`);
    let workingRecipe = initialRecipe;
    if (!qualityScore.isPassingThreshold) {
        logger.info(`Enhancing recipe quality (Sync Flow).`);
        workingRecipe = await enhanceRecipeQuality(initialRecipe, qualityScore);
        workingRecipe.quality_score = qualityScore.overall; // Ensure score is updated
        await updatePartialRecipe(requestId, workingRecipe); // Update cache with enhanced data
    } else {
        workingRecipe.quality_score = qualityScore.overall; // Store the initial passing score
        await updatePartialRecipe(requestId, workingRecipe); // Update cache even if not enhanced
    }
    if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }

    // Step 4: Categorize the recipe
    logger.info(`Categorizing recipe: ${workingRecipe.title} (Sync Flow)`);
    const { category, tags } = await categorizeRecipe(workingRecipe);
    workingRecipe.category = category; workingRecipe.tags = tags;
    await updatePartialRecipe(requestId, workingRecipe); // Update cache with category/tags

    // Step 5: Check for duplicates
    logger.info(`Checking for duplicates: ${workingRecipe.title} (Sync Flow)`);
    const similarityHash = generateSimilarityHash(workingRecipe);
    // Assign hash to working recipe BEFORE duplicate check if check uses it
    workingRecipe.similarity_hash = similarityHash;
    await updatePartialRecipe(requestId, workingRecipe); // Update cache with hash
    const duplicateCheck = await checkForDuplicates(workingRecipe);
    let mergedRecipe: Recipe | null = null; // Variable to hold potential merged recipe
    if (duplicateCheck.isDuplicate && duplicateCheck.existingRecipeId) {
        logger.info(`Duplicate found (Existing ID: ${duplicateCheck.existingRecipeId}). Merging... (Sync Flow)`);
        // Assuming mergeRecipes returns the merged recipe object
        mergedRecipe = await mergeRecipes(workingRecipe, duplicateCheck.existingRecipeId);
        // Potentially update the workingRecipe or use mergedRecipe directly going forward
        // For simplicity, let's assume mergeRecipes updates the DB and returns the canonical version
        // If we need to return the *merged* version, we'd replace `workingRecipe` with `mergedRecipe`
        // For now, we log and potentially stop saving the *new* one later.
    } else {
        logger.info(`Recipe is not a duplicate (Sync Flow).`);
    }
    if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }

    // Step 6: Process images sequentially with subscription-based quality
    let stepsWithImages: RecipeStep[] = [];
    if (workingRecipe.steps && workingRecipe.steps.length > 0) {
        logger.info(`Processing images sequentially for ${workingRecipe.steps.length} steps (Sync Flow)...`);
        for (const [index, step] of workingRecipe.steps.entries()) {
            if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }
            const stepText = step.text || `Step ${index + 1}`;
            const illustrationPrompt = step.illustration || stepText; // Use provided illustration or fallback to text
            
            // Create the prompt for realistic image
            const imagePrompt = `Step ${index + 1} for recipe '${workingRecipe.title}': ${illustrationPrompt}. Professional food photography showing the cooking process.`;
            
            let permanentUrl: string | undefined = undefined;
            try {
                logger.info(`Requesting realistic temporary image URL for step ${index + 1}...`);
                // Pass subscription tier to image generation
                const tempImageUrl = await generateImage(imagePrompt, subscriptionTier as SubscriptionTier);
                if (tempImageUrl) {
                    logger.info(`Downloading temporary image for step ${index + 1}...`);
                    const imageResponse = await fetch(tempImageUrl);
                    if (!imageResponse.ok) throw new Error(`Failed to download image: ${imageResponse.statusText}`);
                    const imageData = Buffer.from(await imageResponse.arrayBuffer());
                    logger.info(`Uploading image data for step ${index + 1} (${imageData.length} bytes)...`);
                    const filePath = `public/steps/${recipeId}/${index}.png`; // Use unique recipeId
                    permanentUrl = await uploadImageToStorage(imageData, filePath, 'image/png');
                    logger.info(`Supabase Storage URL for step ${index + 1}: ${permanentUrl}`);

                    // Update the specific step in the working recipe
                    if (workingRecipe.steps) { // Type guard
                      workingRecipe.steps[index] = { ...step, image_url: permanentUrl };
                      // Update the partial recipe in cache with the new image URL
                      await updatePartialRecipe(requestId, workingRecipe);
                    }

                } else { logger.warn(`No temporary image URL for step ${index + 1}.`); }
            } catch (error) { logger.error(`Failed to process image for step ${index + 1} (Sync Flow):`, error); }
            // Add step to the new array, ensuring text/illustration/url are included
            stepsWithImages.push({
                text: stepText,
                illustration: illustrationPrompt, // Keep the prompt used
                image_url: permanentUrl // Add the generated URL (or undefined)
            });
            if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }
        }
        logger.info(`Finished processing realistic images sequentially (Sync Flow).`);
        // Update the workingRecipe's steps with the ones containing URLs
        workingRecipe.steps = stepsWithImages;
        // Final update with all images processed
        await updatePartialRecipe(requestId, workingRecipe);
    } else { logger.info("Skipping image processing - no steps (Sync Flow)."); }
    if (isRequestCancelled(requestId)) { throw new AppError('Recipe generation cancelled', 499); }


    // Step 7: Nutrition Info
    let nutritionInfo: NutritionInfo = { calories: 0, protein: '0g', fat: '0g', carbs: '0g' }; // Default structure
    // Check if nutrition exists and calories is a number (basic validation)
    if (workingRecipe.nutrition && typeof workingRecipe.nutrition.calories === 'number') {
         logger.info("Using nutrition info parsed from AI response.");
         // Ensure all parts are strings as per NutritionInfo model (except calories)
         nutritionInfo = {
             calories: workingRecipe.nutrition.calories ?? 0,
             protein: String(workingRecipe.nutrition.protein ?? '0g'),
             fat: String(workingRecipe.nutrition.fat ?? '0g'),
             carbs: String(workingRecipe.nutrition.carbs ?? '0g'),
         };
    } else {
         logger.info("Nutrition info missing or invalid in AI response, trying to extract...");
         try {
             // Ensure ingredients is an array of strings if needed by extractNutrition
             // --- FIX: Cast 'ing' to 'any' to access properties ---
             const ingredientsList = workingRecipe.ingredients?.map((ing: any) => `${ing.quantity ?? ''} ${ing.unit ?? ''} ${ing.name}`) ?? [];
             nutritionInfo = await extractNutrition(workingRecipe.title ?? query, ingredientsList);
             logger.info("Extracted nutrition info:", nutritionInfo);
         } catch (nutriError) {
             logger.error("Failed to extract nutrition info:", nutriError);
             // Keep the default nutritionInfo if extraction fails
         }
    }
    workingRecipe.nutrition = nutritionInfo; // Update working recipe
    await updatePartialRecipe(requestId, workingRecipe); // Update cache with nutrition


    // Step 8: Construct final complete recipe object
    // If a merge happened and we decided to use the merged result:
    const finalRecipeData = mergedRecipe ? mergedRecipe : workingRecipe;

    // Ensure all required fields from Recipe interface are included
    // Use data from `finalRecipeData` which is either the original enhanced recipe or the merged one
    const completeRecipe: Recipe = {
      id: finalRecipeData.id, // Use ID from final data (could be existing ID if merged)
      title: finalRecipeData.title,
      servings: finalRecipeData.servings,
      ingredients: finalRecipeData.ingredients,
      steps: finalRecipeData.steps, // Use steps processed with images
      nutrition: finalRecipeData.nutrition, // Use populated nutritionInfo
      query: query, // Original query
      createdAt: finalRecipeData.createdAt ?? new Date(), // Use existing or new date
      prepTime: finalRecipeData.prepTime,
      cookTime: finalRecipeData.cookTime,
      totalTime: finalRecipeData.totalTime,
      requestId: requestId, // The ID for *this* generation request
      category: finalRecipeData.category, // Use value from step 4
      tags: finalRecipeData.tags,         // Use value from step 4
      similarity_hash: finalRecipeData.similarity_hash, // Use value from step 5
      quality_score: finalRecipeData.quality_score, // Use final score
      // --- FIX: Removed userId property as it's not in Recipe type ---
    };
    logger.info(`Constructed complete recipe: "${completeRecipe.title}" with realistic images (Sync Flow)`);


    // Step 9: Save to global database if not a duplicate OR if merge logic allows update
    // We only save if it's NOT a duplicate that we didn't merge/update.
    // If `mergedRecipe` exists, the canonical version might already be up-to-date via `mergeRecipes`.
    // If it wasn't a duplicate, we save the new `completeRecipe`.
    if (!duplicateCheck.isDuplicate) {
        logger.info(`Saving new recipe ${completeRecipe.id} to global collection...`);
        try {
            // Assume saveRecipe saves to a 'public' or 'global' recipes table/collection
            // --- FIX: Pass empty string '' to satisfy string type requirement for userId ---
            // NOTE: This relies on the saveRecipe implementation handling '' as a "no user/global" case.
            // The ideal fix is changing saveRecipe signature to accept string | null | undefined.
            await saveRecipe(completeRecipe, ''); // Pass '' for global save case
            logger.info(`Recipe ${completeRecipe.id} saved globally.`);
        } catch (saveError) {
            logger.error(`Failed to save recipe ${completeRecipe.id} globally:`, saveError);
            // Decide if this should be a critical error
        }
    } else if (mergedRecipe) {
        logger.info(`Skipping separate global save for ${completeRecipe.id} as it was merged into ${mergedRecipe.id}.`);
        // Merge logic should have handled persistence of the canonical recipe.
    }

    // Save to user's collection if requested and user exists
    // Note: userId here is the variable from the function scope, confirmed available if needed
    if (userId && save) {
       logger.info(`Saving recipe ${completeRecipe.id} to user ${userId}'s collection...`);
        try {
            // Use the existing saveRecipe function, passing the userId
            await saveRecipe(completeRecipe, userId); // userId is confirmed string here
            logger.info(`Recipe ${completeRecipe.id} saved for user ${userId}.`);
        } catch (userSaveError) {
            logger.error(`Failed to save recipe ${completeRecipe.id} for user ${userId}:`, userSaveError);
            // Decide if this should be a critical error for the user request
        }
    }

    cleanupRequest(requestId);
    // Return the final recipe data (either newly generated or the result of a merge)
    res.status(200).json(completeRecipe);

  } catch (error) {
    logger.error('Error in generateRecipeOriginal controller (Sync Flow):', error);
    cleanupRequest(requestId); // Ensure cleanup on error
    next(error); // Pass error to error handling middleware
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
        // Check cache as well, maybe it finished but cancellation arrived late
        const partialRecipe = await getPartialRecipeFromCache(requestId);
        if (partialRecipe) {
            logger.warn(`Job ${requestId} not found, but partial data exists. Cleaning up cache.`);
            await cleanupPartialRecipeCache(requestId);
            // Respond indicating it likely finished or failed already, but acknowledge cancel attempt
             return res.status(200).json({
                success: true, // Or false? Maybe true is better UX.
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

      // --- FIX: Removed check for 'cancelled' state string ---
      if (state === 'completed' || state === 'failed') {
        logger.info(`Job ${requestId} already ${state}, no need to cancel further`);
         // Clean up cache just in case it wasn't cleaned properly on completion/failure
         await cleanupPartialRecipeCache(requestId);
        return res.status(200).json({
          success: true,
          message: `Recipe generation already ${state}`
        });
      }

      // Update job data to mark as cancelled - worker needs to check this flag
      // Note: This doesn't stop the *currently running* step in BullMQ directly
      // The worker logic MUST check job.data.cancelled periodically.
      await job.updateData({
        ...job.data,
        cancelled: true
      });

      // Optionally, try to remove the job if it's waiting or delayed
      if (state === 'waiting' || state === 'delayed') {
          try {
              await job.remove();
              logger.info(`Removed job ${requestId} from queue as it was ${state}.`);
          } catch (removeError) {
              logger.error(`Failed to remove job ${requestId} after marking cancelled: ${removeError}`);
          }
      } else if (state === 'active') {
          // If active, we rely on the worker checking the 'cancelled' flag in job data.
          logger.info(`Job ${requestId} is active. Worker needs to check the cancellation flag.`);
          // Consider sending an interrupt signal if possible/needed, but BullMQ doesn't have direct process interrupt.
      }


      logger.info(`Job ${requestId} marked as cancelled in queue data`);

      // Clean up the partial recipe cache immediately
      await cleanupPartialRecipeCache(requestId);

      return res.status(200).json({
        success: true,
        message: 'Recipe generation cancellation requested' // More accurate message
      });
    } else {
      // Non-queue based cancellation
      const cancelled = cancelRequest(requestId); // Uses the cancellationMiddleware map
      if (cancelled) {
        logger.info(`Request ${requestId} marked as cancelled (non-queue)`);
         // Also clean up the fallback cache for non-queue flow
         await cleanupPartialRecipeCache(requestId);
        return res.status(200).json({
          success: true,
          message: 'Recipe generation cancelled'
        });
      } else {
        logger.warn(`Request ${requestId} not found for cancellation (non-queue)`);
        // Check cache even in non-queue mode? Depends if updatePartialRecipe uses it.
        // Assuming yes based on its structure.
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
        // Check if we have a final recipe in cache (maybe job was removed after completion)
        const partialRecipe = await getPartialRecipeFromCache(requestId); // Check cache regardless

        if (partialRecipe) {
            // Check if the cached data indicates completion (e.g., has all expected final fields)
            // This is a heuristic. A better way would be a dedicated 'completed' flag in the cache or a separate cache entry.
            // Let's assume if `similarity_hash` and `quality_score` exist, it's likely complete.
            const isLikelyComplete = partialRecipe.similarity_hash && partialRecipe.quality_score !== undefined;

            if (isLikelyComplete) {
                logger.info(`Job ${requestId} not found but likely complete partial recipe exists in cache.`);
                // Return the partial recipe with status "completed"
                return res.status(200).json({
                    ...partialRecipe, // Send the cached data
                    status: "completed",
                    progress: 100
                });
            } else {
                 logger.info(`Job ${requestId} not found but incomplete partial recipe exists in cache. Treating as 'unknown' or 'processing'.`);
                 // Return the partial data but indicate the job state is uncertain
                 return res.status(200).json({
                    status: "processing", // Or 'unknown'
                    progress: partialRecipe.progress || 50, // Estimate progress based on available data? Risky.
                    requestId,
                    partialRecipe: partialRecipe,
                    message: "Job status uncertain, but partial data found."
                });
            }
        } else {
          // No job, no cache -> Not found
          return res.status(404).json({
            status: 'not_found',
            message: 'Recipe generation job not found',
            requestId: requestId
          });
        }
      }

      const state = await job.getState();
      const progress = job.progress || 0; // BullMQ job progress (0-100)
      const jobData = job.data; // Access job data

      logger.info(`Job ${requestId} is in state: ${state}, progress: ${progress}%`);

      // Check if job data indicates cancellation first
       if (jobData.cancelled) {
           logger.info(`Job ${requestId} was marked as cancelled.`);
           await cleanupPartialRecipeCache(requestId); // Ensure cache is cleaned
           return res.status(200).json({ // Use 200 OK for cancelled status poll
               status: 'cancelled',
               message: 'Recipe generation was cancelled',
               requestId
           });
       }

      if (state === 'completed') {
        const result = await job.returnvalue; // Result from the worker process

        // --- FIX: Removed check for result.status === 'cancelled' ---
        // Cancellation is checked via jobData.cancelled before this block

        // --- FIX: Check only for result.error to determine failure ---
        if (result?.error) {
             logger.error(`Job ${requestId} completed but reported failure: ${result?.error || job.failedReason}`);
             await cleanupPartialRecipeCache(requestId);
             return res.status(500).json({
                 status: 'failed',
                 message: `Recipe generation failed: ${result?.error || job.failedReason || 'Unknown error'}`,
                 requestId
             });
         }

        if (result?.recipe) {
            logger.info(`Job ${requestId} completed successfully.`);
            // The save logic might be better placed *within* the worker upon successful completion.
            // If kept here, ensure it doesn't block the response for too long.
            const userId = (req as any).user?.id; // Get user id from request context again if needed
            if (userId && job.data.save) { // Check original request intention
                try {
                    await saveRecipe(result.recipe, userId); // Pass actual userId (string)
                    logger.info(`Recipe ${result.recipe.id} saved for user ${userId} after job completion.`);
                } catch (saveError) {
                    logger.error('Error saving recipe post-completion:', saveError);
                    // Log error but still return the recipe to the user
                }
            }

            await cleanupPartialRecipeCache(requestId); // Clean up cache on success
            return res.status(200).json({ // Return the full recipe
                 ...result.recipe,
                 status: 'completed', // Add status field for clarity
                 progress: 100
             });
        } else {
             // Completed but no recipe in result - treat as error
            logger.error(`Job ${requestId} completed but no recipe data returned.`);
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
            await cleanupPartialRecipeCache(requestId); // Clean up cache on failure
            return res.status(500).json({
              status: 'failed',
              message: `Recipe generation failed: ${job.failedReason || 'Unknown reason'}`,
              requestId,
              // errorReason: job.failedReason // You can expose the raw reason if needed
            });
          }
    
          // For active/waiting/delayed jobs, check cache for partial results if progressive display enabled
           // Ensure job.data exists before checking enableProgressiveDisplay
          if ((state === 'active' || state === 'waiting' || state === 'delayed') && jobData?.enableProgressiveDisplay) {
            const partialRecipe = await getPartialRecipeFromCache(requestId);
            return res.status(200).json({ // Return 200 OK while processing
              status: state, // active, waiting, delayed
              progress: progress,
              requestId,
              partialRecipe: partialRecipe || null // Send partial data if found
            });
          }
    
          // Default status response for other states (or if progressive display is off)
          return res.status(200).json({ // Return 200 OK for status update
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
        // In sync flow, the request either completes, fails, or might be cancelled *during* execution.
        // There's no persistent "job" to check status for after the initial request returns.
        // We can check the cancellation map, but that only tells us if a cancellation *was attempted*.
        // We can also check the fallback cache.
    
        const cancelled = isRequestCancelled(requestId); // Check cancellation map (only relevant if called *during* generation)
        const partialRecipe = await getPartialRecipeFromCache(requestId); // Check cache
    
         if (cancelled) {
             logger.info(`Sync request ${requestId} was marked cancelled.`);
             // Cache might have partial data if cancellation happened mid-way
             await cleanupPartialRecipeCache(requestId); // Clean cache on cancel acknowledgement
             return res.status(200).json({ // Use 200 OK for cancelled status
                 status: 'cancelled',
                 message: 'Recipe generation was cancelled (sync flow)',
                 requestId: requestId,
                 partialRecipe: partialRecipe || null // Include partial if exists
             });
         } else if (partialRecipe) {
             // If not explicitly cancelled, but cache exists, it means the original request failed/ended prematurely
             // Or this status endpoint is being called *after* a successful sync completion (unlikely use case).
             // Let's assume it implies an incomplete/failed state if the original request didn't return 200.
             logger.warn(`Sync request ${requestId} status checked - found partial cache data but not marked cancelled. Assuming incomplete.`);
              return res.status(200).json({ // Return 200 OK but indicate issue
                 status: 'processing', // Or 'unknown' / 'failed_sync'?
                 message: 'Partial data found, original synchronous request may have been interrupted or failed.',
                 requestId: requestId,
                 partialRecipe: partialRecipe
             });
         }
         else {
             // No cancellation flag, no cache -> request likely never started, completed successfully (and cache cleaned), or failed cleanly.
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
     * Attempts Redis first, then falls back to the in-memory Map.
     */
    async function getPartialRecipeFromCache(requestId: string): Promise<any | null> {
      try {
        const cacheKey = `recipe:${requestId}:partial`;
    
        // Try Redis first
        if (redisClient instanceof Redis) {
            // Optional: Add a quick ping check, but be mindful of overhead
            // if (await redisClient.ping() !== 'PONG') throw new Error('Redis connection failed');
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                try {
                return JSON.parse(cachedData);
                } catch (e) {
                logger.error(`Failed to parse cached partial recipe from Redis for ${requestId}`, { error: e });
                return null; // Parse error
                }
            }
            // No data in Redis, fall through to check Map
        }
    
    // Fallback to in-memory Map
         // No need for typeof check now since it's declared in this scope
         if (recipeCache instanceof Map) { // Keep instanceof for type safety maybe? or just recipeCache.has()
          const cachedString = recipeCache.get(cacheKey);
          if (cachedString) {
              try {
                  // --- FIX: Parse JSON when retrieving from Map --- (Already done in previous fix)
                  return JSON.parse(cachedString);
              } catch (e) {
                  logger.error(`Failed to parse cached partial recipe from Map for ${requestId}`, { error: e });
                  return null; // Parse error
              }
          }
      }
 
 
     // Not found in either cache
     return null;
   } catch (e) {
     // Log errors accessing either cache
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
 
     // Clean Redis
     if (redisClient instanceof Redis) {
         // Optional: Add ping check
         // if (await redisClient.ping() === 'PONG') {
             const deletedCount = await redisClient.del(cacheKey);
             if (deletedCount > 0) {
                 logger.info(`Cleaned up Redis cache for requestId: ${requestId}`);
             }
         // }
     }
 
     // Clean fallback Map
      // No need for typeof check now
     if (recipeCache instanceof Map) { // Keep instanceof check or just recipeCache.delete()
       if (recipeCache.delete(cacheKey)) { // delete returns true if key existed
         logger.info(`Cleaned up local Map cache for requestId: ${requestId}`);
       }
     }
   } catch (e) {
     logger.error(`Error cleaning up cache for ${requestId}: ${e instanceof Error ? e.message : String(e)}`);
     // Don't throw - this is best-effort cleanup code
   }
 }
 
 /**
  * Checks if a queue processing system is active for recipe generation
  */
 export const getQueueStatus = async (_req: Request, res: Response, next: NextFunction) => {
   try {
     const isQueuePotentiallyActive = !!recipeQueue; // Check if queue object exists
     let isActive = false;
     let counts = {};
     let canConnect = false;
 
     if (isQueuePotentiallyActive) {
         // Add a check to see if the queue can actually connect to Redis
         try {
             // A quick check like getting job counts requires connection
              counts = await recipeQueue.getJobCounts();
              // You could also check redisClient connection directly if available and configured
              // For simplicity, assume getJobCounts succeeding means it's active
              isActive = true;
              canConnect = true; // Assumed if getJobCounts worked
              logger.info('Queue system is active and connected.');
         } catch (queueError) {
             logger.error('Queue system found but failed to connect or get counts:', queueError);
             // Queue object exists but isn't working (e.g., Redis down)
             isActive = false;
             canConnect = false;
         }
     } else {
          logger.info('Queue system is not configured (recipeQueue object not found).');
     }
 
      res.status(200).json({
          queueConfigured: isQueuePotentiallyActive, // Was the queue object imported/created?
          queueConnected: canConnect, // Can the queue connect to its backend (Redis)?
          isQueueActive: isActive, // Is it configured AND connected?
          counts: isActive ? counts : {}, // Only show counts if active
          pollingRecommended: isActive, // Recommend polling only if queue is truly active
          progressiveDisplayEnabled: isActive // Progressive display relies on active queue/cache
      });
 
   } catch (error) {
     logger.error('Error getting queue status:', error);
     next(new AppError(`Failed to get queue status: ${error instanceof Error ? error.message : 'Unknown error'}`, 500));
   }
 };