// src/services/supabaseService.ts


import { supabase } from '../config/supabase';
import { Recipe, RecipeStep, NutritionInfo } from '../models/Recipe'; // Updated model
import { User, UserPreferences } from '../models/User'; // Assuming path is correct
import { TablesInsert, Tables, Json } from '../types/supabase';
import { logger } from '../utils/logger';
import { Buffer } from 'buffer';
import { recipeCategories } from '../config/categories';

// --- Define your bucket name here ---
const BUCKET_NAME = 'recipe-images'; // <-- IMPORTANT: MAKE SURE THIS MATCHES YOUR BUCKET
// --- End Bucket Name Definition ---

/**
 * Uploads image data to Supabase Storage.
 */
export const uploadImageToStorage = async (imageData: Buffer, filePath: string, contentType: string = 'image/png'): Promise<string> => {
      try {
          logger.info(`Uploading image to Supabase Storage at path: ${filePath} in bucket: ${BUCKET_NAME}`);
          const { data: uploadData, error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, imageData, { contentType: contentType, upsert: true });
          if (uploadError) { logger.error('Error uploading image', { path: filePath, error: uploadError }); throw uploadError; }
          const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
          if (!urlData || !urlData.publicUrl) { logger.error('Failed to get public URL', { path: filePath }); throw new Error('Failed to get public URL.'); }
          logger.info(`Image successfully uploaded. Public URL: ${urlData.publicUrl}`);
          return urlData.publicUrl;
      } catch (error) { logger.error('Exception during image upload', { path: filePath, error }); throw new Error(`Failed to upload image: ${(error as Error).message}`); }
};

/**
 * Deletes images associated with a recipe from storage
 */
export const deleteRecipeImages = async (recipeId: string): Promise<void> => {
  try {
    logger.info(`Deleting images for recipe ID ${recipeId}`);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(`public/steps/${recipeId}`);

    if (error) {
      logger.error('Error listing recipe images', { recipeId, error });
      throw error;
    }

    if (!data || data.length === 0) {
      logger.info(`No images found for recipe ID ${recipeId}`);
      return;
    }

    const filesToDelete = data.map(file => `public/steps/${recipeId}/${file.name}`);

    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filesToDelete);

    if (deleteError) {
      logger.error('Error deleting recipe images', { recipeId, error: deleteError });
      throw deleteError;
    }

    logger.info(`Successfully deleted ${filesToDelete.length} images for recipe ID ${recipeId}`);
  } catch (error) {
    logger.error(`Error deleting recipe images for ID ${recipeId}:`, error);
    throw new Error(`Failed to delete recipe images: ${(error as Error).message}`);
  }
};

/**
 * Saves a recipe to Supabase
 * FIXED: userId parameter now accepts string | null
 */
export const saveRecipe = async (recipe: Recipe, userId: string | null): Promise<Recipe> => {
    if (!recipe.id) { throw new Error('Recipe object must have an ID before saving.'); }
    try {
        // Log correctly handles null userId
        logger.info(`Saving recipe ID ${recipe.id} for user ${userId ?? 'Global'}`);

        // Log the steps data being saved
        logger.debug(`[saveRecipe] Steps data being saved for recipe ${recipe.id}:`, { steps: recipe.steps });

        const recipeData: TablesInsert<'recipes'> = {
            id: recipe.id,
            // This assignment already correctly handles passing null to Supabase
            user_id: userId,
            title: recipe.title,
            servings: recipe.servings,
            ingredients: recipe.ingredients,
            steps: recipe.steps as unknown as Json,
            nutrition: recipe.nutrition as unknown as Json,
            query: recipe.query,
            created_at: recipe.createdAt.toISOString(),
            prep_time_minutes: recipe.prepTime ?? null,
            cook_time_minutes: recipe.cookTime ?? null,
            total_time_minutes: recipe.totalTime ?? null,
            category: (recipe as any).category ?? null,
            tags: (recipe as any).tags ?? null,
            similarity_hash: (recipe as any).similarity_hash ?? null,
            quality_score: (recipe as any).quality_score ?? null,
            views: recipe.views || 0,
        };

        const { data, error } = await supabase.from('recipes').upsert(recipeData, { onConflict: 'id' }).select().single();
        // Error handling remains the same
        if (error) { logger.error('Error upserting recipe', { recipeId: recipe.id, userId: userId, error }); throw error; }
        if (!data) { throw new Error('No data returned from recipe upsert'); }
        logger.info(`Recipe ID ${recipe.id} saved/upserted successfully.`);

        // Log the data returned by Supabase to confirm
        logger.debug(`[saveRecipe] Supabase upsert response for recipe ${recipe.id}:`, { responseData: data });

        return recipe; // Return the original recipe object passed in
    } catch (error) { logger.error(`Error saving recipe ID ${recipe.id}:`, error); throw new Error(`Failed to save recipe: ${(error as Error).message}`); }
};

