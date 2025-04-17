"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const supabaseService_1 = require("../services/supabaseService");
const errorMiddleware_1 = require("../middleware/errorMiddleware");
const router = express_1.default.Router();
/**
 * @route   GET /api/users/recipes
 * @desc    Get all recipes for the current user
 * @access  Private
 */
router.get('/recipes', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        const recipes = await (0, supabaseService_1.getUserRecipes)(req.user.id);
        res.status(200).json({ recipes });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/users/recipes/:id
 * @desc    Get a specific recipe by ID
 * @access  Private
 */
router.get('/recipes/:id', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        const recipeId = req.params.id;
        if (!recipeId) {
            throw new errorMiddleware_1.AppError('Recipe ID is required', 400);
        }
        const recipe = await (0, supabaseService_1.getRecipeById)(recipeId);
        if (!recipe) {
            throw new errorMiddleware_1.AppError('Recipe not found', 404);
        }
        res.status(200).json({ recipe });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/users/recipes
 * @desc    Save a recipe for the current user
 * @access  Private
 */
router.post('/recipes', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        const recipeData = req.body;
        if (!recipeData || !recipeData.title || !recipeData.ingredients || !recipeData.steps) {
            throw new errorMiddleware_1.AppError('Invalid recipe data', 400);
        }
        // Add user ID to recipe data
        const savedRecipe = await (0, supabaseService_1.saveRecipe)(recipeData, req.user.id);
        res.status(201).json({ recipe: savedRecipe });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=userRoutes.js.map