"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const recipeControllers_1 = require("../controllers/recipeControllers");
const authMiddleware_1 = require("../middleware/authMiddleware");
const supabaseService_1 = require("../services/supabaseService");
const validationUtils_1 = require("../utils/validationUtils");
const router = express_1.default.Router();
/**
 * @route   POST /api/recipes
 * @desc    Generate a recipe with illustrations based on user query
 * @access  Public, but will use user preferences if authenticated
 */
router.post('/', authMiddleware_1.optionalAuthenticate, (0, validationUtils_1.validateRequest)(validationUtils_1.recipeSchema), async (req, res, next) => {
    try {
        const { query, save } = req.body;
        // Get user preferences if user is authenticated
        const userPreferences = req.user?.preferences;
        // Generate recipe, passing user preferences if available
        const recipe = await (0, recipeControllers_1.generateRecipe)(query, userPreferences);
        // If user is authenticated and wants to save the recipe
        if (req.user && save) {
            try {
                const savedRecipe = await (0, supabaseService_1.saveRecipe)(recipe, req.user.id);
                return res.status(200).json(savedRecipe);
            }
            catch (saveError) {
                console.error('Error saving recipe, but continuing:', saveError);
                // Continue without saving if there's an error
            }
        }
        res.status(200).json(recipe);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=recipeRoutes.js.map