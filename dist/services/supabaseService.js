"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFavoriteRecipes = exports.removeFavoriteRecipe = exports.addFavoriteRecipe = exports.getSearchHistory = exports.saveSearchHistory = exports.getUserPreferences = exports.saveUserPreferences = exports.getRecipeById = exports.getUserRecipes = exports.saveRecipe = void 0;
const supabase_1 = require("../config/supabase");
const logger_1 = require("../utils/logger");
/**
 * Saves a recipe to Supabase
 * @param recipe Recipe to save
 * @param userId User ID to associate with the recipe
 * @returns Saved recipe with ID
 */
const saveRecipe = async (recipe, userId) => {
    try {
        // Convert app model to database model - Assuming Recipe types match DB expectations
        const recipeData = {
            user_id: userId,
            title: recipe.title,
            servings: recipe.servings,
            ingredients: recipe.ingredients,
            steps: recipe.steps, // Cast to Json for insert/update if needed
            nutrition: recipe.nutrition, // Cast to Json for insert/update if needed
            query: recipe.query,
            // created_at and updated_at are usually handled by the database
        };
        const { data, error } = await supabase_1.supabase
            .from('recipes')
            .insert(recipeData)
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error saving recipe to Supabase', { error });
            throw error;
        }
        if (!data) {
            throw new Error('No data returned from recipe insert');
        }
        // Return the recipe shape expected by the app, potentially adding the new ID
        // Note: the 'data' returned here will match the DB row including potential nulls
        // We might need to map 'data' similarly to how we map in fetch functions if the Recipe model differs significantly
        return {
            ...recipe, // Spread the original recipe first
            id: data.id, // Add the generated ID
            // Ensure createdAt is handled if Recipe model requires Date object
            createdAt: new Date(data.created_at ?? Date.now())
        };
    }
    catch (error) {
        logger_1.logger.error('Error saving recipe:', error);
        throw new Error(`Failed to save recipe: ${error.message}`);
    }
};
exports.saveRecipe = saveRecipe;
/**
 * Fetches user recipes from Supabase
 * @param userId User ID to fetch recipes for
 * @returns Array of user's recipes
 */
const getUserRecipes = async (userId) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('recipes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) {
            logger_1.logger.error('Error fetching user recipes from Supabase', { error });
            throw error;
        }
        if (!data) {
            return [];
        }
        // Convert database rows to app model
        return data.map((item) => ({
            id: item.id,
            title: item.title,
            servings: item.servings ?? 0, // FIX: Handle null servings
            ingredients: item.ingredients ?? [], // FIX: Handle null ingredients array if needed
            steps: item.steps, // FIX: Cast Json using 'as unknown as'
            nutrition: item.nutrition, // FIX: Cast Json using 'as unknown as'
            query: item.query ?? '', // FIX: Handle null query
            createdAt: new Date(item.created_at ?? Date.now()) // FIX: Handle null created_at
        }));
    }
    catch (error) {
        logger_1.logger.error('Error fetching user recipes:', error);
        throw new Error(`Failed to fetch recipes: ${error.message}`);
    }
};
exports.getUserRecipes = getUserRecipes;
/**
 * Gets a single recipe by ID
 * @param recipeId Recipe ID to fetch
 * @returns Recipe object
 */
const getRecipeById = async (recipeId) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('recipes')
            .select('*')
            .eq('id', recipeId)
            .single();
        if (error) {
            // If no data is found, return null
            if (error.code === 'PGRST116') {
                return null;
            }
            logger_1.logger.error('Error fetching recipe by ID from Supabase', { error });
            throw error;
        }
        if (!data) {
            return null;
        }
        // Convert database row to app model
        return {
            id: data.id,
            title: data.title,
            servings: data.servings ?? 0, // FIX: Handle null servings
            ingredients: data.ingredients ?? [], // FIX: Handle null ingredients array if needed
            steps: data.steps, // FIX: Cast Json using 'as unknown as'
            nutrition: data.nutrition, // FIX: Cast Json using 'as unknown as'
            query: data.query ?? '', // FIX: Handle null query
            createdAt: new Date(data.created_at ?? Date.now()) // FIX: Handle null created_at
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching recipe by ID:', error);
        throw new Error(`Failed to fetch recipe: ${error.message}`);
    }
};
exports.getRecipeById = getRecipeById;
/**
 * Saves user preferences
 * @param userId User ID
 * @param preferences User preferences object
 * @returns Updated preferences
 */
