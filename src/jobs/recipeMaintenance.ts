// src/jobs/recipeMaintenance.ts
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { Recipe, RecipeStep, NutritionInfo } from '../models/Recipe'; // Keep existing
import { checkForDuplicates, mergeRecipes } from '../services/duplicateDetectionService';
import { evaluateRecipeQuality, enhanceRecipeQuality } from '../services/qualityService';
// --- ADDED/MODIFIED IMPORTS ---
import { detectRecipeCategory, recipeCategories } from '../config/categories'; // Import recipeCategories and detectRecipeCategory
import { Json } from '../types/supabase'; // Import Json type from supabase types
// --- END ADDED/MODIFIED IMPORTS ---

// Configuration
const BATCH_SIZE = 50; // Process recipes in batches to avoid memory issues
const QUALITY_THRESHOLD = 7.0; // Minimum quality score (0-10)
const SIMILARITY_THRESHOLD = 0.85; // Threshold for considering recipes as duplicates

/**
 * Maintenance job to process the recipe database:
 * - Detect and merge duplicates
 * - Re-evaluate recipe quality
 * - Update categories and tags
 * - Clean up unused or invalid entries
 */
export async function runRecipeMaintenance() {
  logger.info('Starting recipe maintenance job');

  try {
    await processDuplicates();
    await assessRecipeQuality();
    await updateRecipeCategories();
    await cleanupInvalidRecipes();

    logger.info('Recipe maintenance job completed successfully');
  } catch (error) {
    logger.error('Error in recipe maintenance job:', error);
  }
}

/**
 * Process the recipe database to find and merge duplicates
 */
async function processDuplicates() {
  logger.info('Starting duplicate detection process');

  let offset = 0;
  let totalProcessed = 0;
  let duplicatesFound = 0;
  let mergesCompleted = 0;

  try {
    // Process recipes in batches
    while (true) {
      // Get a batch of unchecked recipes (only system recipes, not user-specific)
      const { data: recipes, error } = await supabase
        .from('recipes')
        .select('*')
        .is('user_id', null)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        logger.error('Error fetching recipes for duplicate check:', error);
        break;
      }

      if (!recipes || recipes.length === 0) {
        logger.info(`No more recipes to process. Completed processing ${totalProcessed} recipes.`);
        break;
      }

      // Convert database rows to Recipe objects
      // Note: Type assertions might be needed here if Supabase returns 'Json' types
      // that don't directly match RecipeStep[] or NutritionInfo interfaces,
      // similar to the update issues. For now, assuming direct mapping works for read.
      const recipeObjects = recipes.map((item: any): Recipe => ({
        id: item.id,
        title: item.title,
        servings: item.servings || 0,
        ingredients: item.ingredients || [], // Assumes ingredients is string[]
        steps: (item.steps || []) as unknown as RecipeStep[], // Added assertion assuming steps is Json in DB
        nutrition: (item.nutrition || {}) as unknown as NutritionInfo, // Added assertion assuming nutrition is Json in DB
        query: item.query || '',
        createdAt: new Date(item.created_at || Date.now()),
        prepTime: item.prep_time_minutes,
        cookTime: item.cook_time_minutes,
        totalTime: item.total_time_minutes,
      }));

      // Check each recipe for duplicates
      for (const recipe of recipeObjects) {
        // Skip recipes without an ID
        if (!recipe.id) continue;

        const duplicateResult = await checkForDuplicates(recipe);

        if (duplicateResult.isDuplicate && duplicateResult.existingRecipeId) {
          duplicatesFound++;

          // Log duplicate detection
          logger.info(`Duplicate found: "${recipe.title}" (${recipe.id}) is similar to existing recipe ${duplicateResult.existingRecipeId}`);
          logger.info(`Similarity score: ${duplicateResult.similarityScore.toFixed(2)}`);

          // Only merge if similarity is above threshold
          if (duplicateResult.similarityScore >= SIMILARITY_THRESHOLD) {
            try {
              await mergeRecipes(recipe, duplicateResult.existingRecipeId);
              mergesCompleted++;
              logger.info(`Successfully merged recipes: ${recipe.id} into ${duplicateResult.existingRecipeId}`);
            } catch (mergeError) {
              logger.error(`Error merging recipes ${recipe.id} and ${duplicateResult.existingRecipeId}:`, mergeError);
            }
          }
        }
      }

      // Update counters and offset for next batch
      totalProcessed += recipes.length;
      offset += BATCH_SIZE;

      logger.info(`Processed ${totalProcessed} recipes so far. Found ${duplicatesFound} duplicates, completed ${mergesCompleted} merges.`);
    }

    logger.info(`Duplicate detection complete. Total processed: ${totalProcessed}, duplicates found: ${duplicatesFound}, merges completed: ${mergesCompleted}`);
  } catch (error) {
    logger.error('Error in duplicate detection process:', error);
  }
}

