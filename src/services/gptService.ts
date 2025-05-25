import openai, { OpenAI, GPT_MODEL } from './openaiClient';
import { buildRecipePrompt, buildChatPrompt } from '../utils/promptBuilder';
import { logger } from '../utils/logger'; // Import your logger

/**
 * Interface for a message in the conversation history
 */
interface MessageHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Interface for recipe categorization result
 */
interface CategoryResult {
  category: string;
  tags: string[];
  confidence: number;
}

/**
 * Interface for recipe quality assessment
 */
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

/**
 * Assesses the quality of a recipe
 * @param recipeJson JSON string of the recipe
 * @returns Quality assessment result
 */
async function assessRecipeQuality(recipeJson: string): Promise<QualityAssessment> {
  try {
    logger.info("gptService: Assessing recipe quality...");

    const systemPrompt = `
      You are a professional chef and culinary expert who evaluates recipe quality.
      You will be given a recipe in JSON format, and your job is to assess its quality
      along several dimensions, providing a score from 0-10 for each:

      1. Completeness: Are all necessary ingredients listed? Are quantities clear? Are all steps covered?
      2. Clarity: Are the instructions clear, specific, and easy to follow?
      3. Feasibility: Is the recipe realistic for home cooking? Do the steps make sense?
      4. Structure: Is the recipe well-organized with a logical flow of steps?

      Also provide an overall score from 0-10 and specific feedback points.

      Respond with a JSON object in this format:
      {
        "score": number,
        "areas": {
          "completeness": number,
          "clarity": number,
          "feasibility": number,
          "structure": number
        },
        "feedback": string[]
      }
    `;

    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Assess this recipe:\n${recipeJson}` }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const result = response.choices[0]?.message?.content;

    if (!result) {
      logger.error('gptService: No response received from quality assessment for recipe.');
      throw new Error('No response received from quality assessment');
    }

    return JSON.parse(result) as QualityAssessment;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('gptService: Error assessing recipe quality:', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    // Return a default assessment if there's an error
    return {
      score: 7, // Default to a "good enough" score
      areas: {
        completeness: 7,
        clarity: 7,
        feasibility: 7,
        structure: 7
      },
      feedback: ['Could not perform detailed quality assessment due to an error.']
    };
  }
}

/**
 * Categorizes a recipe based on its content
 * @param recipeJson JSON string of the recipe
 * @returns Category result with primary category and tags
 */
async function categorizeRecipe(recipeJson: string): Promise<CategoryResult> {
  try {
    logger.info("gptService: Categorizing recipe...");

    const systemPrompt = `
      You are a culinary categorization expert. You will be given a recipe in JSON format,
      and your job is to determine the most appropriate category and relevant tags.

      Recipe categories to choose from:
      - breakfast
      - lunch
      - dinner
      - dessert
      - appetizer
      - side-dish
      - salad
      - soup
      - vegetarian
      - vegan
      - gluten-free
      - seafood
      - meat
      - pasta
      - baking
      - slow-cooker
      - quick-easy
      - healthy
      - beverage
      - international

      Also provide up to 5 relevant tags (e.g., "italian", "spicy", "summer", "protein-rich", etc.)

      Respond with a JSON object in this format:
      {
        "category": string,
        "tags": string[],
        "confidence": number (between 0-1)
      }
    `;

    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Categorize this recipe:\n${recipeJson}` }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const result = response.choices[0]?.message?.content;

    if (!result) {
      logger.error('gptService: No response received from recipe categorization.');
      throw new Error('No response received from recipe categorization');
    }

    return JSON.parse(result) as CategoryResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('gptService: Error categorizing recipe:', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    // Return a default category if there's an error
    return {
      category: 'other',
      tags: [],
      confidence: 0.5
    };
  }
}

/**
 * Enhances a recipe based on quality assessment feedback
 * @param recipeJson JSON string of the recipe
 * @param assessment Quality assessment results
 * @returns Enhanced recipe JSON string
 */
