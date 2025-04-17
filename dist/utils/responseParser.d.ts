import { RecipeStep, NutritionInfo } from '../models/Recipe';
/**
 * Interface for parsed recipe data before images are added
 */
interface ParsedRecipe {
    title: string;
    servings: number;
    ingredients: string[];
    steps: RecipeStep[];
    nutrition: NutritionInfo;
}
/**
 * Parses GPT response into structured recipe data
 * @param gptResponse Raw text response from GPT
 * @returns Structured recipe data
 */
export declare const parseGptResponse: (gptResponse: string) => ParsedRecipe;
export {};
