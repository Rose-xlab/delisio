// src/services/gptService.ts

import openai, { OpenAI, GPT_MODEL } from './openaiClient';
import { buildRecipePrompt, buildChatPrompt } from '../utils/promptBuilder';
import { logger } from '../utils/logger';
import { AiChatResponseSchema, AiChatResponse } from '../schemas/chat.schema'; // Import our new schema

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
 * Generates a chat response using the configured GPT model.
 * This function is now the FIRST LINE OF DEFENSE. It ensures the response
 * from OpenAI is parsed and validated against our strict AiChatResponseSchema.
 * It ALWAYS returns a trusted, typed AiChatResponse object.
 *
 * @returns A promise that resolves to a validated AiChatResponse object.
 */
export const generateChatResponse = async (
    message: string,
    messageHistory?: MessageHistoryItem[]
  ): Promise<AiChatResponse> => { // <--- MODIFIED: Return type is now a trusted object
    try {
      const systemPrompt = `
        You are a helpful culinary assistant named Delisio.
        Your primary goal is to assist users with their cooking and recipe needs.
        ALWAYS respond using a JSON object that strictly adheres to the following format.
        Do not include any text, notes, or markdown formatting before or after the JSON object.
  
        The required JSON format is:
        {
          "reply": "Your conversational response to the user goes here. This field is required and must not be empty.",
          "suggestions": ["An optional list", "of short, relevant", "follow-up questions or actions."]
        }
  
        Example: If the user asks for a quick dinner, you might respond with:
        {
          "reply": "A great quick dinner idea is a classic Sheet Pan Lemon Herb Chicken with roasted vegetables! It's delicious and cleanup is a breeze. Would you like the recipe for that?",
          "suggestions": ["Yes, give me the recipe", "Suggest something vegetarian", "How long does it take?"]
        }
      `;
  
      logger.info("gptService: Sending request to OpenAI for chat JSON with conversation history...");
  
      const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
        { role: 'system', content: systemPrompt }
      ];
  
      if (messageHistory && messageHistory.length > 0) {
        const limitedHistory = messageHistory.slice(-10);
        logger.info(`gptService: Including ${limitedHistory.length} previous messages as context for chat.`);
        messages.push(...limitedHistory);
      }
      messages.push({ role: 'user', content: message });
  
      logger.info(`gptService: Sending ${messages.length} messages to OpenAI for chat completion.`);
  
      const response = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      });
  
      logger.info("gptService: Received response from OpenAI for chat JSON.");
      const chatJsonContent = response.choices[0]?.message?.content;
  
      if (!chatJsonContent) {
        logger.error('gptService: OpenAI chat response missing content.');
        return {
          reply: "I'm sorry, I couldn't generate a response as the AI returned empty content. Please try again.",
          suggestions: [],
          error: "AI_RESPONSE_EMPTY_CONTENT"
        };
      }
  
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(chatJsonContent);
      } catch (e) {
        logger.error('gptService: OpenAI response was not valid JSON.', { rawResponse: chatJsonContent });
        return {
          reply: "I'm sorry, I received an invalid response structure from the AI. Please try again.",
          suggestions: [],
          error: "AI_RESPONSE_NOT_VALID_JSON"
        };
      }
  
      const validationResult = AiChatResponseSchema.safeParse(parsedJson);
  
      if (!validationResult.success) {
        logger.error('gptService: OpenAI response FAILED schema validation.', {
          errors: validationResult.error.flatten(),
          receivedData: parsedJson
        });
        // Attempt to salvage the reply if it's just a simple string in the wrong place
        const replyAttempt = (parsedJson as any)?.reply || (parsedJson as any)?.answer || '';
        return {
          reply: `I'm sorry, the AI's response was not in the expected format. Please try again. ${replyAttempt}`,
          suggestions: [],
          error: "AI_RESPONSE_SCHEMA_INVALID"
        };
      }
  
      // Success! We have a valid, trusted object.
      return validationResult.data;
  
    } catch (error) { // This block catches errors with the OpenAI API call itself (network, auth, etc.)
      const technicalErrorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('gptService: Critical error calling OpenAI API:', { error: technicalErrorMessage, originalError: error });
  
      let userFacingReply = "I'm sorry, I'm currently unable to connect to the chat service. Please try again in a few moments.";
      let errorCode = "AI_CONNECTION_OR_API_ERROR";
  
      if (error instanceof OpenAI.APIError) {
        if (error.status === 429) {
            userFacingReply = "The AI service is currently experiencing high demand. Please try again shortly.";
            errorCode = `AI_API_ERROR_RATE_LIMIT_S${error.status}`;
        } else {
            userFacingReply = `I'm sorry, there was an issue with the AI service (Code: ${error.status || 'N/A'}). Please try again.`;
            errorCode = `AI_API_ERROR_S${error.status}_T${error.type || 'UnknownType'}`;
        }
      }
      
      // Return a valid AiChatResponse object even in case of a critical failure
      return {
        reply: userFacingReply,
        suggestions: [],
        error: errorCode
      };
    }
  };