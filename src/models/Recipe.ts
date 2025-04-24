/**
 * Interface for a recipe step
 */
export interface RecipeStep {
  text: string;
  illustration?: string; // Prompt asks for this specifically
  image_url?: string; // Added after generation/upload - Type is string | undefined
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
  id?: string; // Optional: Added by DB or pre-generated
  title: string;
  servings: number;
  ingredients: string[];
  steps: RecipeStep[];
  nutrition: NutritionInfo;
  query: string;
  createdAt: Date;
  // --- ADDED TIME FIELDS ---
  prepTime?: number;   // Optional prep time in minutes
  cookTime?: number;   // Optional cook time in minutes
  totalTime?: number;  // Optional total time in minutes
  // --- END ADDED FIELDS ---
  // --- ADDED FOR CANCELLATION SUPPORT ---
  requestId?: string;  // To track and cancel generation in progress
  // --- END CANCELLATION FIELD ---

  // --- FIX: ADDED MISSING FIELDS required by controller logic ---
  quality_score?: number;     // Added for quality assessment
  category?: string;          // Added for categorization
  tags?: string[];            // Added for categorization
  similarity_hash?: string;   // Added for duplicate detection
  // --- END ADDED MISSING FIELDS ---
}

/**
 * Validates the basic structure of a parsed recipe object
 * @param recipe Partial recipe object to validate
 * @returns Boolean indicating if the core structure is valid
 */
export const validateRecipe = (recipe: any): boolean => {
  // Check required fields from AI JSON output prompt
  if (
    !recipe || // Check if recipe object itself exists
    typeof recipe.title !== 'string' || recipe.title.trim() === '' ||
    typeof recipe.servings !== 'number' || recipe.servings <= 0 ||
    !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0 ||
    !Array.isArray(recipe.steps) || recipe.steps.length === 0 ||
    typeof recipe.nutrition !== 'object' || recipe.nutrition === null ||
    typeof recipe.nutrition.calories !== 'number' ||
    typeof recipe.nutrition.protein !== 'string' ||
    typeof recipe.nutrition.fat !== 'string' ||
    typeof recipe.nutrition.carbs !== 'string'
  ) {
    console.error('Validation Error: Missing or invalid core required fields (title, servings, ingredients, steps, nutrition).', recipe);
    return false;
  }

  // Check ingredients format (must be strings)
  if (!recipe.ingredients.every((ing: any) => typeof ing === 'string')) {
     console.error('Validation Error: Ingredients array does not contain only strings.', recipe.ingredients);
     return false;
  }

  // Check steps format (must be objects with text and optional illustration strings)
  for (const step of recipe.steps) {
    if (
      typeof step !== 'object' || step === null ||
      typeof step.text !== 'string' || step.text.trim() === '' ||
      (step.illustration !== undefined && typeof step.illustration !== 'string')
      // Do NOT check for image_url here, it's added later
    ) {
       console.error('Validation Error: Invalid step object found.', step);
       return false;
    }
  }

  // Optional: Check optional time fields if they exist
  if (recipe.prepTime !== undefined && typeof recipe.prepTime !== 'number') {
     console.warn('Validation Warning: prepTime exists but is not a number.', recipe.prepTime);
     // Decide if this should cause validation failure? For now, allow it but log.
     // return false;
  }
  if (recipe.cookTime !== undefined && typeof recipe.cookTime !== 'number') {
     console.warn('Validation Warning: cookTime exists but is not a number.', recipe.cookTime);
     // return false;
  }
  if (recipe.totalTime !== undefined && typeof recipe.totalTime !== 'number') {
     console.warn('Validation Warning: totalTime exists but is not a number.', recipe.totalTime);
     // return false;
  }

  // Optional: Check requestId format if present
  if (recipe.requestId !== undefined && typeof recipe.requestId !== 'string') {
     console.warn('Validation Warning: requestId exists but is not a string.', recipe.requestId);
     // Not a critical error, just log it
  }

  return true; // Passed basic validation
};


/**
 * Creates a complete recipe object from partial data, including new time fields
 * @param recipeData Partial recipe data, likely from parsed JSON
 * @returns Complete recipe object with defaults
 */
export const createRecipe = (recipeData: Partial<Recipe>): Recipe => {
  // Helper to ensure nutrition fields have defaults if missing
  const ensureNutrition = (nutri?: Partial<NutritionInfo>): NutritionInfo => ({
     calories: nutri?.calories ?? 0,
     protein: nutri?.protein ?? '0g',
     fat: nutri?.fat ?? '0g',
     carbs: nutri?.carbs ?? '0g',
  });

  return {
    id: recipeData.id, // Might be undefined until saved or pre-generated
    title: recipeData.title || 'Untitled Recipe',
    servings: recipeData.servings || 4,
    ingredients: recipeData.ingredients || [],
    steps: recipeData.steps || [],
    nutrition: ensureNutrition(recipeData.nutrition),
    query: recipeData.query || '',
    createdAt: recipeData.createdAt || new Date(),
    // Assign time fields, default to undefined if not present
    prepTime: recipeData.prepTime,
    cookTime: recipeData.cookTime,
    totalTime: recipeData.totalTime,
    // Assign requestId if present
    requestId: recipeData.requestId,
    // Assign new fields if present in partial data, otherwise undefined
    quality_score: recipeData.quality_score,
    category: recipeData.category,
    tags: recipeData.tags,
    similarity_hash: recipeData.similarity_hash,
  };
};