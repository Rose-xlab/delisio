"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFavoriteRecipes = exports.removeFavoriteRecipe = exports.addFavoriteRecipe = exports.getSearchHistory = exports.saveSearchHistory = exports.getUserPreferences = exports.saveUserPreferences = exports.getAllCategories = exports.getCategoryRecipes = exports.getPopularRecipes = exports.getDiscoverRecipes = exports.getRecipeById = exports.getUserRecipes = exports.deleteRecipe = exports.saveRecipe = exports.deleteRecipeImages = exports.uploadImageToStorage = void 0;
// src/services/supabaseService.ts
const supabase_1 = require("../config/supabase");
const logger_1 = require("../utils/logger");
const categories_1 = require("../config/categories");
// --- Define your bucket name here ---
const BUCKET_NAME = 'recipe-images'; // <-- IMPORTANT: MAKE SURE THIS MATCHES YOUR BUCKET
// --- End Bucket Name Definition ---
/**
 * Uploads image data to Supabase Storage.
 */
const uploadImageToStorage = async (imageData, filePath, contentType = 'image/png') => {
    try {
        logger_1.logger.info(`Uploading image to Supabase Storage at path: ${filePath} in bucket: ${BUCKET_NAME}`);
        const { data: uploadData, error: uploadError } = await supabase_1.supabase.storage.from(BUCKET_NAME).upload(filePath, imageData, { contentType: contentType, upsert: true });
        if (uploadError) {
            logger_1.logger.error('Error uploading image', { path: filePath, error: uploadError });
            throw uploadError;
        }
        const { data: urlData } = supabase_1.supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
        if (!urlData || !urlData.publicUrl) {
            logger_1.logger.error('Failed to get public URL', { path: filePath });
            throw new Error('Failed to get public URL.');
        }
        logger_1.logger.info(`Image successfully uploaded. Public URL: ${urlData.publicUrl}`);
        return urlData.publicUrl;
    }
    catch (error) {
        logger_1.logger.error('Exception during image upload', { path: filePath, error });
        throw new Error(`Failed to upload image: ${error.message}`);
    }
};
exports.uploadImageToStorage = uploadImageToStorage;
/**
 * Deletes images associated with a recipe from storage
 */
const deleteRecipeImages = async (recipeId) => {
    try {
        logger_1.logger.info(`Deleting images for recipe ID ${recipeId}`);
        // List all objects in the recipe's folder
        const { data, error } = await supabase_1.supabase.storage
            .from(BUCKET_NAME)
            .list(`public/steps/${recipeId}`);
        if (error) {
            logger_1.logger.error('Error listing recipe images', { recipeId, error });
            throw error;
        }
        if (!data || data.length === 0) {
            logger_1.logger.info(`No images found for recipe ID ${recipeId}`);
            return;
        }
        // Create a list of paths to delete
        const filesToDelete = data.map(file => `public/steps/${recipeId}/${file.name}`);
        // Delete the images
        const { error: deleteError } = await supabase_1.supabase.storage
            .from(BUCKET_NAME)
            .remove(filesToDelete);
        if (deleteError) {
            logger_1.logger.error('Error deleting recipe images', { recipeId, error: deleteError });
            throw deleteError;
        }
        logger_1.logger.info(`Successfully deleted ${filesToDelete.length} images for recipe ID ${recipeId}`);
    }
    catch (error) {
        logger_1.logger.error(`Error deleting recipe images for ID ${recipeId}:`, error);
        throw new Error(`Failed to delete recipe images: ${error.message}`);
    }
};
exports.deleteRecipeImages = deleteRecipeImages;
/**
 * Saves a recipe to Supabase
 */
