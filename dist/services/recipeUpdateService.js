"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePartialRecipe = void 0;
// src/services/recipeUpdateService.ts
const ioredis_1 = require("ioredis");
const redis_1 = require("../config/redis"); // Assuming redisClient is exported correctly
const logger_1 = require("../utils/logger");
// Cache store for partial recipes (Redis or in-memory fallback)
// Use the imported redisClient if available, otherwise fallback to Map storing stringified JSON.
// --- FIX: Define Map type as Map<string, string> ---
const recipeCache = redis_1.redisClient instanceof ioredis_1.Redis ? redis_1.redisClient : new Map();
const useRedis = redis_1.redisClient instanceof ioredis_1.Redis;
/**
 * Calculate progress percentage based on completed steps in a partial recipe
 */
function calculateProgress(recipe) {
    // If steps array is empty or not present, assume base content generation is done (e.g., 40%)
    // If steps exist but none have images, progress remains at the base level.
    if (!recipe.steps || recipe.steps.length === 0)
        return 40;
    // Count steps with non-null/non-empty image_url
    const stepsWithImages = recipe.steps.filter((step) => !!step.image_url).length;
    // Base progress: 40% for having recipe text + remaining 60% distributed among images
    const baseProgress = 40;
    // Calculate image progress only if there are steps to avoid division by zero
    const imageProgress = recipe.steps.length > 0 ? (stepsWithImages / recipe.steps.length) * 60 : 0;
    // Cap progress at 100
    return Math.min(100, Math.floor(baseProgress + imageProgress));
}
/**
 * Updates a partial recipe in the cache (Redis or in-memory) with new information
 * as it becomes available during background job processing.
 * Stores data as stringified JSON in both Redis and the Map fallback.
 * This function is safe to call from workers as it has no 'req' dependency.
 */
const updatePartialRecipe = async (requestId, recipeData, // Base recipe data, potentially updated
stepIndex, // Index of the step being updated (optional)
imageUrl // URL of the image for the step (optional, null if failed?)
) => {
    const cacheKey = `recipe:${requestId}:partial`;
    try {
        let partialRecipe = null; // Initialize to null
        // 1. Get existing partial recipe from cache and parse it
        if (useRedis && redis_1.redisClient) { // Ensure redisClient is usable
            try {
                const cachedData = await recipeCache.get(cacheKey);
                if (cachedData) {
                    partialRecipe = JSON.parse(cachedData);
                }
            }
            catch (redisError) {
                logger_1.logger.error(`Redis GET error for ${cacheKey}: ${redisError instanceof Error ? redisError.message : redisError}`);
                // Decide if we should proceed assuming no cache or return false
                // For robustness, let's try to continue assuming cache miss
                partialRecipe = null;
            }
        }
        else if (!useRedis) { // Using Map
            // --- FIX: Get string from Map and parse it ---
            const cachedString = recipeCache.get(cacheKey);
            if (cachedString) {
                try {
                    partialRecipe = JSON.parse(cachedString);
                }
                catch (e) {
                    logger_1.logger.error(`Failed to parse cached partial recipe from Map for ${requestId}`, { error: e });
                    partialRecipe = null; // Treat as if not found if parse fails
                }
            }
        }
        else {
            // This case should ideally not happen if redisClient is checked properly
            logger_1.logger.error(`Cache misconfiguration for ${requestId}. Neither Redis nor Map seem active.`);
            return false;
        }
        // 2. Initialize or Merge Data
        if (!partialRecipe) {
            // First time seeing this requestId, initialize from recipeData
            logger_1.logger.info(`Initializing partial recipe cache for ${requestId}`);
            partialRecipe = {
                ...recipeData, // Spread base data
                // Ensure steps array exists and initialize image_url to null
                steps: (recipeData.steps || []).map((step) => ({
                    ...step,
                    image_url: step.image_url !== undefined ? step.image_url : null // Preserve existing null/url if provided in recipeData
                })),
                isPartial: true, // Mark as partial
                progress: 0, // Initial progress (will be recalculated)
            };
        }
        else {
            // Merge new base data (e.g., if quality enhancement updated title/tags)
            logger_1.logger.info(`Merging partial recipe cache for ${requestId}`);
            // Carefully merge to preserve existing step image URLs unless overridden by recipeData
            const existingSteps = partialRecipe.steps || [];
            const newStepsData = recipeData.steps || [];
            partialRecipe = {
                ...partialRecipe, // Keep existing data (like already fetched image URLs)
                ...recipeData, // Overwrite base fields with newer data from recipeData
                // Merge steps: prioritize data from recipeData, but keep existing image_url if recipeData doesn't provide one for that step
                steps: newStepsData.map((newStep, index) => {
                    const existingStep = existingSteps[index] || {};
                    return {
                        ...existingStep, // Start with existing (preserves image_url initially)
                        ...newStep, // Overwrite with new text/illustration etc.
                        // Explicitly keep existing image_url *unless* newStep provides one (even if null)
                        image_url: newStep.image_url !== undefined ? newStep.image_url : existingStep.image_url,
                    };
                }),
            };
            // Ensure steps array length matches recipeData if recipeData provided steps
            if (recipeData.steps) {
                partialRecipe.steps = partialRecipe.steps.slice(0, recipeData.steps.length);
            }
        }
        // 3. Update the specific step's image URL if stepIndex and imageUrl are provided
        if (stepIndex !== undefined && partialRecipe.steps && partialRecipe.steps.length > stepIndex) {
            // Only update if imageUrl argument was explicitly passed (could be null)
            if (imageUrl !== undefined) {
                partialRecipe.steps[stepIndex].image_url = imageUrl;
                partialRecipe.lastUpdatedStep = stepIndex; // Track last updated step
                logger_1.logger.info(`Updated step ${stepIndex} image URL for ${requestId}`);
            }
        }
        // 4. Recalculate progress
        partialRecipe.progress = calculateProgress(partialRecipe);
        partialRecipe.isPartial = partialRecipe.progress < 100; // Update partial status based on progress
        // 5. Save updated partial recipe back to cache (as stringified JSON)
        const dataToStore = JSON.stringify(partialRecipe);
        if (useRedis && redis_1.redisClient) { // Ensure redisClient is usable
            try {
                // Set with expiration (e.g., 1 hour = 3600 seconds)
                await recipeCache.set(cacheKey, dataToStore, 'EX', 3600);
            }
            catch (redisError) {
                logger_1.logger.error(`Redis SET error for ${cacheKey}: ${redisError instanceof Error ? redisError.message : redisError}`);
                // Decide if this is critical. Maybe log and return true as merge happened in memory?
                // Or return false to signal persistence failed. Let's return false.
                return false;
            }
        }
        else if (!useRedis) { // Using Map
            // --- FIX: Save the stringified data to the Map ---
            recipeCache.set(cacheKey, dataToStore);
            // Note: No automatic expiration for Map. Consider adding manual cleanup logic
            // for long-running processes if memory usage becomes a concern.
            // Example: setTimeout(() => recipeCache.delete(cacheKey), 3600 * 1000); (Needs careful management)
        }
        logger_1.logger.info(`Successfully updated partial recipe cache for ${requestId}, progress: ${partialRecipe.progress}%`);
        return true; // Indicate success
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger_1.logger.error(`Error updating partial recipe cache for ${requestId}: ${errorMsg}`, { stack: error instanceof Error ? error.stack : undefined });
        return false; // Indicate failure
    }
};
exports.updatePartialRecipe = updatePartialRecipe;
//# sourceMappingURL=recipeUpdateService.js.map