/**
 * Deletes a recipe from Supabase
 */
export const deleteRecipe = async (recipeId: string, userId: string): Promise<void> => {
  try {
    logger.info(`Deleting recipe ID ${recipeId} for user ${userId}`);

    const { data: recipe, error: getError } = await supabase
      .from('recipes')
      .select('user_id')
      .eq('id', recipeId)
      .single();

    if (getError) {
      if (getError.code === 'PGRST116') {
        logger.error(`Recipe ID ${recipeId} not found`);
        throw new Error('Recipe not found');
      }
      logger.error('Error fetching recipe to delete', { recipeId, error: getError });
      throw getError;
    }

    // Allow deletion only if user_id matches (null user_id recipes likely need admin deletion)
    if (recipe.user_id !== userId) {
      logger.error(`User ${userId} attempted to delete recipe ${recipeId} which belongs to user ${recipe.user_id}`);
      throw new Error('Unauthorized: Cannot delete recipe that belongs to another user');
    }

    const { error: favError } = await supabase
      .from('favorites')
      .delete()
      .eq('recipe_id', recipeId);

    if (favError) {
      logger.error('Error removing recipe from favorites during deletion', { recipeId, error: favError });
    }

    const { error: deleteError } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (deleteError) {
      logger.error('Error deleting recipe', { recipeId, error: deleteError });
      throw deleteError;
    }

    try {
      await deleteRecipeImages(recipeId);
    } catch (imageError) {
      logger.error('Error deleting recipe images, but recipe was deleted', { recipeId, error: imageError });
    }

    logger.info(`Recipe ID ${recipeId} deleted successfully.`);
  } catch (error) {
    logger.error(`Error deleting recipe ID ${recipeId}:`, error);
    // Check if the error message indicates permission issue
     if (error instanceof Error && error.message.includes('Unauthorized')) {
         throw new Error(error.message); // Re-throw specific error
     }
    throw new Error(`Failed to delete recipe: ${(error as Error).message}`);
  }
};


/**
 * Fetches user recipes from Supabase
 */
