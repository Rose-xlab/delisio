import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables directly in this file

import { buildRecipePrompt, buildChatPrompt } from '../utils/promptBuilder';

// For debugging, log the API key (first few characters)
console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
if (process.env.OPENAI_API_KEY) {
  console.log('API Key starts with:', process.env.OPENAI_API_KEY.substring(0, 8) + '...');
}

// Initialize OpenAI client with direct API key for testing
const openai = new OpenAI({
  apiKey: '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'
});

// Default GPT model
const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4-1106-preview';

/**
 * Generates a complete recipe using GPT-4
 * @param query The user's recipe query
 * @param userPreferences Optional user preferences to personalize recipe
 * @returns Structured recipe data as a string
 */
export const generateRecipeContent = async (
  query: string,
  userPreferences?: {
    dietaryRestrictions?: string[],
    allergies?: string[],
    favoriteCuisines?: string[],
    cookingSkill?: string
  }
): Promise<string> => {
  try {
    // Build the system and user prompts, incorporating user preferences
    const { systemPrompt, userPrompt } = buildRecipePrompt(query, userPreferences);
    
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
  } catch (error) {
    console.error('Error generating recipe content:', error);
    throw new Error(`Failed to generate recipe: ${(error as Error).message}`);
  }
};

/**
 * Generates a chat response using GPT-4
 * @param message The user's message
 * @returns AI response as a string
 */
export const generateChatResponse = async (message: string): Promise<string> => {
  try {
    // Build the system and user prompts
    const { systemPrompt, userPrompt } = buildChatPrompt(message);
    
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
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw new Error(`Failed to generate chat response: ${(error as Error).message}`);
  }
};