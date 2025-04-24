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
exports.categorizeRecipe = exports.enhanceRecipeQuality = exports.evaluateRecipeQuality = void 0;
// src/services/qualityService.ts
const openai_1 = require("openai");
const dotenv = __importStar(require("dotenv"));
const logger_1 = require("../utils/logger");
dotenv.config();
// Initialize OpenAI client
const openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// Default GPT model
const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4-1106-preview';
/**
 * Evaluates the quality of a recipe and returns a quality score
 * @param recipe The recipe to evaluate
 * @returns A quality score object
 */
const evaluateRecipeQuality = async (recipe) => {
    try {
        logger_1.logger.info(`Evaluating quality for recipe: ${recipe.title}`);
        const prompt = buildQualityEvaluationPrompt(recipe);
        const response = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: 'system', content: 'You are a professional chef and recipe critic who evaluates recipe quality. Provide honest, thorough evaluations.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: "json_object" },
        });
        const evaluationContent = response.choices[0]?.message?.content;
        if (!evaluationContent) {
            throw new Error('No evaluation content received from OpenAI');
        }
        // Parse the evaluation result
        const evaluation = JSON.parse(evaluationContent);
        // Calculate passing threshold (7.0 out of 10)
        const isPassingThreshold = evaluation.overall >= 7.0;
        return {
            overall: evaluation.overall,
            completeness: evaluation.completeness,
            clarity: evaluation.clarity,
            consistency: evaluation.consistency,
            reasons: evaluation.reasons || [],
            isPassingThreshold
        };
    }
    catch (error) {
        logger_1.logger.error('Error evaluating recipe quality:', error);
        // Return a default failure score
        return {
            overall: 5,
            completeness: 5,
            clarity: 5,
            consistency: 5,
            reasons: ['Error during quality evaluation'],
            isPassingThreshold: false
        };
    }
};
exports.evaluateRecipeQuality = evaluateRecipeQuality;
/**
 * Enhances a recipe that didn't meet quality standards
 * @param recipe The recipe to enhance
 * @param qualityScore The quality score with reasons for improvement
 * @returns An improved version of the recipe
 */
const enhanceRecipeQuality = async (recipe, qualityScore) => {
    try {
        logger_1.logger.info(`Enhancing quality for recipe: ${recipe.title}`);
        const prompt = buildRecipeEnhancementPrompt(recipe, qualityScore);
        const response = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: 'system', content: 'You are a professional chef and recipe editor who improves recipes. Maintain the original recipe intent while enhancing its clarity, completeness, and consistency.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.4,
            max_tokens: 2000,
            response_format: { type: "json_object" },
        });
        const enhancedContent = response.choices[0]?.message?.content;
        if (!enhancedContent) {
            throw new Error('No enhanced content received from OpenAI');
        }
        // Parse the enhanced recipe
        const enhancedRecipe = JSON.parse(enhancedContent);
        // Preserve original recipe ID and some metadata
        enhancedRecipe.id = recipe.id;
        enhancedRecipe.query = recipe.query;
        enhancedRecipe.createdAt = recipe.createdAt;
        // Return the enhanced recipe
        return enhancedRecipe;
    }
    catch (error) {
        logger_1.logger.error('Error enhancing recipe quality:', error);
        // Return the original recipe if enhancement fails
        return recipe;
    }
};
exports.enhanceRecipeQuality = enhanceRecipeQuality;
/**
 * Categorizes a recipe based on its content
 * @param recipe The recipe to categorize
 * @returns Category and tags for the recipe
 */
