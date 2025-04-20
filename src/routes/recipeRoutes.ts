// src/routes/recipeRoutes.ts
import express from 'express';
import { generateRecipe, cancelRecipeGeneration } from '../controllers/recipeControllers';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware';
import { saveRecipe, getRecipeById, deleteRecipe, getFavoriteRecipes, addFavoriteRecipe, removeFavoriteRecipe, getDiscoverRecipes, getPopularRecipes, getCategoryRecipes, getAllCategories } from '../services/supabaseService';
import { validateRequest, recipeSchema } from '../utils/validationUtils';
import { AppError } from '../middleware/errorMiddleware';

const router = express.Router();

// --- Specific GET Routes First ---

/**
 * @route   GET /api/recipes/favorites
 * @desc    Get all favorite recipes for the current user
 * @access  Private
 */
router.get('/favorites', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const recipes = await getFavoriteRecipes(userId);

    res.status(200).json({ recipes });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/recipes/discover
 * @desc    Get recipes for discovery with optional filtering
 * @access  Public
 */
router.get('/discover', optionalAuthenticate, async (req, res, next) => {
  try {
    const { category, tags, sort = 'recent', limit = 20, offset = 0, query } = req.query;

    // Process tags from comma-separated string if provided
    let tagsArray;
    if (tags && typeof tags === 'string') {
      tagsArray = tags.split(',').map(tag => tag.trim());
    }

    const recipes = await getDiscoverRecipes({
      category: typeof category === 'string' ? category : undefined,
      tags: tagsArray,
      sort: typeof sort === 'string' ? sort : 'recent',
      limit: typeof limit === 'string' ? parseInt(limit) : 20,
      offset: typeof offset === 'string' ? parseInt(offset) : 0,
      query: typeof query === 'string' ? query : undefined,
    });

    res.status(200).json({ recipes });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/recipes/popular
 * @desc    Get popular recipes
 * @access  Public
 */
router.get('/popular', optionalAuthenticate, async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const recipes = await getPopularRecipes(
      typeof limit === 'string' ? parseInt(limit) : 10
    );

    res.status(200).json({ recipes });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/recipes/categories
 * @desc    Get all recipe categories with counts
 * @access  Public
 */
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await getAllCategories();

    res.status(200).json({ categories });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/recipes/trending
 * @desc    Alias for popular recipes (for API consistency)
 * @access  Public
 */
router.get('/trending', optionalAuthenticate, async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const recipes = await getPopularRecipes( // Calls the correct underlying service function
      typeof limit === 'string' ? parseInt(limit) : 10
    );

    res.status(200).json({ recipes });
  } catch (error) {
    next(error);
  }
});

// --- Parameterized GET Routes ---

/**
 * @route   GET /api/recipes/category/:categoryId
 * @desc    Get recipes by category
 * @access  Public
 */
router.get('/category/:categoryId', optionalAuthenticate, async (req, res, next) => {
  try {
    const categoryId = req.params.categoryId;
    const { sort = 'recent', limit = 20, offset = 0 } = req.query;

    if (!categoryId) {
      throw new AppError('Category ID is required', 400);
    }

    const recipes = await getCategoryRecipes(
      categoryId,
      {
        sort: typeof sort === 'string' ? sort : 'recent',
        limit: typeof limit === 'string' ? parseInt(limit) : 20,
        offset: typeof offset === 'string' ? parseInt(offset) : 0,
      }
    );

    res.status(200).json({ recipes });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/recipes/by-category/:category
 * @desc    Alias for category/:categoryId (for API consistency)
 * @access  Public
 */
router.get('/by-category/:category', optionalAuthenticate, async (req, res, next) => {
  try {
    const categoryId = req.params.category;
    const { sort = 'recent', limit = 20, offset = 0 } = req.query;

    if (!categoryId) {
      throw new AppError('Category ID is required', 400);
    }

    const recipes = await getCategoryRecipes( // Calls the correct underlying service function
      categoryId,
      {
        sort: typeof sort === 'string' ? sort : 'recent',
        limit: typeof limit === 'string' ? parseInt(limit) : 20,
        offset: typeof offset === 'string' ? parseInt(offset) : 0,
      }
    );

    res.status(200).json({ recipes });
  } catch (error) {
    next(error);
  }
});


/**
 * @route   GET /api/recipes/:id  <- IMPORTANT: This now comes AFTER specific paths
 * @desc    Get a specific recipe by ID
 * @access  Public
 */
router.get('/:id', optionalAuthenticate, async (req, res, next) => {
  try {
    const recipeId = req.params.id;

     // Optional: Basic check if it looks like a UUID before querying DB
     const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
     if (!uuidRegex.test(recipeId)) {
         // It's not a UUID, so it's not a valid recipe ID for this endpoint.
         // Previously, this check wasn't strictly needed because specific routes would match first.
         // Now, this explicitly handles cases where something other than a UUID hits this route.
         throw new AppError('Recipe not found', 404); // Treat non-UUIDs as not found
     }

    // The !recipeId check is less critical now but safe to keep.
    if (!recipeId) {
        throw new AppError('Recipe ID is required', 400);
    }

    const recipe = await getRecipeById(recipeId);

    if (!recipe) {
      throw new AppError('Recipe not found', 404);
    }

    // Check if recipe is favorited by the user if authenticated
    let isFavorite = false;
    if (req.user) {
      const favorites = await getFavoriteRecipes(req.user.id);
      isFavorite = favorites.some(fav => fav && fav.id === recipeId); // Check fav exists before accessing id
    }

    res.status(200).json({
      recipe,
      isFavorite
    });
  } catch (error) {
    next(error);
  }
});


// --- POST, DELETE Routes ---
// Order matters less between different methods, but keep related :id routes together

/**
 * @route   POST /api/recipes
 * @desc    Generate a recipe with illustrations based on user query
 * @access  Public, but will use user preferences if authenticated
 */
router.post('/', optionalAuthenticate, validateRequest(recipeSchema), async (req, res, next) => {
  try {
    const { query, save } = req.body;

    // Get user preferences if user is authenticated
    const userPreferences = req.user?.preferences;

    // Generate recipe, passing user preferences if available
    const recipe = await generateRecipe(query, userPreferences);

    // If user is authenticated and wants to save the recipe
    if (req.user && save) {
      try {
        // Ensure recipe ID exists before saving
        if (!recipe.id) {
            // Handle missing ID - maybe generate one if needed?
            // For now, let's assume generateRecipe provides one or log error
            console.error('Error: Recipe generated without an ID, cannot save.');
            throw new AppError('Generated recipe missing ID', 500);
        }
        const savedRecipe = await saveRecipe(recipe, req.user.id);
        return res.status(200).json(savedRecipe);
      } catch (saveError) {
        console.error('Error saving recipe, but continuing:', saveError);
        // Decide if you should return the unsaved recipe or an error
        // Returning unsaved recipe for now
        return res.status(200).json(recipe); // Return original unsaved recipe
      }
    }

    res.status(200).json(recipe);
  } catch (error) {
    // Special handling for cancellation errors
    if (error instanceof AppError && error.statusCode === 499) {
      console.log('Sending 499 status code for cancelled recipe generation');
      return res.status(499).json({
        error: {
          message: 'Recipe generation was cancelled',
          status: 499
        }
      });
    }
    next(error);
  }
});

/**
 * @route   POST /api/recipes/cancel
 * @desc    Cancel an in-progress recipe generation
 * @access  Public
 */
router.post('/cancel', async (req, res, next) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      throw new AppError('requestId is required', 400);
    }

    console.log(`Cancellation request received for requestId: ${requestId}`);
    const result = await cancelRecipeGeneration(requestId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/recipes/:id
 * @desc    Delete a recipe
 * @access  Private - only recipe owner can delete
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user.id;

    if (!recipeId) {
      throw new AppError('Recipe ID is required', 400);
    }

     // Optional: Add UUID check here too for consistency
     const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
     if (!uuidRegex.test(recipeId)) {
         throw new AppError('Invalid Recipe ID format', 400);
     }

    // Service function `deleteRecipe` should handle checking ownership
    await deleteRecipe(recipeId, userId);

    res.status(200).json({ message: 'Recipe deleted successfully' });
  } catch (error) {
     // Catch specific errors like 'Recipe not found' or 'Unauthorized' from the service
     if (error instanceof Error && (error.message.includes('Recipe not found') || error.message.includes('Unauthorized'))) {
         // Use appropriate status codes based on the caught error
         const statusCode = error.message.includes('not found') ? 404 : 403; // 403 Forbidden for unauthorized
         next(new AppError(error.message, statusCode));
     } else {
         next(error); // Pass other errors to the general error handler
     }
  }
});


/**
 * @route   POST /api/recipes/:id/favorite
 * @desc    Add a recipe to favorites
 * @access  Private
 */
router.post('/:id/favorite', authenticate, async (req, res, next) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user.id;

    if (!recipeId) {
      throw new AppError('Recipe ID is required', 400);
    }

     // Optional: Add UUID check
     const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
     if (!uuidRegex.test(recipeId)) {
         throw new AppError('Invalid Recipe ID format', 400);
     }

    // Check if recipe exists before favoriting (optional, addFavoriteRecipe might handle it)
    // const recipe = await getRecipeById(recipeId);
    // if (!recipe) {
    //   throw new AppError('Recipe not found', 404);
    // }

    // Add to favorites (Service function handles existence checks / errors)
    await addFavoriteRecipe(userId, recipeId);

    res.status(200).json({ message: 'Recipe added to favorites' });
  } catch (error) {
     // Handle potential errors from addFavoriteRecipe, like recipe not found if checked
     if (error instanceof Error && error.message.includes('not found')) {
         next(new AppError(error.message, 404));
     } else {
        next(error);
     }
  }
});

/**
 * @route   DELETE /api/recipes/:id/favorite
 * @desc    Remove a recipe from favorites
 * @access  Private
 */
router.delete('/:id/favorite', authenticate, async (req, res, next) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user.id;

    if (!recipeId) {
      throw new AppError('Recipe ID is required', 400);
    }

     // Optional: Add UUID check
     const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
     if (!uuidRegex.test(recipeId)) {
         throw new AppError('Invalid Recipe ID format', 400);
     }

    // Remove from favorites
    await removeFavoriteRecipe(userId, recipeId);

    res.status(200).json({ message: 'Recipe removed from favorites' });
  } catch (error) {
    next(error);
  }
});


export default router;