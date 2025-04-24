import { Recipe } from '../models/Recipe';
interface QualityScore {
    overall: number;
    completeness: number;
    clarity: number;
    consistency: number;
    reasons: string[];
    isPassingThreshold: boolean;
}
/**
 * Evaluates the quality of a recipe and returns a quality score
 * @param recipe The recipe to evaluate
 * @returns A quality score object
 */
export declare const evaluateRecipeQuality: (recipe: Recipe) => Promise<QualityScore>;
/**
 * Enhances a recipe that didn't meet quality standards
 * @param recipe The recipe to enhance
 * @param qualityScore The quality score with reasons for improvement
 * @returns An improved version of the recipe
 */
export declare const enhanceRecipeQuality: (recipe: Recipe, qualityScore: QualityScore) => Promise<Recipe>;
/**
 * Categorizes a recipe based on its content
 * @param recipe The recipe to categorize
 * @returns Category and tags for the recipe
 */
export declare const categorizeRecipe: (recipe: Recipe) => Promise<{
    category: string;
    tags: string[];
}>;
export {};
