"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChatResponse = exports.generateRecipeContent = void 0;
const openai_1 = __importDefault(require("openai"));
const promptBuilder_1 = require("../utils/promptBuilder");
// Initialize OpenAI client
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
// Default GPT model
const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4-1106-preview';
/**
 * Generates a complete recipe using GPT-4
 * @param query The user's recipe query
 * @param userPreferences Optional user preferences to personalize recipe
 * @returns Structured recipe data as a string
 */
const generateRecipeContent = async (query, userPreferences) => {
    try {
        // Build the system and user prompts, incorporating user preferences
        const { systemPrompt, userPrompt } = (0, promptBuilder_1.buildRecipePrompt)(query, userPreferences);
        // Call the OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });
        // Extract and return the response content
        const recipeContent = response.choices[0]?.message?.content;
        if (!recipeContent) {
            throw new Error('No recipe content received from OpenAI');
        }
        return recipeContent;
    }
    catch (error) {
        console.error('Error generating recipe content:', error);
        throw new Error(`Failed to generate recipe: ${error.message}`);
    }
};
exports.generateRecipeContent = generateRecipeContent;
/**
 * Generates a chat response using GPT-4
 * @param message The user's message
 * @returns AI response as a string
 */
const generateChatResponse = async (message) => {
    try {
        // Build the system and user prompts
        const { systemPrompt, userPrompt } = (0, promptBuilder_1.buildChatPrompt)(message);
        // Call the OpenAI API
        const response = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.8,
            max_tokens: 500,
            top_p: 1,
            frequency_penalty: 0.2,
            presence_penalty: 0.2,
        });
        // Extract and return the response content
        const chatContent = response.choices[0]?.message?.content;
        if (!chatContent) {
            throw new Error('No chat content received from OpenAI');
        }
        return chatContent;
    }
    catch (error) {
        console.error('Error generating chat response:', error);
        throw new Error(`Failed to generate chat response: ${error.message}`);
    }
};
exports.generateChatResponse = generateChatResponse;
//# sourceMappingURL=gptService.js.map