import { Recipe } from '../models/Recipe';
import { UserPreferences } from '../models/User';
import { Buffer } from 'buffer';
/**
 * Uploads image data to Supabase Storage.
 */
export declare const uploadImageToStorage: (imageData: Buffer, filePath: string, contentType?: string) => Promise<string>;
/**
 * Deletes images associated with a recipe from storage
 */
export declare const deleteRecipeImages: (recipeId: string) => Promise<void>;
/**
 * Saves a recipe to Supabase
 */
export declare const saveRecipe: (recipe: Recipe, userId: string) => Promise<Recipe>;
/**
 * Deletes a recipe from Supabase
 */
export declare const deleteRecipe: (recipeId: string, userId: string) => Promise<void>;
/**
 * Fetches user recipes from Supabase
 */
export declare const getUserRecipes: (userId: string) => Promise<Recipe[]>;
/**
 * Gets a single recipe by ID
 */
export declare const getRecipeById: (recipeId: string) => Promise<Recipe | null>;
/**
 * Gets recipes for discovery based on filters AND optional search query
 */
export declare const getDiscoverRecipes: ({ category, tags, sort, limit, offset, query }: {
    category?: string;
    tags?: string[];
    sort?: string;
    limit?: number;
    offset?: number;
    query?: string;
}) => Promise<Recipe[]>;
/**
 * Gets popular recipes
 */
export declare const getPopularRecipes: (limit?: number) => Promise<Recipe[]>;
/**
 * Gets recipes by category
 */
export declare const getCategoryRecipes: (categoryId: string, { limit, offset, sort }: {
    limit?: number;
    offset?: number;
    sort?: string;
}) => Promise<Recipe[]>;
/**
 * Gets all recipe categories with counts
 */
export declare const getAllCategories: () => Promise<{
    id: string;
    name: string;
    count: number;
}[]>;
/**
 * Saves user preferences
 */
export declare const saveUserPreferences: (userId: string, preferences: UserPreferences) => Promise<UserPreferences>;
/**
 * Gets user preferences
 */
export declare const getUserPreferences: (userId: string) => Promise<UserPreferences | null>;
/**
 * Saves a search query to history
 */
export declare const saveSearchHistory: (userId: string, query: string) => Promise<void>;
/**
 * Gets user search history
 */
export declare const getSearchHistory: (userId: string, limit?: number) => Promise<{
    query: string;
    createdAt: Date;
}[]>;
/**
 * Adds a recipe to user favorites
 */
export declare const addFavoriteRecipe: (userId: string, recipeId: string) => Promise<void>;
/**
 * Removes a recipe from user favorites
 */
export declare const removeFavoriteRecipe: (userId: string, recipeId: string) => Promise<void>;
/**
 * Gets user's favorite recipes
 */
export declare const getFavoriteRecipes: (userId: string) => Promise<Recipe[]>;
