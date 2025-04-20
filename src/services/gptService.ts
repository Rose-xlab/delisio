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
 * Interface for a message in the conversation history
 */
interface MessageHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

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
 * Now includes conversation history for context.
 */
export const generateChatResponse = async (
  message: string, 
  messageHistory?: MessageHistoryItem[]
): Promise<string> => {
   if (!apiKey) throw new Error('OpenAI API key is not configured.');
  try {
    // Build the system prompt (base prompt without conversation history)
    const { systemPrompt } = buildChatPrompt("");
    console.log("Sending request to OpenAI for chat JSON with conversation history...");

    // Prepare the messages array for OpenAI with proper typing
    const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
      // Always include the system prompt first
      { role: 'system', content: systemPrompt }
    ];

    // Add message history if provided (limited to reasonable number to avoid token limits)
    if (messageHistory && messageHistory.length > 0) {
      // Limit history to last 10 messages to avoid exceeding token limits
      const limitedHistory = messageHistory.slice(-10);
      console.log(`Including ${limitedHistory.length} previous messages as context`);
      
      // Add each message from history with proper role and type
      limitedHistory.forEach(msg => {
        // Ensure proper typing by using a conditional to narrow the type
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      });
    }

    // Add the current user message
    messages.push({ role: 'user', content: message });

    // Log the message structure (for debugging)
    console.log(`Sending ${messages.length} messages to OpenAI (1 system + ${messages.length - 1} conversation messages)`);

    // Make the API call with the full conversation history
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: messages,
      temperature: 0.7, // Chat can be slightly more creative
      max_tokens: 500, // Chat responses are typically shorter
      top_p: 1,
      frequency_penalty: 0.1, // Minor penalties can improve chat flow
      presence_penalty: 0.1,
      response_format: { type: "json_object" },
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