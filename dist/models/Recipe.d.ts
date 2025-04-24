/**
 * Interface for a recipe step
 */
export interface RecipeStep {
    text: string;
    illustration?: string;
    image_url?: string;
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
    id?: string;
    title: string;
    servings: number;
    ingredients: string[];
    steps: RecipeStep[];
    nutrition: NutritionInfo;
    query: string;
    createdAt: Date;
    prepTime?: number;
    cookTime?: number;
    totalTime?: number;
    requestId?: string;
    quality_score?: number;
    category?: string;
    tags?: string[];
    similarity_hash?: string;
}
/**
 * Validates the basic structure of a parsed recipe object
 * @param recipe Partial recipe object to validate
 * @returns Boolean indicating if the core structure is valid
 */
export declare const validateRecipe: (recipe: any) => boolean;
/**
 * Creates a complete recipe object from partial data, including new time fields
 * @param recipeData Partial recipe data, likely from parsed JSON
 * @returns Complete recipe object with defaults
 */
export declare const createRecipe: (recipeData: Partial<Recipe>) => Recipe;
