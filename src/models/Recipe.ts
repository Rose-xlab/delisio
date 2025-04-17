/**
 * Interface for a recipe step
 */
export interface RecipeStep {
  text: string;
  image_url?: string;
  illustration?: string; // <-- ADDED THIS LINE
}

/**
 * Interface for nutrition information
 */
export interface NutritionInfo {
  calories: number;
  protein: string;
  fat: string;
  carbs: string;
}

/**
 * Interface for a complete recipe
 */
export interface Recipe {
  title: string;
  servings: number;
  ingredients: string[];
  steps: RecipeStep[];
  nutrition: NutritionInfo;
  query: string;
  createdAt: Date;
  id?: string;
}

/**
 * Validates a recipe object
 * @param recipe Recipe object to validate
 * @returns Boolean indicating if recipe is valid
 */
export const validateRecipe = (recipe: any): boolean => {
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

/**
 * Creates a recipe object with default values for missing fields
 * @param recipeData Partial recipe data
 * @returns Complete recipe object
 */
export const createRecipe = (recipeData: Partial<Recipe>): Recipe => {
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