const categorizeRecipe = async (recipe) => {
    try {
        logger_1.logger.info(`Categorizing recipe: ${recipe.title}`);
        const prompt = buildCategorizationPrompt(recipe);
        const response = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: [
                { role: 'system', content: 'You are a recipe categorization expert. Analyze recipes and determine the most appropriate category and tags.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.2,
            max_tokens: 300,
            response_format: { type: "json_object" },
        });
        const categorizationContent = response.choices[0]?.message?.content;
        if (!categorizationContent) {
            throw new Error('No categorization content received from OpenAI');
        }
        // Parse the categorization result
        const categorization = JSON.parse(categorizationContent);
        return {
            category: categorization.category,
            tags: categorization.tags || []
        };
    }
    catch (error) {
        logger_1.logger.error('Error categorizing recipe:', error);
        // Return a default category if categorization fails
        return {
            category: 'Other',
            tags: []
        };
    }
};
exports.categorizeRecipe = categorizeRecipe;
// Helper function to build a quality evaluation prompt
function buildQualityEvaluationPrompt(recipe) {
    return `
    Please evaluate the quality of the following recipe and provide a detailed assessment.
    
    Recipe Title: ${recipe.title}
    
    Ingredients:
    ${recipe.ingredients.join('\n')}
    
    Steps:
    ${recipe.steps.map((step, idx) => `${idx + 1}. ${step.text}`).join('\n')}
    
    Nutrition Info:
    ${JSON.stringify(recipe.nutrition)}
    
    Please evaluate the recipe based on the following criteria and assign a score from 0-10 for each:
    1. Completeness: Are all necessary ingredients and steps included? Are quantities clear?
    2. Clarity: Are the instructions clear and easy to follow?
    3. Consistency: Do the ingredients match what's used in the steps? Are cooking times and temperatures consistent?
    
    Also provide an overall score from 0-10, and a list of specific reasons for your evaluation.
    
    Return your evaluation as a JSON object with the following structure:
    {
      "completeness": number,
      "clarity": number,
      "consistency": number,
      "overall": number,
      "reasons": string[]
    }
  `;
}
// Helper function to build a recipe enhancement prompt
function buildRecipeEnhancementPrompt(recipe, qualityScore) {
    return `
    Please enhance the following recipe to improve its quality. The recipe received the following quality scores:
    Completeness: ${qualityScore.completeness}/10
    Clarity: ${qualityScore.clarity}/10
    Consistency: ${qualityScore.consistency}/10
    Overall: ${qualityScore.overall}/10
    
    Issues to address:
    ${qualityScore.reasons.join('\n')}
    
    Recipe Title: ${recipe.title}
    
    Ingredients:
    ${recipe.ingredients.join('\n')}
    
    Steps:
    ${recipe.steps.map((step, idx) => `${idx + 1}. ${step.text}`).join('\n')}
    
    Nutrition Info:
    ${JSON.stringify(recipe.nutrition)}
    
    Please return an improved version of this recipe as a JSON object with the same structure as the original recipe. Make all necessary improvements while maintaining the core recipe concept.
    
    The returned JSON should follow the Recipe interface structure and include all fields:
    - title
    - servings
    - ingredients (as string array)
    - steps (with text and illustration fields)
    - nutrition (with calories, protein, fat, carbs)
    - prepTime, cookTime, totalTime (if applicable)
  `;
}
// Helper function to build a recipe categorization prompt
function buildCategorizationPrompt(recipe) {
    return `
    Please categorize the following recipe into one main category and suggest relevant tags.

    Recipe Title: ${recipe.title}
    
    Ingredients:
    ${recipe.ingredients.join('\n')}
    
    Please assign the recipe to ONE of the following categories:
    - Breakfast
    - Lunch
    - Dinner
    - Dessert
    - Appetizer
    - Snack
    - Beverage
    - Bread
    - Salad
    - Soup
    - Main Course
    - Side Dish
    - Vegetarian
    - Seafood
    - Meat
    - Pasta
    - Baking
    - Grill
    - Slow Cooker
    - Quick & Easy
    - Low-Carb
    - Gluten-Free
    - Other
    
    Also provide up to 5 relevant tags for the recipe (e.g., "Italian", "Spicy", "Summer", "High-Protein", etc.)
    
    Return your categorization as a JSON object with the following structure:
    {
      "category": string,
      "tags": string[]
    }
  `;
}
//# sourceMappingURL=qualityService.js.map