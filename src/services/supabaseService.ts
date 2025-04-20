// src/services/supabaseService.ts
import { supabase } from '../config/supabase';
import { Recipe, RecipeStep, NutritionInfo } from '../models/Recipe'; // Updated model
import { User, UserPreferences } from '../models/User'; // Assuming path is correct
import { TablesInsert, Tables, Json } from '../types/supabase'; // Regenerated types
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

    // List all objects in the recipe's folder
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

    // Create a list of paths to delete
    const filesToDelete = data.map(file => `public/steps/${recipeId}/${file.name}`);

    // Delete the images
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
 */
export const saveRecipe = async (recipe: Recipe, userId: string): Promise<Recipe> => {
    if (!recipe.id) { throw new Error('Recipe object must have an ID before saving.'); }
    try {
        logger.info(`Saving recipe ID ${recipe.id} for user ${userId}`);

        // ADD THIS DEBUG LOG
        console.log("Time fields being saved to Supabase:", {
            prep_time_minutes: recipe.prepTime,
            cook_time_minutes: recipe.cookTime,
            total_time_minutes: recipe.totalTime
        });

        // UPDATED: Add category and tags fields if they exist
        const recipeData: TablesInsert<'recipes'> = {
            id: recipe.id,
            user_id: userId === 'system' ? null : userId, // Handle system recipes differently
            title: recipe.title,
            servings: recipe.servings,
            ingredients: recipe.ingredients,
            steps: recipe.steps as unknown as Json,
            nutrition: recipe.nutrition as unknown as Json,
            query: recipe.query,
            created_at: recipe.createdAt.toISOString(),
            // --- Map optional time fields to DB columns ---
            prep_time_minutes: recipe.prepTime ?? null,
            cook_time_minutes: recipe.cookTime ?? null,
            total_time_minutes: recipe.totalTime ?? null,
            // --- NEW: Added for global recipe database ---
            category: (recipe as any).category ?? null,
            tags: (recipe as any).tags ?? null,
            similarity_hash: (recipe as any).similarity_hash ?? null,
            quality_score: (recipe as any).quality_score ?? null,
            views: 0, // Initialize view count for new recipes
        };

        const { data, error } = await supabase.from('recipes').upsert(recipeData, { onConflict: 'id' }).select().single();
        if (error) { logger.error('Error upserting recipe', { recipeId: recipe.id, error }); throw error; }
        if (!data) { throw new Error('No data returned from recipe upsert'); }
        logger.info(`Recipe ID ${recipe.id} saved/upserted successfully.`);

        // ADD THIS DEBUG LOG
        console.log("Supabase response after save:", {
            prep_time_minutes: data.prep_time_minutes,
            cook_time_minutes: data.cook_time_minutes,
            total_time_minutes: data.total_time_minutes
        });

        return recipe;
    } catch (error) { logger.error(`Error saving recipe ID ${recipe.id}:`, error); throw new Error(`Failed to save recipe: ${(error as Error).message}`); }
};

/**
 * Deletes a recipe from Supabase
 */
export const deleteRecipe = async (recipeId: string, userId: string): Promise<void> => {
  try {
    logger.info(`Deleting recipe ID ${recipeId} for user ${userId}`);

    // First verify the recipe belongs to the user
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

    if (recipe.user_id !== userId) {
      logger.error(`User ${userId} attempted to delete recipe ${recipeId} which belongs to user ${recipe.user_id}`);
      throw new Error('Unauthorized: Cannot delete recipe that belongs to another user');
    }

    // Remove from favorites first (all users' favorites of this recipe)
    const { error: favError } = await supabase
      .from('favorites')
      .delete()
      .eq('recipe_id', recipeId);

    if (favError) {
      logger.error('Error removing recipe from favorites during deletion', { recipeId, error: favError });
      // Continue with deletion even if this fails
    }

    // Delete the recipe
    const { error: deleteError } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (deleteError) {
      logger.error('Error deleting recipe', { recipeId, error: deleteError });
      throw deleteError;
    }

    // Delete associated images
    try {
      await deleteRecipeImages(recipeId);
    } catch (imageError) {
      logger.error('Error deleting recipe images, but recipe was deleted', { recipeId, error: imageError });
      // Don't throw here, as the recipe was deleted successfully
    }

    logger.info(`Recipe ID ${recipeId} deleted successfully.`);
  } catch (error) {
    logger.error(`Error deleting recipe ID ${recipeId}:`, error);
    throw new Error(`Failed to delete recipe: ${(error as Error).message}`);
  }
};

/**
 * Fetches user recipes from Supabase
 */
