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
export const buildRecipePrompt = (
    query: string,
    userPreferences?: {
        dietaryRestrictions?: string[],
        allergies?: string[],
        favoriteCuisines?: string[],
        cookingSkill?: string
    }
): Prompt => {
    const systemPrompt = `
        You are an expert chef and cooking instructor with a talent for creating easy-to-follow recipes.
        Your task is to generate a complete recipe based on the user's request.

        The recipe should include:
        1. A title
        2. Number of servings
        3. A complete list of ingredients with precise measurements
        4. Step-by-step instructions, starting from preparation and ending with serving.
           Each step should describe a clear visual scene that could be illustrated, such as what the person is doing, ingredients visible, tools used, and setting.
        5. Estimated nutritional information per serving (calories, protein, fat, carbohydrates)

        Format your response to be easily parseable with clear sections for:
        - TITLE: [Recipe Title]
        - SERVINGS: [Number]
        - INGREDIENTS: [List each on a new line with measurements]
        - STEPS: [Number each step and provide clear instructions. For each step, append a new line beginning with 'ILLUSTRATION:' and describe how the step could be visualized.]
        - NUTRITION: [Include calories, protein, fat, carbs per serving]

        Make the recipe suitable for home cooks with basic equipment.
        Be precise with measurements and cooking times.
        Each step should be concise and focus on one action or group of related actions.
        ${userPreferences ? generatePreferencesString(userPreferences) : ''}
    `;

    const userPrompt = userPreferences
        ? `Please create a recipe for ${query}. Make it detailed but easy to follow, keeping in mind my preferences and restrictions.`
        : `Please create a recipe for ${query}. Make it detailed but easy to follow.`;

    return { systemPrompt, userPrompt };
};

/**
 * Generates a string with user preferences for the system prompt
 */
function generatePreferencesString(userPreferences: {
    dietaryRestrictions?: string[],
    allergies?: string[],
    favoriteCuisines?: string[],
    cookingSkill?: string
}): string {
    let preferencesString = '\n\nImportant user preferences to consider:';

    // Add dietary restrictions if available
    if (userPreferences.dietaryRestrictions && userPreferences.dietaryRestrictions.length > 0) {
        preferencesString += `\n- Dietary restrictions: ${userPreferences.dietaryRestrictions.join(', ')}.`;
        preferencesString += '\n  Ensure the recipe completely avoids ingredients that violate these restrictions.';
    }

    // Add allergies if available
    if (userPreferences.allergies && userPreferences.allergies.length > 0) {
        preferencesString += `\n- Allergies: ${userPreferences.allergies.join(', ')}.`;
        preferencesString += '\n  Do not include these ingredients in any form and suggest alternatives if relevant.';
    }

    // Add favorite cuisines if available
    if (userPreferences.favoriteCuisines && userPreferences.favoriteCuisines.length > 0) {
        preferencesString += `\n- Favorite cuisines: ${userPreferences.favoriteCuisines.join(', ')}.`;
        preferencesString += '\n  If appropriate, incorporate elements from these cuisines.';
    }

    // Add cooking skill level if available
    if (userPreferences.cookingSkill) {
        preferencesString += `\n- Cooking skill level: ${userPreferences.cookingSkill}.`;

        if (userPreferences.cookingSkill === 'beginner') {
            preferencesString += '\n  Keep techniques simple and explain basic steps. Avoid complex methods.';
        } else if (userPreferences.cookingSkill === 'intermediate') {
            preferencesString += '\n  Can include some moderate techniques but explain any potentially unfamiliar steps.';
        } else if (userPreferences.cookingSkill === 'advanced') {
            preferencesString += '\n  Can include more complex techniques and assume a good knowledge of cooking methods.';
        }
    }

    return preferencesString;
}

/**
 * Builds prompt for chat responses
 * @param message User's message
 * @returns System and user prompts
 */
export const buildChatPrompt = (message: string): Prompt => {
    const systemPrompt = `
        You are a friendly and helpful cooking assistant. You specialize in answering questions about:
        - Cooking techniques and methods
        - Ingredient substitutions and pairings
        - Recipe suggestions based on available ingredients
        - Kitchen tips and tricks
        - Dietary advice related to cooking

        Keep your responses conversational, warm, and encouraging. If the user asks about making a specific dish,
        offer a brief suggestion and ask if they would like a complete recipe.

        If the user mentions specific ingredients they have available, suggest dishes they could make with those ingredients.

        Always be positive and supportive, especially to beginners. Avoid being judgmental about cooking choices.

        When appropriate, let the user know that you can generate complete illustrated recipes if they're interested.
    `;

    const userPrompt = message;

    return { systemPrompt, userPrompt };
};
