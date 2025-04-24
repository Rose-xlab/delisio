import { Recipe } from '../models/Recipe';
/**
 * Interface for recipe similarity result
 */
interface SimilarityResult {
    isDuplicate: boolean;
    similarityScore: number;
    existingRecipeId: string | null;
    similarityDetails: {
        titleSimilarity: number;
        ingredientSimilarity: number;
        stepsSimilarity: number;
    };
}
/**
 * Checks if a recipe might be a duplicate of an existing recipe
 * @param recipe The recipe to check for duplicates
 * @returns Similarity information and duplicate status
 */
export declare const checkForDuplicates: (recipe: Recipe) => Promise<SimilarityResult>;
/**
 * Merges a new recipe with an existing one, keeping the best parts of both
 * @param newRecipe The new recipe to merge
 * @param existingRecipeId The ID of the existing recipe to merge with
 * @returns The merged recipe object (in-memory representation)
 */
export declare const mergeRecipes: (newRecipe: Recipe, existingRecipeId: string) => Promise<Recipe>;
/**
 * Generates a similarity hash for a recipe for quick comparison
 * @param recipe The recipe to generate a hash for
 * @returns A hash string that can be used for similarity comparison
 */
export declare const generateSimilarityHash: (recipe: Recipe) => string;
export {};
