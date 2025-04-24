export interface RecipeCategory {
    id: string;
    name: string;
    description: string;
    keyIngredients?: string[];
    keyTerms?: string[];
}
export declare const recipeCategories: RecipeCategory[];
/**
 * Detect which category a recipe belongs to based on its title, ingredients, and content
 * @param title Recipe title
 * @param ingredients List of ingredients
 * @param steps Recipe preparation steps as text
 * @returns Most likely category ID
 */
export declare function detectRecipeCategory(title: string, ingredients: string[], steps: string[]): string;
/**
 * Get related categories that might also apply to a recipe
 * @param primaryCategory Primary category ID
 * @param title Recipe title
 * @param ingredients List of ingredients
 * @returns Array of related category IDs (up to 3)
 */
export declare function getRelatedCategories(primaryCategory: string, title: string, ingredients: string[]): string[];
