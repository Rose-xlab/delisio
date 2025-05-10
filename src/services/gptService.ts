import openai, { OpenAI, GPT_MODEL } from './openaiClient'; // Assuming GPT_MODEL is correctly defined/imported
import { buildRecipePrompt, buildChatPrompt } from '../utils/promptBuilder';
import { logger } from '../utils/logger'; // Assuming you have a logger utility

/**
 * Interface for a message in the conversation history
 */
interface MessageHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

// Interfaces for Recipe related functions (assessRecipeQuality, categorizeRecipe, enhanceRecipe, generateRecipeContent)
// remain unchanged from your original file. I'm omitting them here for brevity as they are not the focus of the chat issue,
// but they should be present in your actual file.
// ... (Original recipe-related interfaces and functions like assessRecipeQuality, categorizeRecipe, enhanceRecipe, generateRecipeContent)
// Assume they are above this line in your actual file.

/**
 * Generates a chat response JSON string using the configured GPT model.
 * Includes conversation history for context.
 * Attempts to always return a parsable JSON string, even on errors,
 * conforming to { reply: string, suggestions: string[] | null, error?: string }.
 */
export const generateChatResponse = async (
  message: string,
  messageHistory?: MessageHistoryItem[]
): Promise<string> => { // This function must always return a string (JSON string)
  try {
    // Build the system prompt (base prompt without conversation history)
    const { systemPrompt } = buildChatPrompt(message); // Pass current message for context in prompt building if needed
    logger.info("gptService: Sending request to OpenAI for chat JSON with conversation history...");

    // Prepare the messages array for OpenAI with proper typing
    const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
      { role: 'system', content: systemPrompt }
    ];

    if (messageHistory && messageHistory.length > 0) {
      const limitedHistory = messageHistory.slice(-10); // Limit history
      logger.info(`gptService: Including ${limitedHistory.length} previous messages as context`);
      limitedHistory.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      });
    }

    messages.push({ role: 'user', content: message }); // Add current user message

    logger.info(`gptService: Sending ${messages.length} messages to OpenAI for chat.`);

    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: messages,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
      response_format: { type: "json_object" },
    });

    logger.info("gptService: Received response from OpenAI for chat JSON.");
    const chatJsonContent = response.choices[0]?.message?.content;

    if (!chatJsonContent) {
      logger.error('gptService: OpenAI chat response missing content.', { message, messageHistory });
      return JSON.stringify({
        reply: "I'm sorry, I couldn't generate a response at this moment (empty content from AI). Please try again.",
        suggestions: null,
        error: "NO_CONTENT_FROM_AI" // Technical error code
      });
    }

    // Validate the structure of the JSON content before returning
    try {
      const parsedForCheck = JSON.parse(chatJsonContent);
      if (typeof parsedForCheck.reply !== 'string') {
        logger.error('gptService: OpenAI chat response received but reply field is missing or invalid type.', { response: chatJsonContent, message, messageHistory });
        return JSON.stringify({
          // Try to use the AI's reply if it exists, even if it's not a string (it will be stringified), or use a default.
          // This part is tricky; ideally, the AI sticks to the format. If not, a generic apology is safest.
          reply: typeof parsedForCheck.reply === 'undefined' ? "I'm sorry, the AI response was not in the expected format. Please try again." : String(parsedForCheck.reply),
          suggestions: Array.isArray(parsedForCheck.suggestions) ? parsedForCheck.suggestions : null,
          error: "AI_RESPONSE_INVALID_REPLY_FIELD" // Technical error code
        });
      }
      // Optionally, add more checks, e.g., for `suggestions` being null or an array of strings
      if (parsedForCheck.suggestions !== null && !Array.isArray(parsedForCheck.suggestions)) {
         logger.warn('gptService: OpenAI chat response suggestions field is not null and not an array.', { response: chatJsonContent });
         // Decide if this makes the whole response invalid or if you just nullify suggestions
         parsedForCheck.suggestions = null; // Example: Nullify invalid suggestions
         return JSON.stringify(parsedForCheck); // Return with corrected suggestions
      }

    } catch (e) {
      // This catch is for if chatJsonContent itself is not valid JSON
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error('gptService: OpenAI chat response was not valid JSON.', { error: errorMessage, response: chatJsonContent, message, messageHistory });
      return JSON.stringify({
        reply: "I'm sorry, I received an invalid response structure from the AI. Please try again.",
        suggestions: null,
        error: "AI_RESPONSE_NOT_VALID_JSON" // Technical error code
      });
    }

    // If all checks passed, return the original JSON content string from OpenAI
    return chatJsonContent;

  } catch (error) {
    // This catch is for errors during the API call itself (network, OpenAI API errors like auth/rate limits)
    const technicalErrorMessage = error instanceof Error ? error.message : 'Unknown error connecting to AI';
    logger.error('gptService: Error generating chat response from OpenAI:', { error: technicalErrorMessage, message, messageHistory, stack: error instanceof Error ? error.stack : undefined });

    let userFacingReply = "I'm sorry, I'm unable to connect to the chat service right now. Please try again later.";
    let errorCode = "AI_CONNECTION_ERROR";

    if (error instanceof OpenAI.APIError) {
        userFacingReply = `I'm sorry, there was an issue with the AI service (Status: ${error.status}). Please try again.`;
        errorCode = `AI_API_ERROR_${error.status}`;
        logger.error(`gptService: OpenAI API Error`, { status: error.status, type: error.type, code: error.code, param: error.param, message: error.message });
    }

    return JSON.stringify({
      reply: userFacingReply,
      suggestions: null,
      error: errorCode // Technical error code or message
    });
  }
};

