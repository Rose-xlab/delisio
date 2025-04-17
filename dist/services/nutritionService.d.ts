import { NutritionInfo } from '../models/Recipe';
/**
 * Extracts nutritional information for a recipe
 * @param title Recipe title
 * @param ingredients List of ingredients with quantities
 * @returns Structured nutrition information
 */
export declare const extractNutrition: (title: string, ingredients: string[]) => Promise<NutritionInfo>;