async function enhanceRecipe(recipeJson: string, assessment: QualityAssessment): Promise<string> {
  try {
    logger.info("gptService: Enhancing recipe based on quality assessment...");

    // Only enhance if quality score is below 7
    if (assessment.score >= 7) {
      logger.info("gptService: Recipe already meets quality standards. Skipping enhancement.");
      return recipeJson;
    }

    const systemPrompt = `
      You are a professional chef and recipe editor. You will be given a recipe in JSON format
      and feedback on areas for improvement. Your job is to enhance the recipe while maintaining
      its original concept and identity.

      Focus on these improvement areas:
      ${assessment.feedback.map(item => `- ${item}`).join('\n')}

      Do not completely change the recipe, just improve it. Ensure the structure of the JSON
      remains valid and includes all original fields. The structure should match the input exactly.
    `;

    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Enhance this recipe:\n${recipeJson}` }
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const result = response.choices[0]?.message?.content;

    if (!result) {
      logger.error('gptService: No response received from recipe enhancement.');
      throw new Error('No response received from recipe enhancement');
    }

    // Verify the enhanced recipe is still valid JSON
    try {
      JSON.parse(result);
      return result;
    } catch (jsonError) {
      const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      logger.error('gptService: Enhanced recipe is not valid JSON:', { error: errorMessage, stack: jsonError instanceof Error ? jsonError.stack : undefined });
      return recipeJson; // Return original if enhancement produced invalid JSON
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('gptService: Error enhancing recipe:', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    // Return the original recipe if enhancement fails
    return recipeJson;
  }
}

/**
 * Generates a complete recipe JSON string using GPT-4, including categorization and quality assessment.
 */
export const generateRecipeContent = async (
  query: string,
  userPreferences?: { /* ... preferences ... */ }
): Promise<string> => {
  try {
    const { systemPrompt, userPrompt } = buildRecipePrompt(query, userPreferences);
    logger.info("gptService: Sending request to OpenAI for recipe JSON...");
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
    logger.info("gptService: Received response from OpenAI for recipe JSON.");
    const recipeContent = response.choices[0]?.message?.content;
    if (!recipeContent) {
        logger.error('gptService: No recipe content received from OpenAI.');
        throw new Error('No recipe content received from OpenAI');
    }

    let parsedRecipe;
    try {
      parsedRecipe = JSON.parse(recipeContent);
    } catch (jsonError) {
      const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      logger.error('gptService: Generated recipe is not valid JSON:', { error: errorMessage, rawResponse: recipeContent, stack: jsonError instanceof Error ? jsonError.stack : undefined });
      throw new Error('Generated recipe is not valid JSON');
    }

    const qualityAssessment = await assessRecipeQuality(recipeContent);
    logger.info(`gptService: Recipe quality assessment: ${qualityAssessment.score}/10`);

    let enhancedRecipeContent = recipeContent;
    if (qualityAssessment.score < 7) {
      logger.info("gptService: Recipe quality below threshold. Enhancing recipe...");
      enhancedRecipeContent = await enhanceRecipe(recipeContent, qualityAssessment);
      logger.info("gptService: Recipe enhancement complete.");
    }

    const categoryResult = await categorizeRecipe(enhancedRecipeContent);
    logger.info(`gptService: Recipe categorized as: ${categoryResult.category}`);
    logger.info(`gptService: Recipe tags: ${categoryResult.tags.join(', ')}`);

    try {
      const finalRecipe = JSON.parse(enhancedRecipeContent);
      finalRecipe.category = categoryResult.category;
      finalRecipe.tags = categoryResult.tags;
      finalRecipe.quality_score = qualityAssessment.score;

      return JSON.stringify(finalRecipe);
    } catch (jsonError) {
      const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      logger.error('gptService: Error adding category and tags to recipe:', { error: errorMessage, stack: jsonError instanceof Error ? jsonError.stack : undefined });
      return enhancedRecipeContent;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('gptService: Error generating recipe content from OpenAI:', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenAI API Error (Status: ${error.status}, Type: ${error.type}): ${error.message}`);
    }
    throw new Error(`Failed to generate recipe: ${errorMessage}`);
  }
};

/**
 * Generates a chat response JSON string using the configured GPT model.
 * Includes conversation history for context.
 * Attempts to always return a parsable JSON string, even on errors,
 * conforming to { reply: string, suggestions: string[] | null, error?: string }.
 */
