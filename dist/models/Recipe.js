"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRecipe = exports.validateRecipe = void 0;
/**
 * Validates a recipe object
 * @param recipe Recipe object to validate
 * @returns Boolean indicating if recipe is valid
 */
const validateRecipe = (recipe) => {
    // Check if the recipe has the required fields
    if (!recipe.title || !recipe.ingredients || !recipe.steps) {
        return false;
    }
    // Check if ingredients is an array
    if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
        return false;
    }
    // Check if steps is an array
    if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
        return false;
    }
    // Check if each step has text
    for (const step of recipe.steps) {
        // Ensure step itself is an object and has text property
        if (typeof step !== 'object' || step === null || !step.text) {
            return false;
        }
    }
    return true;
};
exports.validateRecipe = validateRecipe;
/**
 * Creates a recipe object with default values for missing fields
 * @param recipeData Partial recipe data
 * @returns Complete recipe object
 */
const createRecipe = (recipeData) => {
    return {
        title: recipeData.title || 'Untitled Recipe',
        servings: recipeData.servings || 4,
        ingredients: recipeData.ingredients || [],
        steps: recipeData.steps || [],
        nutrition: recipeData.nutrition || {
            calories: 0,
            protein: '0g',
            fat: '0g',
            carbs: '0g'
        },
        query: recipeData.query || '',
        createdAt: recipeData.createdAt || new Date(),
        id: recipeData.id
    };
};
exports.createRecipe = createRecipe;
//# sourceMappingURL=Recipe.js.map