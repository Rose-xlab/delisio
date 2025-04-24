"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChatResponse = exports.generateRecipeContent = void 0;
// src/services/gptService.ts
const openai_1 = require("openai");
const dotenv = __importStar(require("dotenv"));
dotenv.config(); // Load environment variables
const promptBuilder_1 = require("../utils/promptBuilder");
// --- Use environment variable for API Key ---
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error('FATAL ERROR: OPENAI_API_KEY environment variable not set.');
    // In a real app, you might throw or exit
    // throw new Error('OPENAI_API_KEY environment variable not set.');
}
else {
    console.log('API Key loaded successfully.');
}
const openai = new openai_1.OpenAI({ apiKey: apiKey });
// --- End API Key Handling ---
// Check model compatibility with JSON mode, consider 'gpt-4-turbo' if needed
const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4-1106-preview';
/**
 * Assesses the quality of a recipe
 * @param recipeJson JSON string of the recipe
 * @returns Quality assessment result
 */
async function assessRecipeQuality(recipeJson) {
    try {
        console.log("Assessing recipe quality...");
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
            throw new Error('No response received from quality assessment');
        }
        return JSON.parse(result);
    }
    catch (error) {
        console.error('Error assessing recipe quality:', error);
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
async function categorizeRecipe(recipeJson) {
    try {
        console.log("Categorizing recipe...");
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
            throw new Error('No response received from recipe categorization');
        }
        return JSON.parse(result);
    }
    catch (error) {
        console.error('Error categorizing recipe:', error);
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
async function enhanceRecipe(recipeJson, assessment) {
    try {
        console.log("Enhancing recipe based on quality assessment...");
        // Only enhance if quality score is below 7
        if (assessment.score >= 7) {
            console.log("Recipe already meets quality standards. Skipping enhancement.");
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
            throw new Error('No response received from recipe enhancement');
        }
        // Verify the enhanced recipe is still valid JSON
        try {
            JSON.parse(result);
            return result;
        }
        catch (jsonError) {
            console.error('Enhanced recipe is not valid JSON:', jsonError);
            return recipeJson; // Return original if enhancement produced invalid JSON
        }
    }
    catch (error) {
        console.error('Error enhancing recipe:', error);
        // Return the original recipe if enhancement fails
        return recipeJson;
    }
}
/**
 * Generates a complete recipe JSON string using GPT-4, including categorization and quality assessment.
 */
const generateRecipeContent = async (query, userPreferences) => {
    if (!apiKey)
        throw new Error('OpenAI API key is not configured.');
    try {
        const { systemPrompt, userPrompt } = (0, promptBuilder_1.buildRecipePrompt)(query, userPreferences);
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
        if (!recipeContent)
            throw new Error('No recipe content received from OpenAI');
        // Parse the recipe to make sure it's valid JSON
        let parsedRecipe;
        try {
            parsedRecipe = JSON.parse(recipeContent);
        }
        catch (jsonError) {
            console.error('Recipe is not valid JSON:', jsonError);
            throw new Error('Generated recipe is not valid JSON');
        }
        // Assess recipe quality
        const qualityAssessment = await assessRecipeQuality(recipeContent);
        console.log(`Recipe quality assessment: ${qualityAssessment.score}/10`);
        // Enhance recipe if quality is below threshold
        let enhancedRecipeContent = recipeContent;
        if (qualityAssessment.score < 7) {
            console.log("Recipe quality below threshold. Enhancing recipe...");
            enhancedRecipeContent = await enhanceRecipe(recipeContent, qualityAssessment);
            console.log("Recipe enhancement complete.");
        }
        // Categorize the recipe
        const categoryResult = await categorizeRecipe(enhancedRecipeContent);
        console.log(`Recipe categorized as: ${categoryResult.category}`);
        console.log(`Recipe tags: ${categoryResult.tags.join(', ')}`);
        // Add category, tags, and quality score to the recipe
        try {
            const finalRecipe = JSON.parse(enhancedRecipeContent);
            finalRecipe.category = categoryResult.category;
            finalRecipe.tags = categoryResult.tags;
            finalRecipe.quality_score = qualityAssessment.score;
            // Return the final enhanced recipe as a JSON string
            return JSON.stringify(finalRecipe);
        }
        catch (jsonError) {
            console.error('Error adding category and tags to recipe:', jsonError);
            // Return the enhanced recipe without modification if adding category fails
            return enhancedRecipeContent;
        }
    }
    catch (error) {
        console.error('Error generating recipe content from OpenAI:', error);
        if (error instanceof openai_1.OpenAI.APIError) {
            throw new Error(`OpenAI API Error (${error.status}): ${error.message}`);
        }
        throw new Error(`Failed to generate recipe: ${error.message}`);
    }
};
exports.generateRecipeContent = generateRecipeContent;
/**
 * Generates a chat response JSON string using GPT-4.
 * Now includes conversation history for context.
 */
const generateChatResponse = async (message, messageHistory) => {
    if (!apiKey)
        throw new Error('OpenAI API key is not configured.');
    try {
        // Build the system prompt (base prompt without conversation history)
        const { systemPrompt } = (0, promptBuilder_1.buildChatPrompt)("");
        console.log("Sending request to OpenAI for chat JSON with conversation history...");
        // Prepare the messages array for OpenAI with proper typing
        const messages = [
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
    }
    catch (error) {
        console.error('Error generating chat response from OpenAI:', error);
        if (error instanceof openai_1.OpenAI.APIError) {
            throw new Error(`OpenAI API Error (${error.status}): ${error.message}`);
        }
        throw new Error(`Failed to generate chat response: ${error.message}`);
    }
};
exports.generateChatResponse = generateChatResponse;
//# sourceMappingURL=gptService.js.map