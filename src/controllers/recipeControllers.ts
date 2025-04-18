import { generateRecipeContent } from '../services/gptService';
import { generateImage } from '../services/dalleService';
import { extractNutrition } from '../services/nutritionService'; // Ensure this service exists or handle nutrition differently
import { Recipe, RecipeStep, NutritionInfo, validateRecipe } from '../models/Recipe'; // Import validation
import { AppError } from '../middleware/errorMiddleware'; // Ensure AppError is imported if used

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
  console.log(`Generating recipe for query: "${query}" with preferences:`, userPreferences || 'None');
  try {
    // Step 1: Generate recipe content as a JSON string using GPT-4
    const gptJsonResponse = await generateRecipeContent(query, userPreferences);
    console.log("Received potential JSON response string from GPT service.");

    // --- DEBUGGING LOG (keep for now) ---
    console.log("===================================");
    console.log("RAW AI RESPONSE STRING TO PARSE:");
    console.log(gptJsonResponse);
    console.log("===================================");
    // --- END OF DEBUGGING LOG ---

    // Step 2: Parse the JSON string into a structured object
    let parsedRecipeData: Partial<Recipe>;
    try {
        parsedRecipeData = JSON.parse(gptJsonResponse);
        console.log("Successfully parsed JSON response string.");
    } catch (jsonError) {
        console.error('Error parsing JSON response from OpenAI:', jsonError);
        console.error('Received non-JSON response:', gptJsonResponse);
        throw new Error('Failed to parse recipe structure from AI response.');
    }

    // Step 2.5: Validate the structure
    if (!validateRecipe(parsedRecipeData)) {
        console.error('Parsed JSON data failed validation:', parsedRecipeData);
        throw new Error('AI response did not match expected recipe structure after parsing.');
    }
    console.log(`Parsed recipe title: "${parsedRecipeData.title}", Steps found: ${parsedRecipeData.steps?.length ?? 0}`);

     if (!parsedRecipeData.steps || parsedRecipeData.steps.length === 0) {
         console.warn('Warning: Parsed recipe data has zero steps.');
     }

    // --- REVISED Step 3: Generate images sequentially ---
    let stepsWithImages: RecipeStep[] = [];
    if (parsedRecipeData.steps && parsedRecipeData.steps.length > 0) {
        console.log(`Generating images sequentially for ${parsedRecipeData.steps.length} steps...`);
        // Use a standard for...of loop to process steps one by one
        for (const [index, step] of parsedRecipeData.steps.entries()) {
            // Ensure step has text and illustration description from JSON
            const stepText = step.text || `Step ${index + 1}`;
            // Use illustration text directly from parsed JSON if available, otherwise use step text
            const illustrationPrompt = step.illustration || stepText;

            // Construct a more specific image prompt for DALL-E
            const imagePrompt = `Cartoon-style illustration, clear and simple: ${illustrationPrompt}. Focus on the action for step ${index + 1} of cooking ${parsedRecipeData.title || query}.`;

            try {
                // Use await inside the loop - this makes it sequential
                console.log(`Requesting image for step ${index + 1}...`);
                const imageUrl = await generateImage(imagePrompt);
                console.log(`Image generated successfully for step ${index + 1}`);
                // Add the step with the image URL to the new array
                stepsWithImages.push({ ...step, image_url: imageUrl });
            } catch (error) {
                console.error(`Failed to generate image for step ${index + 1}:`, error);
                // Add the step without image_url if generation fails
                stepsWithImages.push({ ...step, image_url: undefined }); // Explicitly set as undefined
            }
            // Optional: Add a small delay here if you still hit rate limits infrequently (e.g., for burst limits)
            // await new Promise(resolve => setTimeout(resolve, 200)); // e.g., 200ms delay between requests
        }
        console.log("Finished generating images sequentially.");
    } else {
        console.log("Skipping image generation as no steps were parsed.");
    }
    // --- End of REVISED Step 3 ---


    // Step 4: Enhance nutrition information if needed (or use parsed)
    let nutritionInfo: NutritionInfo = { calories: 0, protein: '0g', fat: '0g', carbs: '0g' };
    if (parsedRecipeData.nutrition && typeof parsedRecipeData.nutrition.calories === 'number') {
        console.log("Using nutrition info parsed from AI response.");
        nutritionInfo = {
             calories: parsedRecipeData.nutrition.calories ?? 0,
             protein: parsedRecipeData.nutrition.protein?.toString() ?? '0g',
             fat: parsedRecipeData.nutrition.fat?.toString() ?? '0g',
             carbs: parsedRecipeData.nutrition.carbs?.toString() ?? '0g',
        };
    } else {
        console.log("Nutrition info missing or invalid in AI response, trying to extract...");
        try {
             nutritionInfo = await extractNutrition( parsedRecipeData.title ?? query, parsedRecipeData.ingredients ?? [] );
             console.log("Extracted nutrition info:", nutritionInfo);
        } catch (nutriError) {
             console.error("Failed to extract nutrition info:", nutriError);
             // Keep default zeroed nutrition info
        }
    }

    // Step 5: Construct and return the final complete recipe object
    const completeRecipe: Recipe = {
      title: parsedRecipeData.title ?? 'Untitled Recipe',
      servings: parsedRecipeData.servings ?? 4,
      ingredients: parsedRecipeData.ingredients ?? [],
      steps: stepsWithImages, // Use steps processed sequentially
      nutrition: nutritionInfo,
      query: query,
      createdAt: new Date(),
    };

    console.log(`Successfully constructed complete recipe for: "${completeRecipe.title}"`);
    return completeRecipe;

  } catch (error) {
    console.error('Error in top-level generateRecipe controller:', error);
    if (error instanceof Error) {
        // Re-throw with the specific message
        throw new Error(`Failed to generate recipe: ${error.message}`);
    } else {
        // Handle non-standard errors
        throw new Error(`Failed to generate recipe due to an unknown error.`);
    }
  }
};

// --- Placeholder for extractNutrition ---
// async function extractNutrition(title: string, ingredients: string[]): Promise<NutritionInfo> {
//    console.warn("extractNutrition service not implemented, returning default nutrition.");
//    return { calories: 0, protein: '0g', fat: '0g', carbs: '0g' };
// }