import { OpenAI } from 'openai';
import { NutritionInfo } from '../models/Recipe';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Default GPT model
const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4-1106-preview';

/**
 * Extracts nutritional information for a recipe
 * @param title Recipe title
 * @param ingredients List of ingredients with quantities
 * @returns Structured nutrition information
 */
export const extractNutrition = async (
  title: string, 
  ingredients: string[]
): Promise<NutritionInfo> => {
  try {
    // Build prompt for nutrition extraction
    const prompt = buildNutritionPrompt(title, ingredients);
    
    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        { 
          role: 'system', 
          content: 'You are a nutrition expert. Your task is to estimate the nutritional value of recipes based on their ingredients. Return only a JSON object with numerical calorie values and macronutrients in grams.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });
    
    // Extract and parse the response content
    const nutritionContent = response.choices[0]?.message?.content;
    
    if (!nutritionContent) {
      throw new Error('No nutrition content received from OpenAI');
    }
    
    // Parse the JSON response
    try {
      const nutritionData = JSON.parse(nutritionContent);
      
      // Format and return the nutrition info
      return {
        calories: nutritionData.calories || 0,
        protein: formatMacro(nutritionData.protein),
        fat: formatMacro(nutritionData.fat),
        carbs: formatMacro(nutritionData.carbs)
      };
    } catch (parseError) {
      console.error('Error parsing nutrition data:', parseError);
      // Return default nutrition info if parsing fails
      return getDefaultNutrition();
    }
  } catch (error) {
    console.error('Error extracting nutrition:', error);
    // Return default nutrition info in case of API error
    return getDefaultNutrition();
  }
};

/**
 * Builds the prompt for nutrition extraction
 */
function buildNutritionPrompt(title: string, ingredients: string[]): string {
  return `
    Please estimate the nutritional information per serving for this recipe:
    
    Recipe: ${title}
    
    Ingredients:
    ${ingredients.join('\n')}
    
    Return a JSON object with the following format:
    {
      "calories": [total calories per serving as a number],
      "protein": [protein in grams as a number],
      "fat": [fat in grams as a number],
      "carbs": [carbohydrates in grams as a number]
    }
    
    Don't include any explanation, just return the JSON object.
  `;
}

/**
 * Formats macro values to include "g" unit
 */
function formatMacro(value: number | string | undefined): string {
  if (value === undefined) return '0g';
  
  // Convert to number if it's a string without "g"
  if (typeof value === 'string' && !value.includes('g')) {
    value = parseFloat(value);
  }
  
  // If it's already a string with "g", return it
  if (typeof value === 'string' && value.includes('g')) {
    return value;
  }
  
  // Otherwise format the number and add "g"
  return `${Math.round(Number(value))}g`;
}

/**
 * Returns default nutrition info in case of errors
 */
function getDefaultNutrition(): NutritionInfo {
  return {
    calories: 0,
    protein: '0g',
    fat: '0g',
    carbs: '0g'
  };
}