export const getUserRecipes = async (userId: string): Promise<Recipe[]> => {
  try {
    const { data, error } = await supabase.from('recipes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) { logger.error('Error fetching user recipes', {userId, error }); throw error; }
    if (!data) { return []; }

    if (data.length > 0) {
      logger.debug("Sample recipe from getUserRecipes time fields:", {
        prep_time_minutes: data[0].prep_time_minutes,
        cook_time_minutes: data[0].cook_time_minutes,
        total_time_minutes: data[0].total_time_minutes
      });
      logger.debug("Sample recipe steps from getUserRecipes:", { steps: data[0].steps });
    }

    return data.map((item: Tables<'recipes'>): Recipe => ({
      id: item.id,
      title: item.title,
      servings: item.servings ?? 0,
      ingredients: item.ingredients ?? [],
      steps: item.steps ? (item.steps as unknown as RecipeStep[]) : [],
      nutrition: item.nutrition ? (item.nutrition as unknown as NutritionInfo) : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
      query: item.query ?? '',
      createdAt: new Date(item.created_at ?? Date.now()),
      prepTime: item.prep_time_minutes ?? undefined,
      cookTime: item.cook_time_minutes ?? undefined,
      totalTime: item.total_time_minutes ?? undefined,
      category: item.category ?? undefined,
      tags: item.tags as string[] | undefined,
      views: item.views ?? 0,
      quality_score: item.quality_score ?? undefined,
    }));
  } catch (error) { logger.error('Error fetching user recipes:', { userId, error }); throw new Error(`Failed to fetch recipes: ${(error as Error).message}`); }
};

/**
 * Gets a single recipe by ID
 */
export const getRecipeById = async (recipeId: string): Promise<Recipe | null> => {
  try {
    const { data, error } = await supabase.from('recipes').select('*').eq('id', recipeId).single();
    if (error) { if (error.code === 'PGRST116') return null; logger.error('Error fetching recipe by ID', { recipeId, error }); throw error; }
    if (!data) return null;

    logger.debug("Retrieved time fields from Supabase:", {
        prep_time_minutes: data.prep_time_minutes,
        cook_time_minutes: data.cook_time_minutes,
        total_time_minutes: data.total_time_minutes
    });
    logger.debug(`Retrieved steps for recipe ${recipeId}:`, { steps: data.steps });

    try {
      await supabase
        .from('recipes')
        .update({ views: (data.views || 0) + 1 })
        .eq('id', recipeId);
    } catch (viewError) {
      logger.error('Error incrementing view count:', { recipeId, viewError });
    }

    return {
      id: data.id,
      title: data.title,
      servings: data.servings ?? 0,
      ingredients: data.ingredients ?? [],
      steps: data.steps ? (data.steps as unknown as RecipeStep[]) : [],
      nutrition: data.nutrition ? (data.nutrition as unknown as NutritionInfo) : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
      query: data.query ?? '',
      createdAt: new Date(data.created_at ?? Date.now()),
      prepTime: data.prep_time_minutes ?? undefined,
      cookTime: data.cook_time_minutes ?? undefined,
      totalTime: data.total_time_minutes ?? undefined,
      category: data.category ?? undefined,
      tags: data.tags as string[] | undefined,
      views: data.views ?? 0,
      quality_score: data.quality_score ?? undefined,
      similarity_hash: data.similarity_hash ?? undefined,
    };
  } catch (error) { logger.error('Error fetching recipe by ID:', { recipeId, error }); throw new Error(`Failed to fetch recipe: ${(error as Error).message}`);}
};

/**
 * Gets recipes for discovery based on filters AND optional search query
 */
export const getDiscoverRecipes = async ({ category, tags, sort = 'recent', limit = 20, offset = 0, query }: { category?: string; tags?: string[]; sort?: string; limit?: number; offset?: number; query?: string; }): Promise<Recipe[]> => {
  try {
    logger.info(`Workspaceing discover recipes with filters: category=${category}, tags=${tags?.join(',')}, sort=${sort}, limit=${limit}, offset=${offset}, query=${query}`);
    let queryBuilder = supabase.from('recipes').select('*').is('user_id', null);
    if (category && category !== 'all') { queryBuilder = queryBuilder.eq('category', category); }
    if (tags && tags.length > 0) { queryBuilder = queryBuilder.contains('tags', tags); }
    if (query) { queryBuilder = queryBuilder.ilike('title', `%${query}%`); }
    if (sort === 'popular') { queryBuilder = queryBuilder.order('views', { ascending: false, nullsFirst: false }); }
    else { queryBuilder = queryBuilder.order('created_at', { ascending: false }); }
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);
    const { data, error } = await queryBuilder;
    if (error) { logger.error('Error fetching discover recipes', { error }); throw error; }
    if (!data) { return []; }
    if (data.length > 0) logger.debug("Sample discover recipe steps:", { steps: data[0].steps });
    return data.map((item: Tables<'recipes'>): Recipe => ({
      id: item.id, title: item.title, servings: item.servings ?? 0, ingredients: item.ingredients ?? [],
      steps: item.steps ? (item.steps as unknown as RecipeStep[]) : [],
      nutrition: item.nutrition ? (item.nutrition as unknown as NutritionInfo) : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
      query: item.query ?? '', createdAt: new Date(item.created_at ?? Date.now()),
      prepTime: item.prep_time_minutes ?? undefined, cookTime: item.cook_time_minutes ?? undefined, totalTime: item.total_time_minutes ?? undefined,
      category: item.category ?? undefined, tags: item.tags as string[] | undefined, views: item.views ?? 0, quality_score: item.quality_score ?? undefined,
    }));
  } catch (error) { logger.error('Error fetching discover recipes:', error); throw new Error(`Failed to fetch discover recipes: ${(error as Error).message}`); }
};