const saveRecipe = async (recipe, userId) => {
    if (!recipe.id) {
        throw new Error('Recipe object must have an ID before saving.');
    }
    try {
        logger_1.logger.info(`Saving recipe ID ${recipe.id} for user ${userId}`);
        // ADD THIS DEBUG LOG
        console.log("Time fields being saved to Supabase:", {
            prep_time_minutes: recipe.prepTime,
            cook_time_minutes: recipe.cookTime,
            total_time_minutes: recipe.totalTime
        });
        // UPDATED: Add category and tags fields if they exist
        const recipeData = {
            id: recipe.id,
            user_id: userId === 'system' ? null : userId, // Handle system recipes differently
            title: recipe.title,
            servings: recipe.servings,
            ingredients: recipe.ingredients,
            steps: recipe.steps,
            nutrition: recipe.nutrition,
            query: recipe.query,
            created_at: recipe.createdAt.toISOString(),
            // --- Map optional time fields to DB columns ---
            prep_time_minutes: recipe.prepTime ?? null,
            cook_time_minutes: recipe.cookTime ?? null,
            total_time_minutes: recipe.totalTime ?? null,
            // --- NEW: Added for global recipe database ---
            category: recipe.category ?? null,
            tags: recipe.tags ?? null,
            similarity_hash: recipe.similarity_hash ?? null,
            quality_score: recipe.quality_score ?? null,
            views: 0, // Initialize view count for new recipes
        };
        const { data, error } = await supabase_1.supabase.from('recipes').upsert(recipeData, { onConflict: 'id' }).select().single();
        if (error) {
            logger_1.logger.error('Error upserting recipe', { recipeId: recipe.id, error });
            throw error;
        }
        if (!data) {
            throw new Error('No data returned from recipe upsert');
        }
        logger_1.logger.info(`Recipe ID ${recipe.id} saved/upserted successfully.`);
        // ADD THIS DEBUG LOG
        console.log("Supabase response after save:", {
            prep_time_minutes: data.prep_time_minutes,
            cook_time_minutes: data.cook_time_minutes,
            total_time_minutes: data.total_time_minutes
        });
        return recipe;
    }
    catch (error) {
        logger_1.logger.error(`Error saving recipe ID ${recipe.id}:`, error);
        throw new Error(`Failed to save recipe: ${error.message}`);
    }
};
exports.saveRecipe = saveRecipe;
/**
 * Deletes a recipe from Supabase
 */
const deleteRecipe = async (recipeId, userId) => {
    try {
        logger_1.logger.info(`Deleting recipe ID ${recipeId} for user ${userId}`);
        // First verify the recipe belongs to the user
        const { data: recipe, error: getError } = await supabase_1.supabase
            .from('recipes')
            .select('user_id')
            .eq('id', recipeId)
            .single();
        if (getError) {
            if (getError.code === 'PGRST116') {
                logger_1.logger.error(`Recipe ID ${recipeId} not found`);
                throw new Error('Recipe not found');
            }
            logger_1.logger.error('Error fetching recipe to delete', { recipeId, error: getError });
            throw getError;
        }
        if (recipe.user_id !== userId) {
            logger_1.logger.error(`User ${userId} attempted to delete recipe ${recipeId} which belongs to user ${recipe.user_id}`);
            throw new Error('Unauthorized: Cannot delete recipe that belongs to another user');
        }
        // Remove from favorites first (all users' favorites of this recipe)
        const { error: favError } = await supabase_1.supabase
            .from('favorites')
            .delete()
            .eq('recipe_id', recipeId);
        if (favError) {
            logger_1.logger.error('Error removing recipe from favorites during deletion', { recipeId, error: favError });
            // Continue with deletion even if this fails
        }
        // Delete the recipe
        const { error: deleteError } = await supabase_1.supabase
            .from('recipes')
            .delete()
            .eq('id', recipeId);
        if (deleteError) {
            logger_1.logger.error('Error deleting recipe', { recipeId, error: deleteError });
            throw deleteError;
        }
        // Delete associated images
        try {
            await (0, exports.deleteRecipeImages)(recipeId);
        }
        catch (imageError) {
            logger_1.logger.error('Error deleting recipe images, but recipe was deleted', { recipeId, error: imageError });
            // Don't throw here, as the recipe was deleted successfully
        }
        logger_1.logger.info(`Recipe ID ${recipeId} deleted successfully.`);
    }
    catch (error) {
        logger_1.logger.error(`Error deleting recipe ID ${recipeId}:`, error);
        throw new Error(`Failed to delete recipe: ${error.message}`);
    }
};
exports.deleteRecipe = deleteRecipe;
/**
 * Fetches user recipes from Supabase
 */