export const generateChatResponse = async (
  message: string,
  messageHistory?: MessageHistoryItem[]
): Promise<string> => {
  try {
    const { systemPrompt } = buildChatPrompt(message); // Assuming buildChatPrompt is robust
    logger.info("gptService: Sending request to OpenAI for chat JSON with conversation history...");

    const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
      { role: 'system', content: systemPrompt }
    ];

    if (messageHistory && messageHistory.length > 0) {
      const limitedHistory = messageHistory.slice(-10); // Consider token count if messages are very long
      logger.info(`gptService: Including ${limitedHistory.length} previous messages as context for chat.`);
      limitedHistory.forEach(msg => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      });
    }
    messages.push({ role: 'user', content: message });

    logger.info(`gptService: Sending ${messages.length} messages to OpenAI for chat completion.`);

    const response = await openai.chat.completions.create({
      model: GPT_MODEL, // Ensure this is a model that reliably supports JSON mode (e.g., gpt-3.5-turbo-0125+, gpt-4-turbo-preview)
      messages: messages,
      temperature: 0.7,
      max_tokens: 1024, // MODIFIED: Increased from 500. Adjust based on typical response length and cost
      top_p: 1,
      frequency_penalty: 0.1,
      presence_penalty: 0.1,
      response_format: { type: "json_object" },
    });

    logger.info("gptService: Received response from OpenAI for chat JSON.");
    const chatJsonContent = response.choices[0]?.message?.content;

    if (!chatJsonContent) { // Path 1: No content from OpenAI
      logger.error('gptService: OpenAI chat response missing content (null or empty).', { query: message, historyLength: messageHistory?.length });
      return JSON.stringify({
        reply: "I'm sorry, I couldn't generate a response at this moment as the AI returned empty content. Please try again.",
        suggestions: null,
        error: "AI_RESPONSE_EMPTY_CONTENT"
      });
    }

    // Attempt to parse and validate immediately
    let parsedResponse: any;
    try { // Path 2: chatJsonContent is not valid JSON
      parsedResponse = JSON.parse(chatJsonContent);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error('gptService: OpenAI chat response was not valid JSON and could not be parsed.', {
        error: errorMessage,
        rawResponse: chatJsonContent, // Log the problematic string
        stack: e instanceof Error ? e.stack : undefined
      });
      return JSON.stringify({
        reply: "I'm sorry, I received an invalid response structure from the AI that I couldn't understand. Please try again.",
        suggestions: null,
        error: "AI_RESPONSE_NOT_VALID_JSON"
      });
    }

    // Validate essential fields and structure from the parsedResponse
    const reply = parsedResponse.reply;
    let suggestions = parsedResponse.suggestions;
    // Check if the AI itself reported an error within its valid JSON structure
    const anErrorFromAI = parsedResponse.error as string | undefined;

    // Path 3: 'reply' field invalid (missing, not a string, or empty string)
    if (typeof reply !== 'string' || reply.trim() === "") {
      logger.error('gptService: OpenAI chat response "reply" field is missing, not a string, or empty.', { rawResponse: chatJsonContent, parsedResponse });
      return JSON.stringify({
        reply: (typeof reply === 'undefined' || reply === null)
          ? "I'm sorry, the AI's response was not in the expected format (missing reply). Please try again."
          : "I'm sorry, the AI provided an empty reply. Please try rephrasing your message.", // Specific for empty string reply
        suggestions: (Array.isArray(suggestions) ? suggestions.filter((s: any) => typeof s === 'string') : null), // Attempt to salvage suggestions
        error: anErrorFromAI || "AI_RESPONSE_INVALID_REPLY_FIELD" // Prioritize AI's error if present
      });
    }

    // Path 4 & 4.1: 'suggestions' field validation and cleanup
    if (suggestions !== null && !Array.isArray(suggestions)) {
      logger.warn('gptService: OpenAI chat response "suggestions" field is present but not an array. Correcting to null.', { rawResponse: chatJsonContent, suggestionsValue: suggestions });
      suggestions = null;
    }
    if (Array.isArray(suggestions)) {
      suggestions = suggestions.filter((s: any) => typeof s === 'string');
      if (suggestions.length === 0) { // If filtering results in empty array, make it null for consistency
          suggestions = null;
      }
    }
    
    // Path 5: Success path - reconstruct the object to ensure correct structure and types
    const finalResponseObject: { reply: string; suggestions: string[] | null; error?: string } = {
        reply: reply, // Known to be a non-empty string here
        suggestions: suggestions, // Known to be string[] or null
    };

    // Only include the error field if the AI itself provided one in its valid JSON response
    if (anErrorFromAI) {
        finalResponseObject.error = anErrorFromAI;
    }

    return JSON.stringify(finalResponseObject);

  } catch (error) { // Path 6: Critical error calling OpenAI API itself (network, auth, OpenAI server errors etc.)
    const technicalErrorMessage = error instanceof Error ? error.message : 'Unknown error connecting to AI service';
    logger.error('gptService: Critical error calling OpenAI chat completion API:', {
      error: technicalErrorMessage,
      originalError: error, // Log the original error object for more details
      stack: error instanceof Error ? error.stack : undefined
    });

    let userFacingReply = "I'm sorry, I'm currently unable to connect to the chat service. Please try again in a few moments.";
    let errorCode = "AI_CONNECTION_OR_API_ERROR";

    if (error instanceof OpenAI.APIError) {
        if (error.status === 429) { // Specifically for OpenAI rate limits
            userFacingReply = "The AI service is currently experiencing high demand. Please try again shortly.";
            errorCode = `AI_API_ERROR_RATE_LIMIT_S${error.status}`;
        } else if (error.status === 401) { // OpenAI Auth error
            userFacingReply = "There's an authentication issue with the AI service. Please contact support if this persists.";
            errorCode = `AI_API_ERROR_AUTH_S${error.status}`;
        } else if (error.status === 400) { // Bad request to OpenAI (e.g. prompt issue)
             userFacingReply = "There was an issue processing your request with the AI service. Please try rephrasing.";
             errorCode = `AI_API_ERROR_BAD_REQUEST_S${error.status}`;
        } else { // Other OpenAI API errors
            userFacingReply = `I'm sorry, there was an issue with the AI service (Code: ${error.status || 'N/A'}). Please try again.`;
            errorCode = `AI_API_ERROR_S${error.status}_T${error.type || 'UnknownType'}`;
        }
        logger.error(`gptService: OpenAI API Error details:`, {
            status: error.status,
            type: error.type,
            code: error.code,
            param: error.param,
            message: error.message,
            headers: error.headers // This might be extensive, log selectively if needed
        });
    }

    return JSON.stringify({
      reply: userFacingReply,
      suggestions: null,
      error: errorCode
    });
  }
};