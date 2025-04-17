import express from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { getUserRecipes, getRecipeById, saveRecipe } from '../services/supabaseService';
import { AppError } from '../middleware/errorMiddleware';

const router = express.Router();

/**
 * @route   GET /api/users/recipes
 * @desc    Get all recipes for the current user
 * @access  Private
 */
router.get('/recipes', authenticate, async (req, res, next) => {
  try {
    const recipes = await getUserRecipes(req.user.id);
    res.status(200).json({ recipes });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/users/recipes/:id
 * @desc    Get a specific recipe by ID
 * @access  Private
 */
router.get('/recipes/:id', authenticate, async (req, res, next) => {
  try {
    const recipeId = req.params.id;
    
    if (!recipeId) {
      throw new AppError('Recipe ID is required', 400);
    }
    
    const recipe = await getRecipeById(recipeId);
    
    if (!recipe) {
      throw new AppError('Recipe not found', 404);
    }
    
    res.status(200).json({ recipe });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/users/recipes
 * @desc    Save a recipe for the current user
 * @access  Private
 */
router.post('/recipes', authenticate, async (req, res, next) => {
  try {
    const recipeData = req.body;
    
    if (!recipeData || !recipeData.title || !recipeData.ingredients || !recipeData.steps) {
      throw new AppError('Invalid recipe data', 400);
    }
    
    // Add user ID to recipe data
    const savedRecipe = await saveRecipe(recipeData, req.user.id);
    
    res.status(201).json({ recipe: savedRecipe });
  } catch (error) {
    next(error);
  }
});

export default router;