export const getUserRecipes = async (userId: string): Promise<Recipe[]> => {
  try {
    const { data, error } = await supabase.from('recipes').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) { logger.error('Error fetching user recipes', { error }); throw error; }
    if (!data) { return []; }

    // ADD THIS DEBUG LOG
    if (data.length > 0) {
      console.log("Sample recipe from getUserRecipes time fields:", {
        prep_time_minutes: data[0].prep_time_minutes,
        cook_time_minutes: data[0].cook_time_minutes,
        total_time_minutes: data[0].total_time_minutes
      });
    }

    return data.map((item: Tables<'recipes'>) => ({
      id: item.id,
      title: item.title,
      servings: item.servings ?? 0,
      ingredients: item.ingredients ?? [],
      steps: item.steps ? (item.steps as unknown as RecipeStep[]) : [],
      nutrition: item.nutrition ? (item.nutrition as unknown as NutritionInfo) : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
      query: item.query ?? '',
      createdAt: new Date(item.created_at ?? Date.now()),
      // --- Map DB time columns back ---
      prepTime: item.prep_time_minutes ?? undefined,
      cookTime: item.cook_time_minutes ?? undefined,
      totalTime: item.total_time_minutes ?? undefined,
    }));
  } catch (error) { logger.error('Error fetching user recipes:', error); throw new Error(`Failed to fetch recipes: ${(error as Error).message}`); }
};

/**
 * Gets a single recipe by ID
 */
export const getRecipeById = async (recipeId: string): Promise<Recipe | null> => {
  try {
    const { data, error } = await supabase.from('recipes').select('*').eq('id', recipeId).single();
    if (error) { if (error.code === 'PGRST116') return null; logger.error('Error fetching recipe by ID', { error }); throw error; }
    if (!data) return null;

    // ADD THIS DEBUG LOG
    console.log("Retrieved time fields from Supabase:", {
        prep_time_minutes: data.prep_time_minutes,
        cook_time_minutes: data.cook_time_minutes,
        total_time_minutes: data.total_time_minutes
    });

    // Increment view count for this recipe
    try {
      await supabase
        .from('recipes')
        .update({
          views: (data.views || 0) + 1
        })
        .eq('id', recipeId);
    } catch (viewError) {
      logger.error('Error incrementing view count:', viewError);
      // Continue anyway - view count is not critical
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
      // --- Map DB time columns back ---
      prepTime: data.prep_time_minutes ?? undefined,
      cookTime: data.cook_time_minutes ?? undefined,
      totalTime: data.total_time_minutes ?? undefined,
    };
  } catch (error) { logger.error('Error fetching recipe by ID:', error); throw new Error(`Failed to fetch recipe: ${(error as Error).message}`);}
};

/**
 * Gets recipes for discovery based on filters AND optional search query
 */
// --- FIX: Added 'query' to the parameter type definition ---
export const getDiscoverRecipes = async ({
  category,
  tags,
  sort = 'recent',
  limit = 20,
  offset = 0,
  query // Added query parameter
}: {
  category?: string;
  tags?: string[];
  sort?: string;
  limit?: number;
  offset?: number;
  query?: string; // Make query optional
}): Promise<Recipe[]> => {
  try {
    logger.info(`Workspaceing discover recipes with filters: category=${category}, tags=${tags?.join(',')}, sort=${sort}, limit=${limit}, offset=${offset}, query=${query}`);

    // Start with system recipes query (user_id is null)
    let queryBuilder = supabase // Renamed 'query' variable to 'queryBuilder' to avoid conflict
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
    } else {
      queryBuilder = queryBuilder.order('created_at', { ascending: false });
    }

    // Apply pagination
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);

    // Execute query
    const { data, error } = await queryBuilder;

    if (error) {
      logger.error('Error fetching discover recipes', { error });
      throw error;
    }

    if (!data) {
      return [];
    }

    // Convert to Recipe objects
    return data.map((item: Tables<'recipes'>) => ({
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
      // Additional fields for discovery
      category: item.category,
      tags: item.tags as string[] | undefined,
    }));
  } catch (error) {
    logger.error('Error fetching discover recipes:', error);
    throw new Error(`Failed to fetch discover recipes: ${(error as Error).message}`);
  }
};


/**
 * Gets popular recipes
 */
