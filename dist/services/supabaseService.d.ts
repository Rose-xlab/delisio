import { Recipe } from '../models/Recipe';
import { UserPreferences } from '../models/User';
/**
 * Saves a recipe to Supabase
 * @param recipe Recipe to save
 * @param userId User ID to associate with the recipe
 * @returns Saved recipe with ID
 */
export declare const saveRecipe: (recipe: Recipe, userId: string) => Promise<Recipe>;
/**
 * Fetches user recipes from Supabase
 * @param userId User ID to fetch recipes for
 * @returns Array of user's recipes
 */
export declare const getUserRecipes: (userId: string) => Promise<Recipe[]>;
/**
 * Gets a single recipe by ID
 * @param recipeId Recipe ID to fetch
 * @returns Recipe object
 */
export declare const getRecipeById: (recipeId: string) => Promise<Recipe | null>;
/**
 * Saves user preferences
 * @param userId User ID
 * @param preferences User preferences object
 * @returns Updated preferences
 */
export declare const saveUserPreferences: (userId: string, preferences: UserPreferences) => Promise<UserPreferences>;
/**
 * Gets user preferences
 * @param userId User ID to fetch preferences for
 * @returns User preferences object
 */
export declare const getUserPreferences: (userId: string) => Promise<UserPreferences | null>;
/**
 * Saves a search query to history
 * @param userId User ID
 * @param query Search query
 */
export declare const saveSearchHistory: (userId: string, query: string) => Promise<void>;
/**
 * Gets user search history
 * @param userId User ID
 * @param limit Maximum number of results to return
 * @returns Array of search history items
 */
export declare const getSearchHistory: (userId: string, limit?: number) => Promise<{
    query: string;
    createdAt: Date;
}[]>;
/**
 * Adds a recipe to user favorites
 * @param userId User ID
 * @param recipeId Recipe ID
 */
export declare const addFavoriteRecipe: (userId: string, recipeId: string) => Promise<void>;
/**
 * Removes a recipe from user favorites
 * @param userId User ID
 * @param recipeId Recipe ID
 */
export declare const removeFavoriteRecipe: (userId: string, recipeId: string) => Promise<void>;
/**
 * Gets user's favorite recipes
 * @param userId User ID
 * @returns Array of favorite recipes
 */
export declare const getFavoriteRecipes: (userId: string) => Promise<Recipe[]>;
