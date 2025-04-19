import axios from 'axios';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { generateRecipeContent } from '../services/gptService';
import { generateImage } from '../services/dalleService';
import { extractNutrition } from '../services/nutritionService'; // Correctly imported
import { uploadImageToStorage } from '../services/supabaseService';
import { Recipe, RecipeStep, NutritionInfo, validateRecipe } from '../models/Recipe'; // Updated model
import { AppError } from '../middleware/errorMiddleware';

/**
 * Generates a complete recipe including optional time fields and permanent image URLs.
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
  console.log(`Generating recipe for query: "${query}" with preferences:`, userPreferences || 'None');
  const recipeId = uuidv4();
  console.log(`Generated unique ID for recipe: ${recipeId}`);

  try {
    // Step 1: Generate recipe content JSON string
    const gptJsonResponse = await generateRecipeContent(query, userPreferences);
    console.log("Received potential JSON response string from GPT service.");
    // console.log("RAW AI RESPONSE STRING TO PARSE:", gptJsonResponse);

    // Step 2: Parse and Validate JSON
    let parsedRecipeData: Partial<Recipe>;
    try {
        parsedRecipeData = JSON.parse(gptJsonResponse);
        console.log("Successfully parsed JSON response string.");
    } catch (jsonError) { throw new Error('Failed to parse recipe structure from AI response.'); }
    if (!validateRecipe(parsedRecipeData)) { throw new Error('AI response did not match expected recipe structure after parsing.'); }
    console.log(`Parsed recipe title: "${parsedRecipeData.title}", Steps found: ${parsedRecipeData.steps?.length ?? 0}`);
     if (!parsedRecipeData.steps || parsedRecipeData.steps.length === 0) { console.warn('Warning: Parsed recipe data has zero steps.'); }

    // Step 3: Process images sequentially
    let stepsWithImages: RecipeStep[] = [];
    if (parsedRecipeData.steps && parsedRecipeData.steps.length > 0) {
        console.log(`Processing images sequentially for ${parsedRecipeData.steps.length} steps...`);
        for (const [index, step] of parsedRecipeData.steps.entries()) {
            const stepText = step.text || `Step ${index + 1}`;
            const illustrationPrompt = step.illustration || stepText;
            const imagePrompt = `Cartoon-style illustration, clear and simple: ${illustrationPrompt}. Focus on the action for step ${index + 1} of cooking ${parsedRecipeData.title || query}.`;
            let permanentUrl: string | undefined = undefined;
            try {
                console.log(`Requesting temporary image URL for step ${index + 1}...`);
                const tempImageUrl = await generateImage(imagePrompt);
                if (tempImageUrl) {
                    console.log(`Downloading temporary image for step ${index + 1}...`);
                    const imageResponse = await axios.get(tempImageUrl, { responseType: 'arraybuffer' });
                    const imageData: Buffer = Buffer.from(imageResponse.data);
                    console.log(`Uploading image data for step ${index + 1} (${imageData.length} bytes)...`);
                    const filePath = `public/steps/${recipeId}/${index}.png`;
                    permanentUrl = await uploadImageToStorage(imageData, filePath, 'image/png');
                    console.log(`Supabase Storage URL for step ${index + 1}: ${permanentUrl}`);
                } else { console.warn(`No temporary image URL for step ${index + 1}.`); }
            } catch (error) { console.error(`Failed to process image for step ${index + 1}:`, error); }
            stepsWithImages.push({ text: stepText, illustration: illustrationPrompt, image_url: permanentUrl });
        }
        console.log("Finished processing images sequentially.");
    } else { console.log("Skipping image processing as no steps were parsed."); }


    // Step 4: Nutrition Info
    let nutritionInfo: NutritionInfo = { calories: 0, protein: '0g', fat: '0g', carbs: '0g' };
    if (parsedRecipeData.nutrition && typeof parsedRecipeData.nutrition.calories === 'number') {
         console.log("Using nutrition info parsed from AI response.");
         nutritionInfo = { calories: parsedRecipeData.nutrition.calories ?? 0, protein: parsedRecipeData.nutrition.protein?.toString() ?? '0g', fat: parsedRecipeData.nutrition.fat?.toString() ?? '0g', carbs: parsedRecipeData.nutrition.carbs?.toString() ?? '0g', };
    } else {
         console.log("Nutrition info missing or invalid in AI response, trying to extract...");
         try {
              // Now calls the imported function from nutritionService.ts
              nutritionInfo = await extractNutrition( parsedRecipeData.title ?? query, parsedRecipeData.ingredients ?? [] );
              console.log("Extracted nutrition info:", nutritionInfo);
         } catch (nutriError) { console.error("Failed to extract nutrition info:", nutriError); }
    }

    // Step 5: Construct final complete recipe object
    const completeRecipe: Recipe = {
      id: recipeId,
      title: parsedRecipeData.title ?? 'Untitled Recipe',
      servings: parsedRecipeData.servings ?? 4,
      ingredients: parsedRecipeData.ingredients ?? [],
      steps: stepsWithImages,
      nutrition: nutritionInfo,
      query: query,
      createdAt: new Date(),
      prepTime: parsedRecipeData.prepTime,
      cookTime: parsedRecipeData.cookTime,
      totalTime: parsedRecipeData.totalTime,
    };

    console.log(`Successfully constructed complete recipe object for: "${completeRecipe.title}"`);
    return completeRecipe;

  } catch (error) {
    console.error('Error in top-level generateRecipe controller:', error);
    if (error instanceof Error) { throw new Error(`Failed to generate recipe: ${error.message}`); }
    else { throw new Error(`Failed to generate recipe due to an unknown error.`); }
  }
};

// --- DELETED Placeholder for extractNutrition ---
// The commented-out block that was here previously has been removed.