export const getPopularRecipes = async (limit: number = 10): Promise<Recipe[]> => {
  try {
    logger.info(`Workspaceing popular recipes with limit: ${limit}`);

    // Get system recipes with highest view counts
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .is('user_id', null)
      .order('views', { ascending: false, nullsFirst: false }) // Handle nulls in views
      .limit(limit);

    if (error) {
      logger.error('Error fetching popular recipes', { error });
      throw error;
    }

    if (!data) {
      return [];
    }

    // Convert to Recipe objects
    return data.map((item: Tables<'recipes'>) => ({
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
      // Additional fields for discovery
      category: item.category,
      tags: item.tags as string[] | undefined,
    }));
  } catch (error) {
    logger.error('Error fetching popular recipes:', error);
    throw new Error(`Failed to fetch popular recipes: ${(error as Error).message}`);
  }
};

/**
 * Gets recipes by category
 */
export const getCategoryRecipes = async (
  categoryId: string,
  {
    limit = 20,
    offset = 0,
    sort = 'recent'
  }: {
    limit?: number;
    offset?: number;
    sort?: string;
  }
): Promise<Recipe[]> => {
  try {
    logger.info(`Workspaceing recipes for category: ${categoryId} with limit=${limit}, offset=${offset}, sort=${sort}`);

    // Get system recipes for the specified category
    let query = supabase
      .from('recipes')
      .select('*')
      .is('user_id', null)
      .eq('category', categoryId);

    // Apply sorting
    if (sort === 'popular') {
      query = query.order('views', { ascending: false, nullsFirst: false }); // Handle nulls in views
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching category recipes', { error });
      throw error;
    }

    if (!data) {
      return [];
    }

    // Convert to Recipe objects
    return data.map((item: Tables<'recipes'>) => ({
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
      // Additional fields for discovery
      category: item.category,
      tags: item.tags as string[] | undefined,
    }));
  } catch (error) {
    logger.error('Error fetching category recipes:', error);
    throw new Error(`Failed to fetch category recipes: ${(error as Error).message}`);
  }
};

/**
 * Gets all recipe categories with counts
 */
export const getAllCategories = async (): Promise<{ id: string; name: string; count: number }[]> => {
  try {
    logger.info('Fetching all recipe categories with counts');

    // --- FIX for Error 1: Use RPC call ---
    // Ensure you have created the 'get_category_counts' function in Supabase SQL Editor
    const { data, error } = await supabase.rpc('get_category_counts');
    // --- End FIX for Error 1 ---

    if (error) {
      logger.error('Error fetching category counts via RPC', { error });
      throw error;
    }

    if (!data) {
      return [];
    }

    // Map the counts to the predefined categories
    return recipeCategories.map(category => {
      // --- FIX for Error 2: Add explicit type for item ---
      // The type matches the 'RETURNS TABLE' definition of the SQL function
      const countEntry = data.find((item: { category: string | null; recipe_count: number | null }) =>
          item.category === category.id
      );
      // --- End FIX for Error 2 ---

      return {
        id: category.id,
        name: category.name,
        // Use 'recipe_count' from RPC result, handle potential null and ensure it's a number
        count: countEntry?.recipe_count ? Number(countEntry.recipe_count) : 0
      };
    });
  } catch (error) {
    logger.error('Error fetching all categories:', error);
    throw new Error(`Failed to fetch categories: ${(error as Error).message}`);
  }
};


/**
 * Saves user preferences
 */
export const saveUserPreferences = async (userId: string, preferences: UserPreferences): Promise<UserPreferences> => {
  try {
    const preferencesData: TablesInsert<'user_preferences'> = {
      user_id: userId,
      dietary_restrictions: preferences.dietaryRestrictions,
      favorite_cuisines: preferences.favoriteCuisines,
      allergies: preferences.allergies,
      cooking_skill: preferences.cookingSkill,
    };
    const { data, error } = await supabase.from('user_preferences').upsert(preferencesData, { onConflict: 'user_id' }).select().single();
    if (error) { logger.error('Error saving user preferences', { error }); throw error; }
    if (!data) { throw new Error('No data returned from preferences upsert'); }
    return {
      dietaryRestrictions: data.dietary_restrictions ?? [],
      favoriteCuisines: data.favorite_cuisines ?? [],
      allergies: data.allergies ?? [],
      cookingSkill: (data.cooking_skill ?? 'beginner') as UserPreferences['cookingSkill'] // Cast to expected type
    };
  } catch (error) { logger.error('Error saving user preferences:', error); throw new Error(`Failed to save preferences: ${(error as Error).message}`); }
};

/**
 * Gets user preferences
 */