const saveUserPreferences = async (userId, preferences) => {
    try {
        // Convert app model to database model
        const preferencesData = {
            user_id: userId,
            dietary_restrictions: preferences.dietaryRestrictions,
            favorite_cuisines: preferences.favoriteCuisines,
            allergies: preferences.allergies,
            cooking_skill: preferences.cookingSkill,
            // updated_at usually handled by DB
        };
        const { data, error } = await supabase_1.supabase
            .from('user_preferences')
            .upsert(preferencesData, { onConflict: 'user_id' }) // Specify conflict target if needed
            .select()
            .single();
        if (error) {
            logger_1.logger.error('Error saving user preferences to Supabase', { error });
            throw error;
        }
        if (!data) {
            throw new Error('No data returned from preferences upsert');
        }
        // Convert database model to app model
        return {
            // FIX: Handle nulls coming from DB with default empty arrays
            dietaryRestrictions: data.dietary_restrictions ?? [],
            favoriteCuisines: data.favorite_cuisines ?? [],
            allergies: data.allergies ?? [],
            // FIX: Handle null and ensure cast matches UserPreferences type
            cookingSkill: (data.cooking_skill ?? 'beginner')
        };
    }
    catch (error) {
        logger_1.logger.error('Error saving user preferences:', error);
        throw new Error(`Failed to save preferences: ${error.message}`);
    }
};
exports.saveUserPreferences = saveUserPreferences;
/**
 * Gets user preferences
 * @param userId User ID to fetch preferences for
 * @returns User preferences object
 */
const getUserPreferences = async (userId) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error) {
            // If no record is found, return null instead of throwing
            if (error.code === 'PGRST116') {
                return null;
            }
            logger_1.logger.error('Error fetching user preferences from Supabase', { error });
            throw error;
        }
        if (!data) {
            return null;
        }
        // Convert database model to app model
        return {
            // FIX: Handle nulls coming from DB with default empty arrays
            dietaryRestrictions: data.dietary_restrictions ?? [],
            favoriteCuisines: data.favorite_cuisines ?? [],
            allergies: data.allergies ?? [],
            // FIX: Handle null and ensure cast matches UserPreferences type
            cookingSkill: (data.cooking_skill ?? 'beginner')
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching user preferences:', error);
        throw new Error(`Failed to fetch preferences: ${error.message}`);
    }
};
exports.getUserPreferences = getUserPreferences;
/**
 * Saves a search query to history
 * @param userId User ID
 * @param query Search query
 */
const saveSearchHistory = async (userId, query) => {
    try {
        const historyData = {
            user_id: userId,
            query,
            // created_at usually handled by DB
        };
        const { error } = await supabase_1.supabase
            .from('search_history')
            .insert(historyData);
        if (error) {
            logger_1.logger.error('Error saving search history to Supabase', { error });
            // Don't throw error for search history based on original logic
            // Consider if throwing is actually desired on failure
        }
    }
    catch (error) {
        logger_1.logger.error('Error saving search history:', error);
        // Don't throw error for search history based on original logic
    }
};
exports.saveSearchHistory = saveSearchHistory;
/**
 * Gets user search history
 * @param userId User ID
 * @param limit Maximum number of results to return
 * @returns Array of search history items
 */
const getSearchHistory = async (userId, limit = 10) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('search_history')
            .select('*') // Select specific columns like 'query, created_at' for efficiency
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            logger_1.logger.error('Error fetching search history from Supabase', { error });
            // Return empty array on error based on original logic
            return []; // Consider throwing instead?
        }
        if (!data) {
            return [];
        }
        return data.map((item) => ({
            query: item.query, // Assuming query is never null based on type
            createdAt: new Date(item.created_at ?? Date.now()) // FIX: Handle null created_at
        }));
    }
    catch (error) {
        logger_1.logger.error('Error fetching search history:', error);
        return []; // Return empty array on error based on original logic
    }
};
exports.getSearchHistory = getSearchHistory;
/**
 * Adds a recipe to user favorites
 * @param userId User ID
 * @param recipeId Recipe ID
 */
