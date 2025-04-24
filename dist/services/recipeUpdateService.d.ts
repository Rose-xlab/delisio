import { Recipe } from '../models/Recipe';
/**
 * Updates a partial recipe in the cache (Redis or in-memory) with new information
 * as it becomes available during background job processing.
 * Stores data as stringified JSON in both Redis and the Map fallback.
 * This function is safe to call from workers as it has no 'req' dependency.
 */
export declare const updatePartialRecipe: (requestId: string, recipeData: Partial<Recipe>, // Base recipe data, potentially updated
stepIndex?: number, // Index of the step being updated (optional)
imageUrl?: string | null) => Promise<boolean>;