export const getUserPreferences = async (userId: string): Promise<UserPreferences | null> => {
  try {
    const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', userId).single();
    if (error) { if (error.code === 'PGRST116') return null; logger.error('Error fetching user preferences', { error }); throw error; }
    if (!data) return null;
    return {
      dietaryRestrictions: data.dietary_restrictions ?? [],
      favoriteCuisines: data.favorite_cuisines ?? [],
      allergies: data.allergies ?? [],
      cookingSkill: (data.cooking_skill ?? 'beginner') as UserPreferences['cookingSkill'] // Cast to expected type
    };
  } catch (error) { logger.error('Error fetching user preferences:', error); throw new Error(`Failed to fetch preferences: ${(error as Error).message}`); }
};

/**
 * Saves a search query to history
 */
export const saveSearchHistory = async (userId: string, query: string): Promise<void> => {
  try {
    const historyData: TablesInsert<'search_history'> = { user_id: userId, query };
    const { error } = await supabase.from('search_history').insert(historyData);
    if (error) { logger.error('Error saving search history', { error }); }
  } catch (error) { logger.error('Error saving search history:', error); }
};

/**
 * Gets user search history
 */
export const getSearchHistory = async (userId: string, limit: number = 10): Promise<{ query: string; createdAt: Date }[]> => {
  try {
    const { data, error } = await supabase.from('search_history').select('query, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    if (error) { logger.error('Error fetching search history', { error }); return []; }
    if (!data) return [];
    return data.map((item: { query: string | null; created_at: string | null }) => ({
        query: item.query ?? '', // Handle potential null query
        createdAt: new Date(item.created_at ?? Date.now())
    }));
  } catch (error) { logger.error('Error fetching search history:', error); return []; }
};

/**
 * Adds a recipe to user favorites
 */
export const addFavoriteRecipe = async (userId: string, recipeId: string): Promise<void> => {
  try {
    const favoriteData: TablesInsert<'favorites'> = { user_id: userId, recipe_id: recipeId };
    const { error } = await supabase.from('favorites').insert(favoriteData);
    if (error) { if (error.code === '23505') { logger.warn('Attempted duplicate favorite ignored.'); return; } logger.error('Error adding favorite', { error }); throw error; }
    logger.info(`Recipe ${recipeId} added to favorites for user ${userId}`);
  } catch (error) { logger.error('Error adding favorite recipe:', error); throw new Error(`Failed to add favorite: ${(error as Error).message}`); }
};

/**
 * Removes a recipe from user favorites
 */
export const removeFavoriteRecipe = async (userId: string, recipeId: string): Promise<void> => {
  try {
    const { error } = await supabase.from('favorites').delete().match({ user_id: userId, recipe_id: recipeId });
    if (error) { logger.error('Error removing favorite', { error }); throw error; }
     logger.info(`Recipe ${recipeId} removed from favorites for user ${userId}`);
  } catch (error) { logger.error('Error removing favorite recipe:', error); throw new Error(`Failed to remove favorite: ${(error as Error).message}`);}
};

/**
 * Gets user's favorite recipes
 */
export const getFavoriteRecipes = async (userId: string): Promise<Recipe[]> => {
  try {
    const { data: favoriteData, error: favoriteError } = await supabase.from('favorites').select('recipe_id').eq('user_id', userId);
    if (favoriteError) { logger.error('Error fetching favorite IDs', { error: favoriteError }); throw favoriteError; }
    if (!favoriteData || favoriteData.length === 0) return [];
    const recipeIds = favoriteData.map(item => item.recipe_id).filter((id): id is string => id !== null);
    if (recipeIds.length === 0) return [];
    const { data: recipesData, error: recipesError } = await supabase.from('recipes').select('*').in('id', recipeIds);
    if (recipesError) { logger.error('Error fetching favorite recipes', { error: recipesError }); throw recipesError; }
    if (!recipesData) return [];
    return recipesData.map((item: Tables<'recipes'>) => ({
        id: item.id, title: item.title, servings: item.servings ?? 0, ingredients: item.ingredients ?? [],
        steps: item.steps ? (item.steps as unknown as RecipeStep[]) : [],
        nutrition: item.nutrition ? (item.nutrition as unknown as NutritionInfo) : { calories: 0, protein: '0g', fat: '0g', carbs: '0g' },
        query: item.query ?? '', createdAt: new Date(item.created_at ?? Date.now()),
        prepTime: item.prep_time_minutes ?? undefined, cookTime: item.cook_time_minutes ?? undefined, totalTime: item.total_time_minutes ?? undefined,
        // Add isFavorite flag set to true for all items
        isFavorite: true,
    }));
  } catch (error) { logger.error('Error fetching favorite recipes:', error); throw new Error(`Failed to fetch favorites: ${(error as Error).message}`); }
};