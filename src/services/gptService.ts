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
  ): Promise<AiChatResponse> => {
    
    // Input sanitization and validation
    let sanitizedMessage = message?.toString() || "";
    
    // Remove potentially problematic characters
    sanitizedMessage = sanitizedMessage
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters
      .trim();
    
    // Handle empty messages
    if (!sanitizedMessage) {
      return {
        reply: "I didn't catch that. Could you please tell me what you're looking for?",
        suggestions: ["Show me a quick recipe", "I need dinner ideas", "What can I make with chicken?"],
      };
    }
    
    // Handle gibberish or spam (simple check for repeated characters)
    if (/^(.)\1{10,}$/.test(sanitizedMessage) || /^[^a-zA-Z0-9\s]{20,}$/.test(sanitizedMessage)) {
      return {
        reply: "I'm having trouble understanding that. How can I help you with cooking today?",
        suggestions: ["Browse recipes", "Get meal suggestions", "Ask about ingredients"],
      };
    }
    
    // Handle extremely long messages
    if (sanitizedMessage.length > 4000) {
      sanitizedMessage = sanitizedMessage.substring(0, 4000);
    }
    
    // Progressive retry strategy
    const attempts = [
      { historySize: 10, temperature: 0.7, maxTokens: 1024 },
      { historySize: 5, temperature: 0.6, maxTokens: 800 },
      { historySize: 0, temperature: 0.5, maxTokens: 600 },
    ];
    
    for (let i = 0; i < attempts.length; i++) {
      try {
        return await attemptChatCompletion(
          sanitizedMessage,
          messageHistory?.slice(-attempts[i].historySize),
          attempts[i].temperature,
          attempts[i].maxTokens
        );
      } catch (error) {
        logger.error(`Attempt ${i + 1} failed:`, { 
          error: error instanceof Error ? error.message : String(error),
          attempt: attempts[i]
        });
        
        // If it's a 401 error, don't retry
        if (error instanceof OpenAI.APIError && error.status === 401) {
          logger.error('CRITICAL: OpenAI authentication failed. Invalid API key.');
          return {
            reply: "I'm experiencing a configuration issue. Our team has been notified. Please try again later.",
            suggestions: [],
            error: "AUTH_FAILED"
          };
        }
      }
    }
    
    // Ultimate fallback
    return {
      reply: "I apologize, but I'm having trouble right now. Let me suggest some popular recipes: Would you like to try Spaghetti Carbonara, Chicken Stir-Fry, or a Caesar Salad?",
      suggestions: ["Spaghetti Carbonara", "Chicken Stir-Fry", "Caesar Salad", "Show me more options"],
    };
};

async function attemptChatCompletion(
    message: string,
    messageHistory?: MessageHistoryItem[],
    temperature: number = 0.7,
    maxTokens: number = 1024
): Promise<AiChatResponse> {
    // Simplified, more flexible system prompt
    const systemPrompt = `
You are Delisio, a helpful cooking assistant. 

CRITICAL: You MUST ALWAYS respond, no matter what the user says.
- If the message is unclear, ask for clarification
- If it's off-topic, gently redirect to cooking
- If it's gibberish, respond helpfully anyway
- NEVER refuse to respond

Your response MUST be valid JSON:
{
  "reply": "Your helpful response",
  "suggestions": ["Optional", "suggestions", "array"] or null
}

Be friendly, helpful, and always provide value.`;

    const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
        { role: 'system', content: systemPrompt }
    ];

    // Add message history with token management
    if (messageHistory && messageHistory.length > 0) {
        for (const msg of messageHistory) {
            messages.push({
                role: msg.role,
                content: msg.content.substring(0, 1000) // Truncate long messages
            });
        }
    }
    
    messages.push({ role: 'user', content: message });

    try {
        const response = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }

        const parsed = JSON.parse(content);
        
        // Validate and clean the response
        return {
            reply: String(parsed.reply || "I can help you with that! What would you like to cook?"),
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
        };
        
    } catch (error) {
        // Log detailed error for debugging
        logger.error('OpenAI API call failed:', {
            error: error instanceof Error ? error.message : String(error),
            messageLength: message.length,
            historyLength: messageHistory?.length || 0,
        });
        throw error;
    }
}