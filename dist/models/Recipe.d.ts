/**
 * Interface for a recipe step
 */
export interface RecipeStep {
    text: string;
    image_url?: string;
    illustration?: string;
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
export declare const validateRecipe: (recipe: any) => boolean;
/**
 * Creates a recipe object with default values for missing fields
 * @param recipeData Partial recipe data
 * @returns Complete recipe object
 */
export declare const createRecipe: (recipeData: Partial<Recipe>) => Recipe;
