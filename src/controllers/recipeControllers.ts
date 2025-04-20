// src/controllers/recipeControllers.ts
import axios from 'axios';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { generateRecipeContent } from '../services/gptService';
import { generateImage } from '../services/dalleService';
import { extractNutrition } from '../services/nutritionService';
import { uploadImageToStorage } from '../services/supabaseService';
import { Recipe, RecipeStep, NutritionInfo, validateRecipe } from '../models/Recipe';
import { AppError } from '../middleware/errorMiddleware';
import { registerRequest, isRequestCancelled, cleanupRequest, cancelRequest } from '../middleware/cancellationMiddleware';
import { evaluateRecipeQuality, enhanceRecipeQuality, categorizeRecipe } from '../services/qualityService';
import { checkForDuplicates, mergeRecipes, generateSimilarityHash } from '../services/duplicateDetectionService';
import { saveRecipe } from '../services/supabaseService';
import { logger } from '../utils/logger';

/**
 * Generates a complete recipe including optional time fields and permanent image URLs.
 * Enhanced with quality control, duplicate detection, and automatic categorization.
 */
export const generateRecipe = async (
  query: string,
  userPreferences?: {
    dietaryRestrictions?: string[],
    allergies?: string[],
    favoriteCuisines?: string[],
    cookingSkill?: string
  }
): Promise<Recipe> => {
  const recipeId = uuidv4();
  const requestId = uuidv4(); // Generate a unique request ID for cancellation tracking
  logger.info(`Generated unique ID for recipe: ${recipeId}, request ID: ${requestId}`);
  
  // Register this request with the cancellation system
  registerRequest(requestId);

  try {
    // Step 1: Generate recipe content JSON string
    logger.info(`Starting GPT recipe generation for request: ${requestId}`);
    const gptJsonResponse = await generateRecipeContent(query, userPreferences);
    
    // Check for cancellation after GPT content generation
    if (isRequestCancelled(requestId)) {
      logger.info(`Recipe generation was cancelled after GPT response: ${requestId}`);
      throw new AppError('Recipe generation cancelled', 499); // Custom status code for cancellation
    }
    
    logger.info("Received potential JSON response string from GPT service.");
    
    // Step 2: Parse and Validate JSON
    let parsedRecipeData: Partial<Recipe>;
    try {
        parsedRecipeData = JSON.parse(gptJsonResponse);
        logger.info("Successfully parsed JSON response string.");
        // Log the time fields from GPT response:
        logger.info("Time fields in GPT response:", {
          prepTime: parsedRecipeData.prepTime,
          cookTime: parsedRecipeData.cookTime,
          totalTime: parsedRecipeData.totalTime
        });
    } catch (jsonError) { 
        logger.error("JSON parsing error:", jsonError);
        throw new Error('Failed to parse recipe structure from AI response.'); 
    }
    
    if (!validateRecipe(parsedRecipeData)) { 
        logger.error("Recipe validation failed:", parsedRecipeData);
        throw new Error('AI response did not match expected recipe structure after parsing.'); 
    }
    
    logger.info(`Parsed recipe title: "${parsedRecipeData.title}", Steps found: ${parsedRecipeData.steps?.length ?? 0}`);
    
    // Add requestId to the recipe for tracking
    parsedRecipeData.requestId = requestId;

    // Check for cancellation after validation
    if (isRequestCancelled(requestId)) {
      logger.info(`Recipe generation was cancelled after JSON validation: ${requestId}`);
      throw new AppError('Recipe generation cancelled', 499);
    }
    
    // NEW: Step 3: Evaluate recipe quality
    logger.info(`Evaluating quality for recipe: ${parsedRecipeData.title}`);
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
    };
    
    const qualityScore = await evaluateRecipeQuality(initialRecipe);
    logger.info(`Quality evaluation for ${initialRecipe.title}: ${qualityScore.overall}/10`);
    
    // If quality is below threshold, enhance it
    let workingRecipe = initialRecipe;
    if (!qualityScore.isPassingThreshold) {
      logger.info(`Recipe quality below threshold (${qualityScore.overall}/10). Enhancing recipe.`);
      workingRecipe = await enhanceRecipeQuality(initialRecipe, qualityScore);
      logger.info(`Recipe enhanced: ${workingRecipe.title}`);
    }
    
    // Check for cancellation after quality control
    if (isRequestCancelled(requestId)) {
      logger.info(`Recipe generation was cancelled after quality control: ${requestId}`);
      throw new AppError('Recipe generation cancelled', 499);
    }
    
    // NEW: Step 4: Categorize the recipe
    logger.info(`Categorizing recipe: ${workingRecipe.title}`);
    const { category, tags } = await categorizeRecipe(workingRecipe);
    logger.info(`Recipe categorized as: ${category}, tags: ${tags.join(', ')}`);
    
    // NEW: Step 5: Check for duplicates
    logger.info(`Checking for duplicates of recipe: ${workingRecipe.title}`);
    const similarityHash = generateSimilarityHash(workingRecipe);
    const duplicateCheck = await checkForDuplicates(workingRecipe);
    
    // If it's a duplicate, merge with existing recipe
    if (duplicateCheck.isDuplicate && duplicateCheck.existingRecipeId) {
      logger.info(`Recipe is a duplicate (similarity: ${duplicateCheck.similarityScore.toFixed(2)}). Merging with existing recipe ID: ${duplicateCheck.existingRecipeId}`);
      
      try {
        // Merge the recipes but don't update the workingRecipe
        // as we still want to proceed with image generation for the user's copy
        const mergedRecipe = await mergeRecipes(workingRecipe, duplicateCheck.existingRecipeId);
        logger.info(`Recipes merged successfully. Existing recipe ID: ${mergedRecipe.id} updated.`);
      } catch (mergeError) {
        logger.error('Error merging recipes:', mergeError);
        // Continue with the original recipe even if merge fails
      }
    } else {
      logger.info(`Recipe is not a duplicate. Proceeding with new recipe.`);
    }
    
    // Check for cancellation after duplicate check
    if (isRequestCancelled(requestId)) {
      logger.info(`Recipe generation was cancelled after duplicate check: ${requestId}`);
      throw new AppError('Recipe generation cancelled', 499);
    }

    // Step 6: Process images sequentially (original step 3)
    let stepsWithImages: RecipeStep[] = [];
    if (workingRecipe.steps && workingRecipe.steps.length > 0) {
        logger.info(`Processing images sequentially for ${workingRecipe.steps.length} steps...`);
        for (const [index, step] of workingRecipe.steps.entries()) {
            // Check for cancellation before each image generation
            if (isRequestCancelled(requestId)) {
              logger.info(`Recipe generation was cancelled during image processing at step ${index + 1}: ${requestId}`);
              throw new AppError('Recipe generation cancelled', 499);
            }
            
            const stepText = step.text || `Step ${index + 1}`;
            const illustrationPrompt = step.illustration || stepText;
            const imagePrompt = `Cartoon-style illustration, clear and simple: ${illustrationPrompt}. Focus on the action for step ${index + 1} of cooking ${workingRecipe.title || query}.`;
            let permanentUrl: string | undefined = undefined;
            try {
                logger.info(`Requesting temporary image URL for step ${index + 1}...`);
                const tempImageUrl = await generateImage(imagePrompt);
                if (tempImageUrl) {
                    logger.info(`Downloading temporary image for step ${index + 1}...`);
                    const imageResponse = await axios.get(tempImageUrl, { responseType: 'arraybuffer' });
                    const imageData: Buffer = Buffer.from(imageResponse.data);
                    logger.info(`Uploading image data for step ${index + 1} (${imageData.length} bytes)...`);
                    const filePath = `public/steps/${recipeId}/${index}.png`;
                    permanentUrl = await uploadImageToStorage(imageData, filePath, 'image/png');
                    logger.info(`Supabase Storage URL for step ${index + 1}: ${permanentUrl}`);
                } else { logger.warn(`No temporary image URL for step ${index + 1}.`); }
            } catch (error) { logger.error(`Failed to process image for step ${index + 1}:`, error); }
            stepsWithImages.push({ text: stepText, illustration: illustrationPrompt, image_url: permanentUrl });
            
            // Check for cancellation after each image generation
            if (isRequestCancelled(requestId)) {
              logger.info(`Recipe generation was cancelled after processing image for step ${index + 1}: ${requestId}`);
              throw new AppError('Recipe generation cancelled', 499);
            }
        }
        logger.info("Finished processing images sequentially.");
    } else { logger.info("Skipping image processing as no steps were parsed."); }

    // Final cancellation check before completing
    if (isRequestCancelled(requestId)) {
      logger.info(`Recipe generation was cancelled after completing all steps: ${requestId}`);
      throw new AppError('Recipe generation cancelled', 499);
    }

    // Step 7: Nutrition Info (original step 4)
    let nutritionInfo: NutritionInfo = { calories: 0, protein: '0g', fat: '0g', carbs: '0g' };
    if (workingRecipe.nutrition && typeof workingRecipe.nutrition.calories === 'number') {
         logger.info("Using nutrition info parsed from AI response.");
         nutritionInfo = { calories: workingRecipe.nutrition.calories ?? 0, protein: workingRecipe.nutrition.protein?.toString() ?? '0g', fat: workingRecipe.nutrition.fat?.toString() ?? '0g', carbs: workingRecipe.nutrition.carbs?.toString() ?? '0g', };
    } else {
         logger.info("Nutrition info missing or invalid in AI response, trying to extract...");
         try {
              nutritionInfo = await extractNutrition(workingRecipe.title ?? query, workingRecipe.ingredients ?? []);
              logger.info("Extracted nutrition info:", nutritionInfo);
         } catch (nutriError) { logger.error("Failed to extract nutrition info:", nutriError); }
    }

    // Step 8: Construct final complete recipe object
    const completeRecipe: Recipe = {
      id: recipeId,
      title: workingRecipe.title,
      servings: workingRecipe.servings,
      ingredients: workingRecipe.ingredients,
      steps: stepsWithImages,
      nutrition: nutritionInfo,
      query: query,
      createdAt: new Date(),
      prepTime: workingRecipe.prepTime,
      cookTime: workingRecipe.cookTime,
      totalTime: workingRecipe.totalTime,
      requestId: requestId, // Store the request ID with the recipe for potential later cancellation
    };

    // Log final recipe object debug info
    logger.info(`Final recipe object time fields: prepTime=${completeRecipe.prepTime}, cookTime=${completeRecipe.cookTime}, totalTime=${completeRecipe.totalTime}`);
    logger.info(`Final recipe object includes requestId: ${completeRecipe.requestId}`);

    // NEW: Step 9: Save to global recipe database if not a duplicate
    // This happens regardless of whether the user chose to save it to their personal collection
    if (!duplicateCheck.isDuplicate) {
      try {
        // Create a "public" version of the recipe for the global database
        // We assign a null user_id to designate it as part of the global collection
        const globalRecipe = {
          ...completeRecipe,
          category: category,
          tags: tags,
          similarity_hash: similarityHash,
          quality_score: qualityScore.overall,
        };
        
        // Save to global collection - use a designated system user ID
        // or pass null/special value to indicate this is a global recipe
        await saveRecipe(globalRecipe, 'system');
        logger.info(`Recipe saved to global database with category: ${category}`);
      } catch (globalSaveError) {
        logger.error('Error saving to global database, continuing anyway:', globalSaveError);
        // Continue anyway - failure to save to global DB shouldn't affect the user's experience
      }
    }
    
    logger.info(`Successfully constructed complete recipe object for: "${completeRecipe.title}"`);
    
    // Don't clean up the request tracking yet - the client might still want to cancel
    // The request should be cleaned up after a timeout or when explicitly completed
    
    return completeRecipe;

  } catch (error) {
    // Only clean up request tracking on error
    // For successful requests, we keep the tracking active in case of delayed cancellation
    if (error instanceof AppError && error.statusCode === 499) {
      logger.info(`Cleaning up cancelled request: ${requestId}`);
      cleanupRequest(requestId);
      throw error;
    }
    
    logger.error('Error in top-level generateRecipe controller:', error);
    cleanupRequest(requestId);
    
    if (error instanceof Error) { throw new Error(`Failed to generate recipe: ${error.message}`); }
    else { throw new Error(`Failed to generate recipe due to an unknown error.`); }
  }
};

/**
 * Handle recipe generation cancellation
 * @param requestId The ID of the request to cancel
 * @returns Success status and message
 */
export const cancelRecipeGeneration = async (requestId: string): Promise<{ success: boolean, message: string }> => {
  if (!requestId) {
    throw new AppError('Request ID is required', 400);
  }
  
  try {
    logger.info(`Received cancellation request for requestId: ${requestId}`);
    
    // Check if the request exists in our tracking system
    const cancelled = cancelRequest(requestId);
    
    if (cancelled) {
      logger.info(`Successfully marked requestId ${requestId} as cancelled`);
      return {
        success: true,
        message: 'Recipe generation cancellation request received'
      };
    } else {
      logger.info(`RequestId ${requestId} not found or already completed`);
      return {
        success: false,
        message: 'Request ID not found or already completed'
      };
    }
  } catch (error) {
    logger.error('Error cancelling recipe generation:', error);
    throw new Error(`Failed to cancel recipe generation: ${(error as Error).message}`);
  }
};