/**
 * Reassess recipes for quality and improve low-quality recipes
 */
async function assessRecipeQuality() {
  logger.info('Starting recipe quality assessment');

  let offset = 0;
  let totalProcessed = 0;
  let lowQualityFound = 0;
  let enhancementsCompleted = 0;

  try {
    // Process recipes in batches
    while (true) {
      // Get a batch of recipes without quality scores or with low scores
      const { data: recipes, error } = await supabase
        .from('recipes')
        .select('*')
        .is('user_id', null)
        .or(`quality_score.is.null,quality_score.lt.${QUALITY_THRESHOLD}`)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        logger.error('Error fetching recipes for quality assessment:', error);
        break;
      }

      if (!recipes || recipes.length === 0) {
        logger.info(`No more recipes to process. Completed processing ${totalProcessed} recipes.`);
        break;
      }

      // Convert database rows to Recipe objects
      // Similar note as in processDuplicates regarding type assertions on read
      const recipeObjects = recipes.map((item: any): Recipe => ({
        id: item.id,
        title: item.title,
        servings: item.servings || 0,
        ingredients: item.ingredients || [],
        steps: (item.steps || []) as unknown as RecipeStep[], // Added assertion
        nutrition: (item.nutrition || {}) as unknown as NutritionInfo, // Added assertion
        query: item.query || '',
        createdAt: new Date(item.created_at || Date.now()),
        prepTime: item.prep_time_minutes,
        cookTime: item.cook_time_minutes,
        totalTime: item.total_time_minutes,
      }));

      // Assess each recipe's quality
      for (const recipe of recipeObjects) {
        // Skip recipes without an ID
        if (!recipe.id) continue;

        // Evaluate recipe quality
        const qualityScore = await evaluateRecipeQuality(recipe);

        // Update quality score in database
        await supabase
          .from('recipes')
          .update({ quality_score: qualityScore.overall })
          .eq('id', recipe.id);

        // Check if quality is below threshold
        if (qualityScore.overall < QUALITY_THRESHOLD) {
          lowQualityFound++;
          logger.info(`Low quality recipe found: "${recipe.title}" (${recipe.id}) with score ${qualityScore.overall.toFixed(1)}`);

          try {
            // Enhance the recipe
            const enhancedRecipe = await enhanceRecipeQuality(recipe, qualityScore);

            // Update the recipe with enhanced content
            // --- FIX APPLIED HERE for Errors 1 & 2 ---
            await supabase
              .from('recipes')
              .update({
                title: enhancedRecipe.title,
                ingredients: enhancedRecipe.ingredients,
                steps: enhancedRecipe.steps as unknown as Json,         // Assert type
                nutrition: enhancedRecipe.nutrition as unknown as Json, // Assert type
                quality_score: QUALITY_THRESHOLD, // Set to threshold after enhancement
                updated_at: new Date().toISOString(),
              })
              .eq('id', recipe.id);
            // --- END FIX ---

            enhancementsCompleted++;
            logger.info(`Successfully enhanced recipe: "${recipe.title}" (${recipe.id})`);
          } catch (enhanceError) {
            logger.error(`Error enhancing recipe ${recipe.id}:`, enhanceError);
          }
        }
      }

      // Update counters and offset for next batch
      totalProcessed += recipes.length;
      offset += BATCH_SIZE;

      logger.info(`Processed ${totalProcessed} recipes so far. Found ${lowQualityFound} low-quality recipes, completed ${enhancementsCompleted} enhancements.`);
    }

    logger.info(`Quality assessment complete. Total processed: ${totalProcessed}, low-quality found: ${lowQualityFound}, enhancements completed: ${enhancementsCompleted}`);
  } catch (error) {
    logger.error('Error in recipe quality assessment process:', error);
  }
}

/**
 * Update recipe categories and tags based on recipe content
 */
