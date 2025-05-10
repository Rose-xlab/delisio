import openai, { OpenAI, GPT_MODEL } from './openaiClient'; // Assuming GPT_MODEL is correctly defined/imported
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
      response_format: { type: "json_object" }, // Already asks for JSON
    });
    logger.info("gptService: Received response from OpenAI for recipe JSON.");
    const recipeContent = response.choices[0]?.message?.content;
    if (!recipeContent) {
        logger.error('gptService: No recipe content received from OpenAI.');
        throw new Error('No recipe content received from OpenAI');
    }

    // Parse the recipe to make sure it's valid JSON
    let parsedRecipe;
    try {
      parsedRecipe = JSON.parse(recipeContent);
    } catch (jsonError) {
      const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      logger.error('gptService: Generated recipe is not valid JSON:', { error: errorMessage, rawResponse: recipeContent, stack: jsonError instanceof Error ? jsonError.stack : undefined });
      throw new Error('Generated recipe is not valid JSON');
    }

    // Assess recipe quality
    const qualityAssessment = await assessRecipeQuality(recipeContent);
    logger.info(`gptService: Recipe quality assessment: ${qualityAssessment.score}/10`);

    // Enhance recipe if quality is below threshold
    let enhancedRecipeContent = recipeContent;
    if (qualityAssessment.score < 7) {
      logger.info("gptService: Recipe quality below threshold. Enhancing recipe...");
      enhancedRecipeContent = await enhanceRecipe(recipeContent, qualityAssessment);
      logger.info("gptService: Recipe enhancement complete.");
    }

    // Categorize the recipe
    const categoryResult = await categorizeRecipe(enhancedRecipeContent);
    logger.info(`gptService: Recipe categorized as: ${categoryResult.category}`);
    logger.info(`gptService: Recipe tags: ${categoryResult.tags.join(', ')}`);

    // Add category, tags, and quality score to the recipe
    try {
      const finalRecipe = JSON.parse(enhancedRecipeContent); // Re-parse if enhanced, otherwise parsedRecipe can be used
      finalRecipe.category = categoryResult.category;
      finalRecipe.tags = categoryResult.tags;
      finalRecipe.quality_score = qualityAssessment.score;

      return JSON.stringify(finalRecipe);
    } catch (jsonError) {
      const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
      logger.error('gptService: Error adding category and tags to recipe:', { error: errorMessage, stack: jsonError instanceof Error ? jsonError.stack : undefined });
      // Return the enhanced recipe without modification if adding category fails
      return enhancedRecipeContent;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('gptService: Error generating recipe content from OpenAI:', { error: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    if (error instanceof OpenAI.APIError) { // More specific OpenAI error check
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
): Promise<string> => { // This function MUST always return a string (JSON string)
  try {
    const { systemPrompt } = buildChatPrompt(message);
    logger.info("gptService: Sending request to OpenAI for chat JSON with conversation history...");

    const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
      { role: 'system', content: systemPrompt }
    ];

    if (messageHistory && messageHistory.length > 0) {
      const limitedHistory = messageHistory.slice(-10);
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
      logger.error('gptService: OpenAI chat response missing content (null or empty).', { message, messageHistory });
      return JSON.stringify({
        reply: "I'm sorry, I couldn't generate a response at this moment as the AI returned empty content. Please try again.",
        suggestions: null,
        error: "AI_RESPONSE_EMPTY_CONTENT" // Technical error code
      });
    }

    // Validate the structure of the JSON content before returning
    try {
      const parsedForCheck = JSON.parse(chatJsonContent);

      if (typeof parsedForCheck.reply !== 'string') {
        logger.error('gptService: OpenAI chat response received, but "reply" field is missing or not a string.', { rawResponse: chatJsonContent, parsedResponse: parsedForCheck });
        return JSON.stringify({
          reply: typeof parsedForCheck.reply === 'undefined'
            ? "I'm sorry, the AI's response was not in the expected format (missing reply). Please try again."
            : `I'm sorry, the AI's reply was not in the expected text format. Please try again. (Received type: ${typeof parsedForCheck.reply})`,
          suggestions: (Array.isArray(parsedForCheck.suggestions) ? parsedForCheck.suggestions : null),
          error: "AI_RESPONSE_INVALID_REPLY_FIELD" // Technical error code
        });
      }

      if (parsedForCheck.suggestions !== null && !Array.isArray(parsedForCheck.suggestions)) {
         logger.warn('gptService: OpenAI chat response "suggestions" field is present but not an array. Correcting to null.', { rawResponse: chatJsonContent });
         parsedForCheck.suggestions = null; // Correcting to null
         return JSON.stringify(parsedForCheck); // Return with corrected suggestions
      }
       // Ensure suggestions, if an array, only contains strings
      if (Array.isArray(parsedForCheck.suggestions)) {
        parsedForCheck.suggestions = parsedForCheck.suggestions.filter((s: any) => typeof s === 'string');
      }


    } catch (e) {
      // This catch is for if chatJsonContent itself is not valid JSON
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error('gptService: OpenAI chat response was not valid JSON and could not be parsed.', {
        error: errorMessage,
        rawResponse: chatJsonContent, // Log the problematic string
        stack: e instanceof Error ? e.stack : undefined
      });
      return JSON.stringify({
        reply: "I'm sorry, I received an invalid response structure from the AI that I couldn't understand. Please try again.",
        suggestions: null,
        error: "AI_RESPONSE_NOT_VALID_JSON" // Technical error code
      });
    }

    // If all checks passed, return the original JSON content string from OpenAI
    // (or the version with corrected suggestions)
    // Re-parse to ensure we send the potentially corrected one
    const finalData = JSON.parse(chatJsonContent);
    if (finalData.suggestions !== null && !Array.isArray(finalData.suggestions)) {
        finalData.suggestions = null;
    }
    if (Array.isArray(finalData.suggestions)) {
        finalData.suggestions = finalData.suggestions.filter((s: any) => typeof s === 'string');
    }

    return JSON.stringify(finalData);

  } catch (error) {
    // This catch is for errors during the OpenAI API call itself (network, OpenAI API errors like auth/rate limits)
    const technicalErrorMessage = error instanceof Error ? error.message : 'Unknown error connecting to AI service';
    logger.error('gptService: Critical error calling OpenAI chat completion API:', {
        error: technicalErrorMessage,
        originalError: error, // Log the original error object for more details
        stack: error instanceof Error ? error.stack : undefined
    });

    let userFacingReply = "I'm sorry, I'm currently unable to connect to the chat service. Please try again in a few moments.";
    let errorCode = "AI_CONNECTION_OR_API_ERROR";

    if (error instanceof OpenAI.APIError) {
        userFacingReply = `I'm sorry, there was an issue with the AI service (Status: ${error.status}, Type: ${error.type}). Please try again.`;
        errorCode = `AI_API_ERROR_S${error.status}_T${error.type}`; // More specific error code
        logger.error(`gptService: OpenAI API Error details:`, {
            status: error.status,
            type: error.type,
            code: error.code,
            param: error.param,
            message: error.message,
            headers: error.headers
        });
    }

    return JSON.stringify({
      reply: userFacingReply,
      suggestions: null,
      error: errorCode
    });
  }
};
