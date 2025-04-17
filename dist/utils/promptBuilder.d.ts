/**
 * Interface for prompt objects
 */
interface Prompt {
    systemPrompt: string;
    userPrompt: string;
}
/**
 * Builds prompt for recipe generation
 * @param query User's recipe query
 * @param userPreferences Optional user preferences
 * @returns System and user prompts
 */
export declare const buildRecipePrompt: (query: string, userPreferences?: {
    dietaryRestrictions?: string[];
    allergies?: string[];
    favoriteCuisines?: string[];
    cookingSkill?: string;
}) => Prompt;
/**
 * Builds prompt for chat responses
 * @param message User's message
 * @returns System and user prompts
 */
export declare const buildChatPrompt: (message: string) => Prompt;
export {};