async function updateRecipeCategories() {
  logger.info('Starting recipe category updating');

  let offset = 0;
  let totalProcessed = 0;
  let updatesCompleted = 0;

  try {
    // Process recipes in batches
    while (true) {
      // Get a batch of recipes without categories or tags
      // (Corrected the OR condition to check both category and tags null)
      const { data: recipes, error } = await supabase
        .from('recipes')
        .select('*')
        .is('user_id', null)
        .or('category.is.null,tags.is.null') // Fetches if category OR tags is null
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        logger.error('Error fetching recipes for category updating:', error);
        break;
      }

      if (!recipes || recipes.length === 0) {
        logger.info(`No more recipes to process. Completed processing ${totalProcessed} recipes.`);
        break;
      }

      // Process each recipe
      for (const recipe of recipes) {
        // Skip recipes without an ID
        if (!recipe.id) continue;

        // --- FIX APPLIED HERE for Error 3 ---
        // Extract steps as text array for category detection
        let stepsText: string[] = [];
        // Check if recipe.steps is an array before mapping
        if (Array.isArray(recipe.steps)) {
            // Use 'any[]' assertion if structure within array isn't strictly RecipeStep
            // or if Supabase returns a less specific array type.
             stepsText = (recipe.steps as any[]).map((step: any) =>
                 // Safely access 'text' property if step is an object
                 typeof step === 'object' && step && 'text' in step ? String(step.text) : String(step)
             );
        } else if (recipe.steps) {
            // Log a warning if steps exist but aren't an array
            logger.warn(`Recipe ${recipe.id} has steps property, but it is not an array: ${typeof recipe.steps}`);
            // Decide how to handle this - perhaps treat as empty steps?
            // stepsText = []; // Or handle based on expected non-array format if any
        }
        // --- END FIX ---

        // Detect category using the imported function
        const category = detectRecipeCategory(
          recipe.title || '',
          recipe.ingredients || [], // ingredients is string[] based on supabase.ts
          stepsText                  // Use the safely processed stepsText
        );

        // Create related tags using the helper function below
        const tags = getRelatedCategories(category, recipe.title || '', recipe.ingredients || []);

        // Update the recipe with category and tags
        await supabase
          .from('recipes')
          .update({
            category: category,
            tags: tags, // tags is string[] | null in supabase.ts
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipe.id);

        updatesCompleted++;
      }

      // Update counters and offset for next batch
      totalProcessed += recipes.length;
      offset += BATCH_SIZE;

      logger.info(`Processed ${totalProcessed} recipes so far. Completed ${updatesCompleted} category updates.`);
    }

    logger.info(`Category updating complete. Total processed: ${totalProcessed}, updates completed: ${updatesCompleted}`);
  } catch (error) {
    logger.error('Error in recipe category updating process:', error);
  }
}

/**
 * Clean up invalid or incomplete recipes
 */
async function cleanupInvalidRecipes() {
  logger.info('Starting invalid recipe cleanup');

  try {
    // Delete recipes with missing essential fields (title, ingredients, steps)
    // Note: ingredients and steps are non-nullable in the provided supabase.ts Row type,
    // but title is nullable. Let's assume we want to delete if title is null OR
    // if ingredients/steps somehow became null/invalid despite schema (or if schema allows null).
    // The original code checked `.is.null` which might not cover empty arrays.
    // A more robust check might involve checking for empty title string and empty arrays.
    // Let's stick to the original logic for now (checking null).
    const { data, error } = await supabase
      .from('recipes')
      .delete()
      // Ensure we only delete system recipes
      .is('user_id', null)
      // Delete if title is null OR ingredients is null OR steps is null
      // Adjust based on actual nullability constraints and desired cleanup logic
      .or('title.is.null,ingredients.is.null,steps.is.null')
      .select('id'); // Select deleted IDs for counting

    if (error) {
      logger.error('Error cleaning up invalid recipes:', error);
      return;
    }

    const deletedCount = data?.length || 0;
    logger.info(`Invalid recipe cleanup complete. Deleted ${deletedCount} invalid recipes.`);
  } catch (error) {
    logger.error('Error in invalid recipe cleanup process:', error);
  }
}

/**
 * Helper function to get related categories based on recipe content
 * This relies on the imported `recipeCategories` (Fix for Error 4 applied via import).
 * This function remains as originally provided.
 */
function getRelatedCategories(primaryCategory: string, title: string, ingredients: string[]): string[] {
  const normalizedTitle = title.toLowerCase();
  const normalizedIngredients = ingredients.map(i => i.toLowerCase());

  // Find matching categories
  const matches: Record<string, number> = {};

  // Check each category for matches
  // --- FIX for Error 4 addressed by importing recipeCategories ---
  for (const category of recipeCategories) {
    // Skip the primary category
    if (category.id === primaryCategory) continue;

    // Start with a score of 0
    matches[category.id] = 0;

    // Check for key terms in title
    if (category.keyTerms) {
      for (const term of category.keyTerms) {
        if (normalizedTitle.includes(term)) {
          matches[category.id] += 2;
        }
      }
    }

    // Check for key ingredients
    if (category.keyIngredients) {
      for (const ingredient of category.keyIngredients) {
        for (const recipeIngredient of normalizedIngredients) {
          if (recipeIngredient.includes(ingredient)) {
            matches[category.id] += 1;
          }
        }
      }
    }
  }

  // Filter categories with a score of at least 1
  const matchedCategories = Object.entries(matches)
    .filter(([_, score]) => score > 0)
    .sort(([_, a], [__, b]) => b - a)
    .map(([id, _]) => id);

  // Return up to 3 matching categories
  return matchedCategories.slice(0, 3);
}