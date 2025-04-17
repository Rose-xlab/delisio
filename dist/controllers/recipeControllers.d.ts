import { Recipe } from '../models/Recipe';
/**
 * Generates a complete recipe with illustrations based on user query
 * @param query The user's recipe query (e.g., "lasagna", "vegetarian pasta")
 * @param userPreferences Optional user preferences to personalize recipe
 * @returns Complete recipe with ingredients, steps, images, and nutrition
 */
export declare const generateRecipe: (query: string, userPreferences?: {
    dietaryRestrictions?: string[];
    allergies?: string[];
    favoriteCuisines?: string[];
    cookingSkill?: string;
}) => Promise<Recipe>;
