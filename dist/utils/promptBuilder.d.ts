/**
 * Interface for prompt objects
 */
interface Prompt {
    systemPrompt: string;
    userPrompt: string;
}
interface UserPreferencesInput {
    dietaryRestrictions?: string[];
    allergies?: string[];
    favoriteCuisines?: string[];
    cookingSkill?: string;
}
/**
 * Builds prompt for recipe generation, explicitly requesting JSON output.
 * (Includes optional time fields in the Recipe interface definition)
 */
export declare const buildRecipePrompt: (query: string, userPreferences?: UserPreferencesInput) => Prompt;
/**
* Builds prompt for chat responses
* Updated to support conversation continuity and memory
* Enhanced "Something else?" handling to provide new suggestions
*/
export declare const buildChatPrompt: (message: string) => Prompt;
export {};