const getUserRecipes = async (userId) => {
    try {
        const { data, error } = await supabase_1.supabase.from('recipes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (error) {
            logger_1.logger.error('Error fetching user recipes', { error });
            throw error;
        }
        if (!data) {
            return [];
        }
        // ADD THIS DEBUG LOG
        if (data.length > 0) {
            console.log("Sample recipe from getUserRecipes time fields:", {
                prep_time_minutes: data[0].prep_time_minutes,
                cook_time_minutes: data[0].cook_time_minutes,
                total_time_minutes: data[0].total_time_minutes
            });
        }
        return data.map((item) => ({
            id: item.id,
            title: item.title,
            servings: item.servings ?? 0,
            ingredients: item.ingredients ?? [],
            steps: item.steps ? item.steps : [],
            nutrition: item.nutrition ? item.nutrition : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
            query: item.query ?? '',
            createdAt: new Date(item.created_at ?? Date.now()),
            // --- Map DB time columns back ---
            prepTime: item.prep_time_minutes ?? undefined,
            cookTime: item.cook_time_minutes ?? undefined,
            totalTime: item.total_time_minutes ?? undefined,
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
 */
const getRecipeById = async (recipeId) => {
    try {
        const { data, error } = await supabase_1.supabase.from('recipes').select('*').eq('id', recipeId).single();
        if (error) {
            if (error.code === 'PGRST116')
                return null;
            logger_1.logger.error('Error fetching recipe by ID', { error });
            throw error;
        }
        if (!data)
            return null;
        // ADD THIS DEBUG LOG
        console.log("Retrieved time fields from Supabase:", {
            prep_time_minutes: data.prep_time_minutes,
            cook_time_minutes: data.cook_time_minutes,
            total_time_minutes: data.total_time_minutes
        });
        // Increment view count for this recipe
        try {
            await supabase_1.supabase
                .from('recipes')
                .update({
                views: (data.views || 0) + 1
            })
                .eq('id', recipeId);
        }
        catch (viewError) {
            logger_1.logger.error('Error incrementing view count:', viewError);
            // Continue anyway - view count is not critical
        }
        return {
            id: data.id,
            title: data.title,
            servings: data.servings ?? 0,
            ingredients: data.ingredients ?? [],
            steps: data.steps ? data.steps : [],
            nutrition: data.nutrition ? data.nutrition : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
            query: data.query ?? '',
            createdAt: new Date(data.created_at ?? Date.now()),
            // --- Map DB time columns back ---
            prepTime: data.prep_time_minutes ?? undefined,
            cookTime: data.cook_time_minutes ?? undefined,
            totalTime: data.total_time_minutes ?? undefined,
        };
    }
    catch (error) {
        logger_1.logger.error('Error fetching recipe by ID:', error);
        throw new Error(`Failed to fetch recipe: ${error.message}`);
    }
};
exports.getRecipeById = getRecipeById;
/**
 * Gets recipes for discovery based on filters AND optional search query
 */
// --- FIX: Added 'query' to the parameter type definition ---
const getDiscoverRecipes = async ({ category, tags, sort = 'recent', limit = 20, offset = 0, query // Added query parameter
 }) => {
    try {
        logger_1.logger.info(`Workspaceing discover recipes with filters: category=${category}, tags=${tags?.join(',')}, sort=${sort}, limit=${limit}, offset=${offset}, query=${query}`);
        // Start with system recipes query (user_id is null)
        let queryBuilder = supabase_1.supabase // Renamed 'query' variable to 'queryBuilder' to avoid conflict
            .from('recipes')
            .select('*')
            .is('user_id', null);
        // Apply category filter if provided
        if (category && category !== 'all') {
            queryBuilder = queryBuilder.eq('category', category);
        }
        // Apply tags filter if provided
        if (tags && tags.length > 0) {
            // For array containment, you need to use the contains operator
            // This assumes 'tags' is an array column in the database
            queryBuilder = queryBuilder.contains('tags', tags);
        }
        // --- FIX: Added query filtering logic ---
        // Apply text search filter if 'query' parameter is provided
        if (query) {
            // Option 1: Use ilike for basic substring matching (adjust column name)
            // queryBuilder = queryBuilder.ilike('title', `%${query}%`);
            // Option 2: Use textSearch for full-text search (requires a tsvector column named 'fts' typically)
            // Ensure you have a GIN index on your 'fts' column for performance
            // queryBuilder = queryBuilder.textSearch('fts_column_name', query, { type: 'websearch' });
            // Let's use ilike on title as a simple example:
            queryBuilder = queryBuilder.ilike('title', `%${query}%`);
        }
        // --- End query filtering logic ---
        // Apply sorting
        if (sort === 'popular') {
            queryBuilder = queryBuilder.order('views', { ascending: false, nullsFirst: false }); // Handle nulls in views
        }
        else {
            queryBuilder = queryBuilder.order('created_at', { ascending: false });
        }
        // Apply pagination
        queryBuilder = queryBuilder.range(offset, offset + limit - 1);
        // Execute query
        const { data, error } = await queryBuilder;
        if (error) {
            logger_1.logger.error('Error fetching discover recipes', { error });
            throw error;
        }
        if (!data) {
            return [];
        }
        // Convert to Recipe objects
        // --- ERROR FIX: Changed category mapping ---
        return data.map((item) => ({
            id: item.id,
            title: item.title,
            servings: item.servings ?? 0,
            ingredients: item.ingredients ?? [],
            steps: item.steps ? item.steps : [],
            nutrition: item.nutrition ? item.nutrition : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
            query: item.query ?? '',
            createdAt: new Date(item.created_at ?? Date.now()),
            prepTime: item.prep_time_minutes ?? undefined,
            cookTime: item.cook_time_minutes ?? undefined,
            totalTime: item.total_time_minutes ?? undefined,
            // Additional fields for discovery
            category: item.category ?? undefined, // <-- FIX APPLIED HERE
            tags: item.tags,
        }));
        // --- END ERROR FIX ---
    }
    catch (error) {
        logger_1.logger.error('Error fetching discover recipes:', error);
        throw new Error(`Failed to fetch discover recipes: ${error.message}`);
    }
};
exports.getDiscoverRecipes = getDiscoverRecipes;
/**
 * Gets popular recipes
 */
const getPopularRecipes = async (limit = 10) => {
    try {
        logger_1.logger.info(`Workspaceing popular recipes with limit: ${limit}`);
        // Get system recipes with highest view counts
        const { data, error } = await supabase_1.supabase
            .from('recipes')
            .select('*')
            .is('user_id', null)
            .order('views', { ascending: false, nullsFirst: false }) // Handle nulls in views
            .limit(limit);
        if (error) {
            logger_1.logger.error('Error fetching popular recipes', { error });
            throw error;
        }
        if (!data) {
            return [];
        }
        // Convert to Recipe objects
        // --- ERROR FIX: Changed category mapping ---
        return data.map((item) => ({
            id: item.id,
            title: item.title,
            servings: item.servings ?? 0,
            ingredients: item.ingredients ?? [],
            steps: item.steps ? item.steps : [],
            nutrition: item.nutrition ? item.nutrition : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
            query: item.query ?? '',
            createdAt: new Date(item.created_at ?? Date.now()),
            prepTime: item.prep_time_minutes ?? undefined,
            cookTime: item.cook_time_minutes ?? undefined,
            totalTime: item.total_time_minutes ?? undefined,
            // Additional fields for discovery
            category: item.category ?? undefined, // <-- FIX APPLIED HERE
            tags: item.tags,
        }));
        // --- END ERROR FIX ---
    }
    catch (error) {
        logger_1.logger.error('Error fetching popular recipes:', error);
        throw new Error(`Failed to fetch popular recipes: ${error.message}`);
    }
};
exports.getPopularRecipes = getPopularRecipes;
/**
 * Gets recipes by category
 */
const getCategoryRecipes = async (categoryId, { limit = 20, offset = 0, sort = 'recent' }) => {
    try {
        logger_1.logger.info(`Workspaceing recipes for category: ${categoryId} with limit=${limit}, offset=${offset}, sort=${sort}`);
        // Get system recipes for the specified category
        let query = supabase_1.supabase
            .from('recipes')
            .select('*')
            .is('user_id', null)
            .eq('category', categoryId);
        // Apply sorting
        if (sort === 'popular') {
            query = query.order('views', { ascending: false, nullsFirst: false }); // Handle nulls in views
        }
        else {
            query = query.order('created_at', { ascending: false });
        }
        // Apply pagination
        query = query.range(offset, offset + limit - 1);
        // Execute query
        const { data, error } = await query;
        if (error) {
            logger_1.logger.error('Error fetching category recipes', { error });
            throw error;
        }
        if (!data) {
            return [];
        }
        // Convert to Recipe objects
        // --- ERROR FIX: Changed category mapping ---
        return data.map((item) => ({
            id: item.id,
            title: item.title,
            servings: item.servings ?? 0,
            ingredients: item.ingredients ?? [],
            steps: item.steps ? item.steps : [],
            nutrition: item.nutrition ? item.nutrition : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
            query: item.query ?? '',
            createdAt: new Date(item.created_at ?? Date.now()),
            prepTime: item.prep_time_minutes ?? undefined,
            cookTime: item.cook_time_minutes ?? undefined,
            totalTime: item.total_time_minutes ?? undefined,
            // Additional fields for discovery
            category: item.category ?? undefined, // <-- FIX APPLIED HERE
            tags: item.tags,
        }));
        // --- END ERROR FIX ---
    }
    catch (error) {
        logger_1.logger.error('Error fetching category recipes:', error);
        throw new Error(`Failed to fetch category recipes: ${error.message}`);
    }
};
exports.getCategoryRecipes = getCategoryRecipes;
/**
 * Gets all recipe categories with counts
 */
const getAllCategories = async () => {
    try {
        logger_1.logger.info('Fetching all recipe categories with counts');
        // --- FIX for Error 1: Use RPC call ---
        // Ensure you have created the 'get_category_counts' function in Supabase SQL Editor
        const { data, error } = await supabase_1.supabase.rpc('get_category_counts');
        // --- End FIX for Error 1 ---
        if (error) {
            logger_1.logger.error('Error fetching category counts via RPC', { error });
            throw error;
        }
        if (!data) {
            return [];
        }
        // Map the counts to the predefined categories
        return categories_1.recipeCategories.map(category => {
            // --- FIX for Error 2: Add explicit type for item ---
            // The type matches the 'RETURNS TABLE' definition of the SQL function
            const countEntry = data.find((item) => item.category === category.id);
            // --- End FIX for Error 2 ---
            return {
                id: category.id,
                name: category.name,
                // Use 'recipe_count' from RPC result, handle potential null and ensure it's a number
                count: countEntry?.recipe_count ? Number(countEntry.recipe_count) : 0
            };
        });
    }
    catch (error) {
        logger_1.logger.error('Error fetching all categories:', error);
        throw new Error(`Failed to fetch categories: ${error.message}`);
    }
};
exports.getAllCategories = getAllCategories;
/**
 * Saves user preferences
 */
const saveUserPreferences = async (userId, preferences) => {
    try {
        const preferencesData = {
            user_id: userId,
            dietary_restrictions: preferences.dietaryRestrictions,
            favorite_cuisines: preferences.favoriteCuisines,
            allergies: preferences.allergies,
            cooking_skill: preferences.cookingSkill,
        };
        const { data, error } = await supabase_1.supabase.from('user_preferences').upsert(preferencesData, { onConflict: 'user_id' }).select().single();
        if (error) {
            logger_1.logger.error('Error saving user preferences', { error });
            throw error;
        }
        if (!data) {
            throw new Error('No data returned from preferences upsert');
        }
        return {
            dietaryRestrictions: data.dietary_restrictions ?? [],
            favoriteCuisines: data.favorite_cuisines ?? [],
            allergies: data.allergies ?? [],
            cookingSkill: (data.cooking_skill ?? 'beginner') // Cast to expected type
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
 */
const getUserPreferences = async (userId) => {
    try {
        const { data, error } = await supabase_1.supabase.from('user_preferences').select('*').eq('user_id', userId).single();
        if (error) {
            if (error.code === 'PGRST116')
                return null;
            logger_1.logger.error('Error fetching user preferences', { error });
            throw error;
        }
        if (!data)
            return null;
        return {
            dietaryRestrictions: data.dietary_restrictions ?? [],
            favoriteCuisines: data.favorite_cuisines ?? [],
            allergies: data.allergies ?? [],
            cookingSkill: (data.cooking_skill ?? 'beginner') // Cast to expected type
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
 */
const saveSearchHistory = async (userId, query) => {
    try {
        const historyData = { user_id: userId, query };
        const { error } = await supabase_1.supabase.from('search_history').insert(historyData);
        if (error) {
            logger_1.logger.error('Error saving search history', { error });
        }
    }
    catch (error) {
        logger_1.logger.error('Error saving search history:', error);
    }
};
exports.saveSearchHistory = saveSearchHistory;
/**
 * Gets user search history
 */
const getSearchHistory = async (userId, limit = 10) => {
    try {
        const { data, error } = await supabase_1.supabase.from('search_history').select('query, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
        if (error) {
            logger_1.logger.error('Error fetching search history', { error });
            return [];
        }
        if (!data)
            return [];
        return data.map((item) => ({
            query: item.query ?? '', // Handle potential null query
            createdAt: new Date(item.created_at ?? Date.now())
        }));
    }
    catch (error) {
        logger_1.logger.error('Error fetching search history:', error);
        return [];
    }
};
exports.getSearchHistory = getSearchHistory;
/**
 * Adds a recipe to user favorites
 */
const addFavoriteRecipe = async (userId, recipeId) => {
    try {
        const favoriteData = { user_id: userId, recipe_id: recipeId };
        const { error } = await supabase_1.supabase.from('favorites').insert(favoriteData);
        if (error) {
            if (error.code === '23505') {
                logger_1.logger.warn('Attempted duplicate favorite ignored.');
                return;
            }
            logger_1.logger.error('Error adding favorite', { error });
            throw error;
        }
        logger_1.logger.info(`Recipe ${recipeId} added to favorites for user ${userId}`);
    }
    catch (error) {
        logger_1.logger.error('Error adding favorite recipe:', error);
        throw new Error(`Failed to add favorite: ${error.message}`);
    }
};
exports.addFavoriteRecipe = addFavoriteRecipe;
/**
 * Removes a recipe from user favorites
 */
const removeFavoriteRecipe = async (userId, recipeId) => {
    try {
        const { error } = await supabase_1.supabase.from('favorites').delete().match({ user_id: userId, recipe_id: recipeId });
        if (error) {
            logger_1.logger.error('Error removing favorite', { error });
            throw error;
        }
        logger_1.logger.info(`Recipe ${recipeId} removed from favorites for user ${userId}`);
    }
    catch (error) {
        logger_1.logger.error('Error removing favorite recipe:', error);
        throw new Error(`Failed to remove favorite: ${error.message}`);
    }
};
exports.removeFavoriteRecipe = removeFavoriteRecipe;
/**
 * Gets user's favorite recipes
 */
const getFavoriteRecipes = async (userId) => {
    try {
        const { data: favoriteData, error: favoriteError } = await supabase_1.supabase.from('favorites').select('recipe_id').eq('user_id', userId);
        if (favoriteError) {
            logger_1.logger.error('Error fetching favorite IDs', { error: favoriteError });
            throw favoriteError;
        }
        if (!favoriteData || favoriteData.length === 0)
            return [];
        const recipeIds = favoriteData.map(item => item.recipe_id).filter((id) => id !== null);
        if (recipeIds.length === 0)
            return [];
        const { data: recipesData, error: recipesError } = await supabase_1.supabase.from('recipes').select('*').in('id', recipeIds);
        if (recipesError) {
            logger_1.logger.error('Error fetching favorite recipes', { error: recipesError });
            throw recipesError;
        }
        if (!recipesData)
            return [];
        return recipesData.map((item) => ({
            id: item.id, title: item.title, servings: item.servings ?? 0, ingredients: item.ingredients ?? [],
            steps: item.steps ? item.steps : [],
            nutrition: item.nutrition ? item.nutrition : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
            query: item.query ?? '', createdAt: new Date(item.created_at ?? Date.now()),
            prepTime: item.prep_time_minutes ?? undefined, cookTime: item.cook_time_minutes ?? undefined, totalTime: item.total_time_minutes ?? undefined,
            // Add isFavorite flag set to true for all items
            isFavorite: true,
        }));
    }
    catch (error) {
        logger_1.logger.error('Error fetching favorite recipes:', error);
        throw new Error(`Failed to fetch favorites: ${error.message}`);
    }
};
exports.getFavoriteRecipes = getFavoriteRecipes;
//# sourceMappingURL=supabaseService.js.map