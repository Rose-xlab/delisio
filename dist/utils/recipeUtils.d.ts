import { Recipe } from '../models/Recipe';
/**
 * Generates a similarity hash for a recipe for quick comparison
 * @param recipe The recipe to generate a hash for
 * @returns A hash string that can be used for similarity comparison
 */
export declare const generateSimilarityHash: (recipe: Recipe) => string;
/**
 * Extracts the main ingredients from a list of ingredient strings
 * @param ingredients List of ingredient strings with quantities, etc.
 * @returns Array of normalized ingredient names
 */
export declare function extractMainIngredients(ingredients: string[]): string[];
/**
 * Normalizes text for comparison (lowercase, remove punctuation, normalize whitespace)
 * @param text Text to normalize
 * @returns Normalized text
 */
export declare function normalizeText(text: string | null | undefined): string;
/**
 * Calculates Jaccard similarity between two sets of strings
 * @param set1 First set of strings
 * @param set2 Second set of strings
 * @returns Similarity score between 0 and 1
 */
export declare function calculateJaccardSimilarity(set1: string[], set2: string[]): number;
/**
 * Categorizes a recipe based on its content
 * @param recipe The recipe to categorize
 * @returns Category ID string
 */
export declare function categorizeRecipe(recipe: Recipe): string;
/**
 * Converts time descriptions to minutes
 * @param timeDescription String description of time (e.g., "1 hour 15 minutes", "45 min")
 * @returns Time in minutes as a number or null if unparseable
 */
export declare function parseTimeToMinutes(timeDescription: string | null | undefined): number | null;
/**
 * Get a shorter preview of recipe instructions for display in lists
 * @param recipe The recipe to generate a preview for
 * @returns Short preview string (max 100 characters)
 */
export declare function getRecipePreview(recipe: Recipe): string;
/**
  * Generates search-friendly tags for a recipe
  * @param recipe The recipe to generate tags for
  * @returns Array of relevant search tags
  */
export declare function generateRecipeTags(recipe: Recipe): string[];
/**
   * Calculate recipe quality score based on completeness and detail
   * @param recipe The recipe to evaluate
   * @returns Quality score (0-10)
   */
export declare function calculateBasicQualityScore(recipe: Recipe): number;
