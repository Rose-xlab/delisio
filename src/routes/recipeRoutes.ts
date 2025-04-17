import express from 'express';
import { generateRecipe } from '../controllers/recipeControllers';
import { optionalAuthenticate } from '../middleware/authMiddleware';
import { saveRecipe } from '../services/supabaseService';
import { validateRequest, recipeSchema } from '../utils/validationUtils';
import { AppError } from '../middleware/errorMiddleware';

const router = express.Router();

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
        const savedRecipe = await saveRecipe(recipe, req.user.id);
        return res.status(200).json(savedRecipe);
      } catch (saveError) {
        console.error('Error saving recipe, but continuing:', saveError);
        // Continue without saving if there's an error
      }
    }
    
    res.status(200).json(recipe);
  } catch (error) {
    next(error);
  }
});

export default router;