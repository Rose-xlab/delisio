import { generateRecipeContent } from '../services/gptService';
import { generateImage } from '../services/dalleService';
import { extractNutrition } from '../services/nutritionService';
import { parseGptResponse } from '../utils/responseParser';
import { Recipe } from '../models/Recipe';

/**
 * Generates a complete recipe with illustrations based on user query
 * @param query The user's recipe query (e.g., "lasagna", "vegetarian pasta")
 * @param userPreferences Optional user preferences to personalize recipe
 * @returns Complete recipe with ingredients, steps, images, and nutrition
 */
export const generateRecipe = async (
  query: string, 
  userPreferences?: { 
    dietaryRestrictions?: string[], 
    allergies?: string[],
    favoriteCuisines?: string[],
    cookingSkill?: string 
  }
): Promise<Recipe> => {
  try {
    // Step 1: Generate recipe content using GPT-4, incorporating user preferences if available
    const gptResponse = await generateRecipeContent(query, userPreferences);
    
    // Step 2: Parse the GPT response into structured data
    const parsedRecipe = parseGptResponse(gptResponse);
    
    // Step 3: Generate images for each step
    const stepsWithImages = await Promise.all(
      parsedRecipe.steps.map(async (step, index) => {
        const stepDescription = step.text;
        const imagePrompt = `Cartoon-style illustration of ${stepDescription} in a warm, friendly kitchen setting. Step ${index + 1} of cooking ${parsedRecipe.title}.`;
        
        try {
          const imageUrl = await generateImage(imagePrompt);
          return { ...step, image_url: imageUrl };
        } catch (error) {
          console.error(`Failed to generate image for step ${index + 1}:`, error);
          // Return step without image if generation fails
          return step;
        }
      })
    );
    
    // Step 4: Enhance nutrition information if needed
    let nutritionInfo = parsedRecipe.nutrition;
    if (!nutritionInfo || Object.keys(nutritionInfo).length === 0) {
      nutritionInfo = await extractNutrition(parsedRecipe.title, parsedRecipe.ingredients);
    }
    
    // Step 5: Construct and return the final recipe
    const completeRecipe: Recipe = {
      title: parsedRecipe.title,
      servings: parsedRecipe.servings,
      ingredients: parsedRecipe.ingredients,
      steps: stepsWithImages,
      nutrition: nutritionInfo,
      query: query,
      createdAt: new Date()
    };
    
    return completeRecipe;
  } catch (error) {
    console.error('Error in recipe generation:', error);
    throw new Error(`Failed to generate recipe: ${(error as Error).message}`);
  }
};