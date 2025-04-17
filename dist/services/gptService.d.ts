/**
 * Generates a complete recipe using GPT-4
 * @param query The user's recipe query
 * @param userPreferences Optional user preferences to personalize recipe
 * @returns Structured recipe data as a string
 */
export declare const generateRecipeContent: (query: string, userPreferences?: {
    dietaryRestrictions?: string[];
    allergies?: string[];
    favoriteCuisines?: string[];
    cookingSkill?: string;
}) => Promise<string>;
/**
 * Generates a chat response using GPT-4
 * @param message The user's message
 * @returns AI response as a string
 */
export declare const generateChatResponse: (message: string) => Promise<string>;