/**
 * Gets popular recipes
 */
export const getPopularRecipes = async (limit: number = 10): Promise<Recipe[]> => {
  try {
    logger.info(`Workspaceing popular recipes with limit: ${limit}`);
    const { data, error } = await supabase.from('recipes').select('*').is('user_id', null).order('views', { ascending: false, nullsFirst: false }).limit(limit);
    if (error) { logger.error('Error fetching popular recipes', { error }); throw error; }
    if (!data) { return []; }
    if (data.length > 0) logger.debug("Sample popular recipe steps:", { steps: data[0].steps });
    return data.map((item: Tables<'recipes'>): Recipe => ({
      id: item.id, title: item.title, servings: item.servings ?? 0, ingredients: item.ingredients ?? [],
      steps: item.steps ? (item.steps as unknown as RecipeStep[]) : [],
      nutrition: item.nutrition ? (item.nutrition as unknown as NutritionInfo) : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
      query: item.query ?? '', createdAt: new Date(item.created_at ?? Date.now()),
      prepTime: item.prep_time_minutes ?? undefined, cookTime: item.cook_time_minutes ?? undefined, totalTime: item.total_time_minutes ?? undefined,
      category: item.category ?? undefined, tags: item.tags as string[] | undefined, views: item.views ?? 0, quality_score: item.quality_score ?? undefined,
    }));
  } catch (error) { logger.error('Error fetching popular recipes:', error); throw new Error(`Failed to fetch popular recipes: ${(error as Error).message}`); }
};

/**
 * Gets recipes by category
 */
export const getCategoryRecipes = async (categoryId: string, { limit = 20, offset = 0, sort = 'recent' }: { limit?: number; offset?: number; sort?: string; }): Promise<Recipe[]> => {
  try {
    logger.info(`Workspaceing recipes for category: ${categoryId} with limit=${limit}, offset=${offset}, sort=${sort}`);
    let queryBuilder = supabase.from('recipes').select('*').is('user_id', null).eq('category', categoryId);
    if (sort === 'popular') { queryBuilder = queryBuilder.order('views', { ascending: false, nullsFirst: false }); }
    else { queryBuilder = queryBuilder.order('created_at', { ascending: false }); }
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);
    const { data, error } = await queryBuilder;
    if (error) { logger.error('Error fetching category recipes', { categoryId, error }); throw error; }
    if (!data) { return []; }
    if (data.length > 0) logger.debug("Sample category recipe steps:", { steps: data[0].steps });
    return data.map((item: Tables<'recipes'>): Recipe => ({
      id: item.id, title: item.title, servings: item.servings ?? 0, ingredients: item.ingredients ?? [],
      steps: item.steps ? (item.steps as unknown as RecipeStep[]) : [],
      nutrition: item.nutrition ? (item.nutrition as unknown as NutritionInfo) : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
      query: item.query ?? '', createdAt: new Date(item.created_at ?? Date.now()),
      prepTime: item.prep_time_minutes ?? undefined, cookTime: item.cook_time_minutes ?? undefined, totalTime: item.total_time_minutes ?? undefined,
      category: item.category ?? undefined, tags: item.tags as string[] | undefined, views: item.views ?? 0, quality_score: item.quality_score ?? undefined,
    }));
  } catch (error) { logger.error('Error fetching category recipes:', { categoryId, error }); throw new Error(`Failed to fetch category recipes: ${(error as Error).message}`); }
};

