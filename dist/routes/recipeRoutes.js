"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/recipeRoutes.ts
const express_1 = __importDefault(require("express"));
const recipeControllers_1 = require("../controllers/recipeControllers");
const authMiddleware_1 = require("../middleware/authMiddleware");
const supabaseService_1 = require("../services/supabaseService");
const validationUtils_1 = require("../utils/validationUtils");
const errorMiddleware_1 = require("../middleware/errorMiddleware");
const router = express_1.default.Router();
// --- Queue Status Route ---
/**
 * @route   GET /api/recipes/queue-status
 * @desc    Get status of the recipe generation queue
 * @access  Public
 */
router.get('/queue-status', async (req, res, next) => {
    try {
        await (0, recipeControllers_1.getQueueStatus)(req, res, next);
    }
    catch (error) {
        next(error);
    }
});
// --- Recipe Status Route ---
/**
 * @route   GET /api/recipes/status/:requestId
 * @desc    Get status or result of a recipe generation request
 * @access  Public, but will return user-specific data if authenticated
 */
router.get('/status/:requestId', authMiddleware_1.optionalAuthenticate, async (req, res, next) => {
    try {
        await (0, recipeControllers_1.getRecipeStatus)(req, res, next);
    }
    catch (error) {
        next(error);
    }
});
// --- Specific GET Routes First ---
/**
 * @route   GET /api/recipes/favorites
 * @desc    Get all favorite recipes for the current user
 * @access  Private
 */