const addFavoriteRecipe = async (userId, recipeId) => {
    try {
        const favoriteData = {
            user_id: userId,
            recipe_id: recipeId,
            // created_at usually handled by DB
        };
        const { error } = await supabase_1.supabase
            .from('favorites')
            .insert(favoriteData);
        if (error) {
            // If already favorited, ignore error (assuming unique constraint)
            if (error.code === '23505') { // Check for unique violation code
                logger_1.logger.warn('Attempted to add duplicate favorite recipe.', { userId, recipeId });
                return;
            }
            logger_1.logger.error('Error adding favorite recipe to Supabase', { error });
            throw error;
        }
    }
    catch (error) {
        logger_1.logger.error('Error adding favorite recipe:', error);
        throw new Error(`Failed to add favorite: ${error.message}`);
    }
};
exports.addFavoriteRecipe = addFavoriteRecipe;
/**
 * Removes a recipe from user favorites
 * @param userId User ID
 * @param recipeId Recipe ID
 */
const removeFavoriteRecipe = async (userId, recipeId) => {
    try {
        const { error } = await supabase_1.supabase
            .from('favorites')
            .delete()
            .match({ user_id: userId, recipe_id: recipeId });
        if (error) {
            logger_1.logger.error('Error removing favorite recipe from Supabase', { error });
            throw error;
        }
    }
    catch (error) {
        logger_1.logger.error('Error removing favorite recipe:', error);
        throw new Error(`Failed to remove favorite: ${error.message}`);
    }
};
exports.removeFavoriteRecipe = removeFavoriteRecipe;
/**
 * Gets user's favorite recipes
 * @param userId User ID
 * @returns Array of favorite recipes
 */
const getFavoriteRecipes = async (userId) => {
    try {
        // First get favorite recipe IDs
        const { data: favoriteData, error: favoriteError } = await supabase_1.supabase
            .from('favorites')
            .select('recipe_id') // Only select the ID
            .eq('user_id', userId);
        if (favoriteError) {
            logger_1.logger.error('Error fetching favorite IDs from Supabase', { error: favoriteError });
            throw favoriteError;
        }
        if (!favoriteData || favoriteData.length === 0) {
            return [];
        }
        // Extract recipe IDs
        // FIX: Update type annotation to allow null and filter nulls out
        const recipeIds = favoriteData
            .map((item) => item.recipe_id)
            .filter((id) => id !== null); // Add filter to remove nulls
        // FIX: If recipeIds could be empty after filtering, handle that case
        if (recipeIds.length === 0) {
            logger_1.logger.info('User has favorite entries but recipe_ids are null or missing.', { userId });
            return [];
        }
        // Fetch the actual recipes
        const { data: recipesData, error: recipesError } = await supabase_1.supabase
            .from('recipes')
            .select('*')
            .in('id', recipeIds);
        if (recipesError) {
            logger_1.logger.error('Error fetching favorite recipes from Supabase', { error: recipesError });
            throw recipesError;
        }
        if (!recipesData) {
            return [];
        }
        // Convert database rows to app model
        return recipesData.map((item) => ({
            id: item.id,
            title: item.title,
            servings: item.servings ?? 0, // FIX: Handle null servings
            ingredients: item.ingredients ?? [], // FIX: Handle null ingredients array if needed
            steps: item.steps, // FIX: Cast Json using 'as unknown as'
            nutrition: item.nutrition, // FIX: Cast Json using 'as unknown as'
            query: item.query ?? '', // FIX: Handle null query
            createdAt: new Date(item.created_at ?? Date.now()) // FIX: Handle null created_at
        }));
    }
    catch (error) {
        logger_1.logger.error('Error fetching favorite recipes:', error);
        throw new Error(`Failed to fetch favorites: ${error.message}`);
    }
};
exports.getFavoriteRecipes = getFavoriteRecipes;
//# sourceMappingURL=supabaseService.js.map