/**
 * Gets all recipe categories with counts
 */
export const getAllCategories = async (): Promise<{ id: string; name: string; count: number }[]> => {
  try {
    logger.info('Fetching all recipe categories with counts');
    const { data, error } = await supabase.rpc('get_category_counts');
    if (error) { logger.error('Error fetching category counts via RPC', { error }); throw error; }
    if (!data) { return []; }
    return recipeCategories.map(category => {
      const countEntry = data.find((item: { category: string | null; recipe_count: number | null }) => item.category === category.id);
      return { id: category.id, name: category.name, count: countEntry?.recipe_count ? Number(countEntry.recipe_count) : 0 };
    });
  } catch (error) { logger.error('Error fetching all categories:', error); throw new Error(`Failed to fetch categories: ${(error as Error).message}`); }
};

/**
 * Saves user preferences
 */
export const saveUserPreferences = async (userId: string, preferences: UserPreferences): Promise<UserPreferences> => {
  try {
    const preferencesData: TablesInsert<'user_preferences'> = {
      user_id: userId, dietary_restrictions: preferences.dietaryRestrictions, favorite_cuisines: preferences.favoriteCuisines,
      allergies: preferences.allergies, cooking_skill: preferences.cookingSkill,
    };
    const { data, error } = await supabase.from('user_preferences').upsert(preferencesData, { onConflict: 'user_id' }).select().single();
    if (error) { logger.error('Error saving user preferences', { userId, error }); throw error; }
    if (!data) { throw new Error('No data returned from preferences upsert'); }
    return {
      dietaryRestrictions: data.dietary_restrictions ?? [], favoriteCuisines: data.favorite_cuisines ?? [],
      allergies: data.allergies ?? [], cookingSkill: (data.cooking_skill ?? 'beginner') as UserPreferences['cookingSkill']
    };
  } catch (error) { logger.error('Error saving user preferences:', { userId, error }); throw new Error(`Failed to save preferences: ${(error as Error).message}`); }
};

/**
 * Gets user preferences
 */
export const getUserPreferences = async (userId: string): Promise<UserPreferences | null> => {
  try {
    const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', userId).single();
    if (error) { if (error.code === 'PGRST116') return null; logger.error('Error fetching user preferences', { userId, error }); throw error; }
    if (!data) return null;
    return {
      dietaryRestrictions: data.dietary_restrictions ?? [], favoriteCuisines: data.favorite_cuisines ?? [],
      allergies: data.allergies ?? [], cookingSkill: (data.cooking_skill ?? 'beginner') as UserPreferences['cookingSkill']
    };
  } catch (error) { logger.error('Error fetching user preferences:', { userId, error }); throw new Error(`Failed to fetch preferences: ${(error as Error).message}`); }
};

/**
 * Saves a search query to history
 */
export const saveSearchHistory = async (userId: string, query: string): Promise<void> => {
  try {
    const historyData: TablesInsert<'search_history'> = { user_id: userId, query };
    const { error } = await supabase.from('search_history').insert(historyData);
    if (error) { logger.error('Error saving search history', { userId, query, error }); } // Log error details
  } catch (error) { logger.error('Error saving search history:', { userId, query, error }); }
};

/**
 * Gets user search history
 */