// Ensure your recipe generation functions (generateRecipeContent, etc.) are also here,
// unchanged unless they share similar patterns that need hardening.
// For example, if generateRecipeContent also directly returns OpenAI JSON string,
// it might benefit from similar validation steps as added to generateChatResponse.
// ... (Your original generateRecipeContent, assessRecipeQuality, categorizeRecipe, enhanceRecipe functions)
// I'll assume your `generateRecipeContent` and other related functions are here in the original file.
// For instance, your `generateRecipeContent` function:
export const generateRecipeContent = async (
  query: string,
  userPreferences?: { /* ... preferences ... */ }
): Promise<string> => {
  try {
    const { systemPrompt, userPrompt } = buildRecipePrompt(query, userPreferences);
    console.log("Sending request to OpenAI for recipe JSON..."); // Replace with logger.info
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });
    console.log("Received response from OpenAI for recipe JSON."); // Replace with logger.info
    const recipeContent = response.choices[0]?.message?.content;
    if (!recipeContent) throw new Error('No recipe content received from OpenAI');

    // It's good practice to validate this recipeContent JSON structure too,
    // similar to how generateChatResponse was updated, or ensure the calling worker
    // (e.g., recipeWorker) does robust validation.
    // For now, keeping it as per your original structure for this part.
    let parsedRecipe;
    try {
      parsedRecipe = JSON.parse(recipeContent);
    } catch (jsonError) {
      console.error('Recipe is not valid JSON:', jsonError); // Replace with logger.error
      throw new Error('Generated recipe is not valid JSON');
    }

    // Assuming assessRecipeQuality, enhanceRecipe, categorizeRecipe functions are defined
    // and you would call them here as in your original code.
    // For brevity, those calls are omitted but should be part of the flow if they were.
    // This example will just return the initial recipe content after basic parsing.
    // You would re-integrate your quality assessment, enhancement, and categorization here.

    // Example: (Simplified, re-integrate your full logic)
    // const qualityAssessment = await assessRecipeQuality(recipeContent);
    // let enhancedRecipeContent = recipeContent;
    // if (qualityAssessment.score < 7) {
    //   enhancedRecipeContent = await enhanceRecipe(recipeContent, qualityAssessment);
    // }
    // const categoryResult = await categorizeRecipe(enhancedRecipeContent);
    // const finalRecipe = JSON.parse(enhancedRecipeContent);
    // finalRecipe.category = categoryResult.category;
    // finalRecipe.tags = categoryResult.tags;
    // finalRecipe.quality_score = qualityAssessment.score;
    // return JSON.stringify(finalRecipe);

    return recipeContent; // Placeholder: In reality, you'd do more processing like above

  } catch (error) {
    console.error('Error generating recipe content from OpenAI:', error); // Replace with logger.error
    if (error instanceof Error) {
      if ('status' in error && typeof error.status === 'number') {
        throw new Error(`OpenAI API Error (${error.status}): ${error.message}`);
      }
      throw new Error(`Failed to generate recipe: ${error.message}`);
    }
    throw new Error('Failed to generate recipe: Unknown error');
  }
};
// (Include other original functions like assessRecipeQuality, categorizeRecipe, enhanceRecipe)
// Interface for recipe categorization result
interface CategoryResult {
  category: string;
  tags: string[];
  confidence: number;
}

// Interface for recipe quality assessment
interface QualityAssessment {
  score: number; // 0-10 score
  areas: {
    completeness: number; // 0-10 score
    clarity: number; // 0-10 score
    feasibility: number; // 0-10 score
    structure: number; // 0-10 score
  };
  feedback: string[];
}
async function assessRecipeQuality(recipeJson: string): Promise<QualityAssessment> {
  // ... (your original implementation)
  // Replace console.log with logger.info/logger.error
  logger.info("Assessing recipe quality...");
  // ...
  return { score: 7, areas: { completeness: 7, clarity: 7, feasibility: 7, structure: 7 }, feedback: []}; // Placeholder
}
async function categorizeRecipe(recipeJson: string): Promise<CategoryResult> {
  // ... (your original implementation)
  // Replace console.log with logger.info/logger.error
  logger.info("Categorizing recipe...");
  // ...
  return { category: 'other', tags: [], confidence: 0.5 }; // Placeholder
}
async function enhanceRecipe(recipeJson: string, assessment: QualityAssessment): Promise<string> {
  // ... (your original implementation)
  // Replace console.log with logger.info/logger.error
  logger.info("Enhancing recipe...");
  // ...
  return recipeJson; // Placeholder
}