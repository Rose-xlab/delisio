"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChatMessage = void 0;
const gptService_1 = require("../services/gptService");
/**
 * Handles user chat messages and generates AI responses
 * @param message The user's chat message
 * @returns AI response with suggestion and recipe generation flag
 */
const handleChatMessage = async (message) => {
    try {
        // Analyze if the message is a recipe-related question
        const isRecipeQuery = isRecipeRelatedQuestion(message);
        // Generate chat response using GPT
        const gptResponse = await (0, gptService_1.generateChatResponse)(message);
        // Determine if we can generate a recipe from this query
        const canGenerateRecipe = determineIfCanGenerateRecipe(message, gptResponse);
        // Extract a suggested recipe title if applicable
        const suggestedRecipe = extractSuggestedRecipe(gptResponse);
        // Construct response
        const response = {
            reply: gptResponse,
            can_generate_recipe: canGenerateRecipe
        };
        // Add suggested recipe if present
        if (suggestedRecipe) {
            response.suggested_recipe = suggestedRecipe;
        }
        return response;
    }
    catch (error) {
        console.error('Error in chat handling:', error);
        throw new Error(`Failed to process chat message: ${error.message}`);
    }
};
exports.handleChatMessage = handleChatMessage;
/**
 * Determines if the message is related to recipes or cooking
 */
function isRecipeRelatedQuestion(message) {
    const recipeKeywords = [
        'recipe', 'cook', 'make', 'prepare', 'bake', 'food', 'dish', 'meal',
        'breakfast', 'lunch', 'dinner', 'ingredients', 'instructions'
    ];
    return recipeKeywords.some(keyword => message.toLowerCase().includes(keyword));
}
/**
 * Determines if we can generate a recipe based on the message and response
 */
function determineIfCanGenerateRecipe(message, response) {
    // Check if the user is asking for a specific recipe
    const askingForRecipe = /how (can|do) I (make|cook|prepare|bake)/i.test(message) ||
        /recipe for/i.test(message);
    // Check if the response suggests a dish or recipe
    const suggestingRecipe = /(you could make|try making|how about|you can prepare)/i.test(response);
    return askingForRecipe || suggestingRecipe;
}
/**
 * Extracts suggested recipe title from the GPT response
 */
function extractSuggestedRecipe(response) {
    // Look for specific patterns that suggest a recipe
    const patterns = [
        /you could make (a |an )?([a-zA-Z\s]+)(\.|\?|!|,)/i,
        /how about (a |an )?([a-zA-Z\s]+)(\.|\?|!|,)/i,
        /try (making |cooking |preparing )(a |an )?([a-zA-Z\s]+)(\.|\?|!|,)/i
    ];
    for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match) {
            // Return the matched recipe name, clean up extra spaces
            const recipeName = match[2] || match[3];
            return recipeName.trim();
        }
    }
    return undefined;
}
//# sourceMappingURL=chatControllers.js.map