export const getSearchHistory = async (userId: string, limit: number = 10): Promise<{ query: string; createdAt: Date }[]> => {
  try {
    const { data, error } = await supabase.from('search_history').select('query, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    if (error) { logger.error('Error fetching search history', { userId, error }); return []; }
    if (!data) return [];
    return data.map((item: { query: string | null; created_at: string | null }) => ({
        query: item.query ?? '',
        createdAt: new Date(item.created_at ?? Date.now())
    }));
  } catch (error) { logger.error('Error fetching search history:', { userId, error }); return []; }
};

/**
 * Adds a recipe to user favorites
 */
export const addFavoriteRecipe = async (userId: string, recipeId: string): Promise<void> => {
  try {
    // First, check if the recipe exists globally
    const { error: recipeError } = await supabase.from('recipes').select('id').eq('id', recipeId).single();
    if (recipeError) {
      if (recipeError.code === 'PGRST116') throw new Error('Recipe not found');
      throw recipeError;
    }
    // Now add the favorite
    const favoriteData: TablesInsert<'favorites'> = { user_id: userId, recipe_id: recipeId };
    const { error } = await supabase.from('favorites').insert(favoriteData);
    if (error) { if (error.code === '23505') { logger.warn('Attempted duplicate favorite ignored.'); return; } logger.error('Error adding favorite', { userId, recipeId, error }); throw error; }
    logger.info(`Recipe ${recipeId} added to favorites for user ${userId}`);
  } catch (error) { logger.error('Error adding favorite recipe:', { userId, recipeId, error }); throw new Error(`Failed to add favorite: ${(error as Error).message}`); }
};


/**
 * Removes a recipe from user favorites
 */
export const removeFavoriteRecipe = async (userId: string, recipeId: string): Promise<void> => {
  try {
    const { error } = await supabase.from('favorites').delete().match({ user_id: userId, recipe_id: recipeId });
    if (error) { logger.error('Error removing favorite', { userId, recipeId, error }); throw error; }
     logger.info(`Recipe ${recipeId} removed from favorites for user ${userId}`);
  } catch (error) { logger.error('Error removing favorite recipe:', { userId, recipeId, error }); throw new Error(`Failed to remove favorite: ${(error as Error).message}`);}
};

/**
 * Gets user's favorite recipes
 */
export const getFavoriteRecipes = async (userId: string): Promise<Recipe[]> => {
  try {
    const { data: favoriteData, error: favoriteError } = await supabase.from('favorites').select('recipe_id').eq('user_id', userId);
    if (favoriteError) { logger.error('Error fetching favorite IDs', { userId, error: favoriteError }); throw favoriteError; }
    if (!favoriteData || favoriteData.length === 0) return [];
    const recipeIds = favoriteData.map(item => item.recipe_id).filter((id): id is string => id !== null);
    if (recipeIds.length === 0) return [];
    const { data: recipesData, error: recipesError } = await supabase.from('recipes').select('*').in('id', recipeIds);
    if (recipesError) { logger.error('Error fetching favorite recipes', { userId, error: recipesError }); throw recipesError; }
    if (!recipesData) return [];
    if (recipesData.length > 0) logger.debug("Sample favorite recipe steps:", { steps: recipesData[0].steps });
    return recipesData.map((item: Tables<'recipes'>): Recipe => ({
        id: item.id, title: item.title, servings: item.servings ?? 0, ingredients: item.ingredients ?? [],
        steps: item.steps ? (item.steps as unknown as RecipeStep[]) : [],
        nutrition: item.nutrition ? (item.nutrition as unknown as NutritionInfo) : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
        query: item.query ?? '', createdAt: new Date(item.created_at ?? Date.now()),
        prepTime: item.prep_time_minutes ?? undefined, cookTime: item.cook_time_minutes ?? undefined, totalTime: item.total_time_minutes ?? undefined,
        isFavorite: true,
        category: item.category ?? undefined, tags: item.tags as string[] | undefined, views: item.views ?? 0, quality_score: item.quality_score ?? undefined,
    }));
  } catch (error) { logger.error('Error fetching favorite recipes:', { userId, error }); throw new Error(`Failed to fetch favorites: ${(error as Error).message}`); }
};