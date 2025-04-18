import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';
dotenv.config(); // Load environment variables

import { buildRecipePrompt, buildChatPrompt } from '../utils/promptBuilder';

// --- Use environment variable for API Key ---
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('FATAL ERROR: OPENAI_API_KEY environment variable not set.');
  // In a real app, you might throw or exit
  // throw new Error('OPENAI_API_KEY environment variable not set.');
} else {
    console.log('API Key loaded successfully.');
}

const openai = new OpenAI({ apiKey: apiKey });
// --- End API Key Handling ---

// Check model compatibility with JSON mode, consider 'gpt-4-turbo' if needed
const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4-1106-preview';


/**
 * Generates a complete recipe JSON string using GPT-4.
 */
export const generateRecipeContent = async ( /* ... params ... */
  query: string,
  userPreferences?: { /* ... preferences ... */ }
): Promise<string> => {
  if (!apiKey) throw new Error('OpenAI API key is not configured.');
  try {
    const { systemPrompt, userPrompt } = buildRecipePrompt(query, userPreferences);
    console.log("Sending request to OpenAI for recipe JSON...");
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 3000,
      response_format: { type: "json_object" }, // Already asks for JSON
    });
    console.log("Received response from OpenAI for recipe JSON.");
    const recipeContent = response.choices[0]?.message?.content;
    if (!recipeContent) throw new Error('No recipe content received from OpenAI');
    return recipeContent;
  } catch (error) {
    console.error('Error generating recipe content from OpenAI:', error);
     if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenAI API Error (${error.status}): ${error.message}`);
    }
    throw new Error(`Failed to generate recipe: ${(error as Error).message}`);
  }
};

/**
 * Generates a chat response JSON string using GPT-4.
 */
export const generateChatResponse = async (message: string): Promise<string> => {
   if (!apiKey) throw new Error('OpenAI API key is not configured.');
  try {
    // Build the system and user prompts (now requesting JSON for chat)
    const { systemPrompt, userPrompt } = buildChatPrompt(message);
    console.log("Sending request to OpenAI for chat JSON...");

    const response = await openai.chat.completions.create({
      model: GPT_MODEL, // Use same model or a cheaper chat-focused one if preferred
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7, // Chat can be slightly more creative
      max_tokens: 500, // Chat responses are typically shorter
      top_p: 1,
      frequency_penalty: 0.1, // Minor penalties can improve chat flow
      presence_penalty: 0.1,
      // --- ADDED: Request JSON output format ---
      response_format: { type: "json_object" },
      // --- END ADDITION ---
    });

    console.log("Received response from OpenAI for chat JSON.");
    const chatJsonContent = response.choices[0]?.message?.content;

    if (!chatJsonContent) {
      console.error('OpenAI chat response missing content.');
      throw new Error('No chat content received from OpenAI');
    }
    return chatJsonContent; // Return the JSON string
  } catch (error) {
    console.error('Error generating chat response from OpenAI:', error);
     if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenAI API Error (${error.status}): ${error.message}`);
    }
    throw new Error(`Failed to generate chat response: ${(error as Error).message}`);
  }
};