router.get('/favorites', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const recipes = await (0, supabaseService_1.getFavoriteRecipes)(userId);
        res.status(200).json({ recipes });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/recipes/discover
 * @desc    Get recipes for discovery with optional filtering
 * @access  Public
 */
router.get('/discover', authMiddleware_1.optionalAuthenticate, async (req, res, next) => {
    try {
        const { category, tags, sort = 'recent', limit = 20, offset = 0, query } = req.query;
        // Process tags from comma-separated string if provided
        let tagsArray;
        if (tags && typeof tags === 'string') {
            tagsArray = tags.split(',').map(tag => tag.trim());
        }
        const recipes = await (0, supabaseService_1.getDiscoverRecipes)({
            category: typeof category === 'string' ? category : undefined,
            tags: tagsArray,
            sort: typeof sort === 'string' ? sort : 'recent',
            limit: typeof limit === 'string' ? parseInt(limit) : 20,
            offset: typeof offset === 'string' ? parseInt(offset) : 0,
            query: typeof query === 'string' ? query : undefined,
        });
        res.status(200).json({ recipes });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/recipes/popular
 * @desc    Get popular recipes
 * @access  Public
 */
router.get('/popular', authMiddleware_1.optionalAuthenticate, async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        const recipes = await (0, supabaseService_1.getPopularRecipes)(typeof limit === 'string' ? parseInt(limit) : 10);
        res.status(200).json({ recipes });
    }
    catch (error) {
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
        const categories = await (0, supabaseService_1.getAllCategories)();
        res.status(200).json({ categories });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/recipes/trending
 * @desc    Alias for popular recipes (for API consistency)
 * @access  Public
 */
router.get('/trending', authMiddleware_1.optionalAuthenticate, async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        const recipes = await (0, supabaseService_1.getPopularRecipes)(typeof limit === 'string' ? parseInt(limit) : 10);
        res.status(200).json({ recipes });
    }
    catch (error) {
        next(error);
    }
});
// --- Parameterized GET Routes ---
/**
 * @route   GET /api/recipes/category/:categoryId
 * @desc    Get recipes by category
 * @access  Public
 */
router.get('/category/:categoryId', authMiddleware_1.optionalAuthenticate, async (req, res, next) => {
    try {
        const categoryId = req.params.categoryId;
        const { sort = 'recent', limit = 20, offset = 0 } = req.query;
        if (!categoryId) {
            throw new errorMiddleware_1.AppError('Category ID is required', 400);
        }
        const recipes = await (0, supabaseService_1.getCategoryRecipes)(categoryId, {
            sort: typeof sort === 'string' ? sort : 'recent',
            limit: typeof limit === 'string' ? parseInt(limit) : 20,
            offset: typeof offset === 'string' ? parseInt(offset) : 0,
        });
        res.status(200).json({ recipes });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/recipes/by-category/:category
 * @desc    Alias for category/:categoryId (for API consistency)
 * @access  Public
 */
router.get('/by-category/:category', authMiddleware_1.optionalAuthenticate, async (req, res, next) => {
    try {
        const categoryId = req.params.category;
        const { sort = 'recent', limit = 20, offset = 0 } = req.query;
        if (!categoryId) {
            throw new errorMiddleware_1.AppError('Category ID is required', 400);
        }
        const recipes = await (0, supabaseService_1.getCategoryRecipes)(categoryId, {
            sort: typeof sort === 'string' ? sort : 'recent',
            limit: typeof limit === 'string' ? parseInt(limit) : 20,
            offset: typeof offset === 'string' ? parseInt(offset) : 0,
        });
        res.status(200).json({ recipes });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/recipes/:id
 * @desc    Get a specific recipe by ID
 * @access  Public
 */
router.get('/:id', authMiddleware_1.optionalAuthenticate, async (req, res, next) => {
    try {
        const recipeId = req.params.id;
        // Basic check if it looks like a UUID
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(recipeId)) {
            throw new errorMiddleware_1.AppError('Recipe not found', 404);
        }
        if (!recipeId) {
            throw new errorMiddleware_1.AppError('Recipe ID is required', 400);
        }
        const recipe = await (0, supabaseService_1.getRecipeById)(recipeId);
        if (!recipe) {
            throw new errorMiddleware_1.AppError('Recipe not found', 404);
        }
        // Check if recipe is favorited by the user if authenticated
        let isFavorite = false;
        if (req.user) {
            const favorites = await (0, supabaseService_1.getFavoriteRecipes)(req.user.id);
            isFavorite = favorites.some(fav => fav && fav.id === recipeId);
        }
        res.status(200).json({
            recipe,
            isFavorite
        });
    }
    catch (error) {
        next(error);
    }
});
// --- POST, DELETE Routes ---
/**
 * @route   POST /api/recipes
 * @desc    Generate a recipe with illustrations based on user query
 * @access  Public, but will use user preferences if authenticated
 */
router.post('/', authMiddleware_1.optionalAuthenticate, (0, validationUtils_1.validateRequest)(validationUtils_1.recipeSchema), async (req, res, next) => {
    try {
        await (0, recipeControllers_1.generateRecipe)(req, res, next);
    }
    catch (error) {
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
        await (0, recipeControllers_1.cancelRecipeGeneration)(req, res, next);
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   DELETE /api/recipes/:id
 * @desc    Delete a recipe
 * @access  Private - only recipe owner can delete
 */
router.delete('/:id', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        const recipeId = req.params.id;
        const userId = req.user.id;
        if (!recipeId) {
            throw new errorMiddleware_1.AppError('Recipe ID is required', 400);
        }
        // Check UUID format
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(recipeId)) {
            throw new errorMiddleware_1.AppError('Invalid Recipe ID format', 400);
        }
        await (0, supabaseService_1.deleteRecipe)(recipeId, userId);
        res.status(200).json({ message: 'Recipe deleted successfully' });
    }
    catch (error) {
        // Catch specific errors
        if (error instanceof Error && (error.message.includes('Recipe not found') || error.message.includes('Unauthorized'))) {
            const statusCode = error.message.includes('not found') ? 404 : 403;
            next(new errorMiddleware_1.AppError(error.message, statusCode));
        }
        else {
            next(error);
        }
    }
});
/**
 * @route   POST /api/recipes/:id/favorite
 * @desc    Add a recipe to favorites
 * @access  Private
 */
router.post('/:id/favorite', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        const recipeId = req.params.id;
        const userId = req.user.id;
        if (!recipeId) {
            throw new errorMiddleware_1.AppError('Recipe ID is required', 400);
        }
        // Check UUID format
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(recipeId)) {
            throw new errorMiddleware_1.AppError('Invalid Recipe ID format', 400);
        }
        await (0, supabaseService_1.addFavoriteRecipe)(userId, recipeId);
        res.status(200).json({ message: 'Recipe added to favorites' });
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
            next(new errorMiddleware_1.AppError(error.message, 404));
        }
        else {
            next(error);
        }
    }
});
/**
 * @route   DELETE /api/recipes/:id/favorite
 * @desc    Remove a recipe from favorites
 * @access  Private
 */
router.delete('/:id/favorite', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        const recipeId = req.params.id;
        const userId = req.user.id;
        if (!recipeId) {
            throw new errorMiddleware_1.AppError('Recipe ID is required', 400);
        }
        // Check UUID format
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        if (!uuidRegex.test(recipeId)) {
            throw new errorMiddleware_1.AppError('Invalid Recipe ID format', 400);
        }
        await (0, supabaseService_1.removeFavoriteRecipe)(userId, recipeId);
        res.status(200).json({ message: 'Recipe removed from favorites' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=recipeRoutes.js.map