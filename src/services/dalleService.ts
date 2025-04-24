// src/services/dalleService.ts
import openai, { OpenAI, DALLE_MODEL } from './openaiClient';

// Tiered configuration options
const TIER_CONFIG = {
  free: {
    size: '1024x1024',
    quality: 'standard',
    style: 'natural',
    enhancementLevel: 'minimal'
  },
  basic: {
    size: '1024x1024', // Still reasonable size but not the largest
    quality: 'standard', // Save costs with standard quality
    style: 'natural',
    enhancementLevel: 'moderate'
  },
  premium: {
    size: '1792x1024', // Largest size for premium users
    quality: 'hd', // HD only for premium
    style: 'natural',
    enhancementLevel: 'full'
  }
};

/**
 * Helper function to check if prompt is likely describing a recipe step
 * @param prompt The user prompt
 * @returns Boolean indicating if this appears to be a recipe step
 */
function isRecipeStep(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  return lowerPrompt.includes('recipe') || 
         lowerPrompt.includes('step') ||
         lowerPrompt.includes('cooking') ||
         lowerPrompt.includes('prepare') ||
         lowerPrompt.includes('mix') ||
         lowerPrompt.includes('chop') ||
         lowerPrompt.includes('bake') ||
         lowerPrompt.includes('cook');
}

/**
 * Generates an image using DALL-E 3 with quality based on subscription tier
 * @param prompt The text description for image generation
 * @param subscriptionTier The user's subscription tier (free, basic, premium)
 * @param options Optional configuration to override tier defaults
 * @returns URL of the generated image
 */
export const generateImage = async (
  prompt: string, 
  subscriptionTier: 'free' | 'basic' | 'premium' = 'free',
  options?: {
    enhancePrompt?: boolean,
    forceHighQuality?: boolean,
    customStyle?: 'natural' | 'vivid'
  }
): Promise<string> => {
  try {
    // Get tier configuration
    const tierConfig = TIER_CONFIG[subscriptionTier];
    
    // Determine if prompt enhancement should be used
    const shouldEnhancePrompt = options?.enhancePrompt !== undefined 
      ? options.enhancePrompt 
      : tierConfig.enhancementLevel !== 'minimal';
    
    // Process the prompt according to enhancement level and identify if it's a recipe step
    const processedPrompt = shouldEnhancePrompt 
      ? enhancePrompt(prompt, tierConfig.enhancementLevel)
      : prompt.trim() + (isRecipeStep(prompt) ? "\nIMPORTANT: The image should clearly show and communicate this specific recipe step." : "");
    
    // Set image quality based on tier config with potential override
    const imageSize = options?.forceHighQuality ? '1792x1024' : tierConfig.size;
    const imageQuality = options?.forceHighQuality ? 'hd' : tierConfig.quality;
    const imageStyle = options?.customStyle || tierConfig.style;

    // Log generation details (trimmed for brevity)
    console.log(`Generating image with prompt: ${processedPrompt.substring(0, 50)}...`);
    console.log(`Using: size=${imageSize}, quality=${imageQuality}, tier=${subscriptionTier}`);

    const response = await openai.images.generate({
      model: DALLE_MODEL,
      prompt: processedPrompt,
      n: 1,
      size: imageSize as '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792',
      quality: imageQuality as 'standard' | 'hd', 
      style: imageStyle as 'natural' | 'vivid',
      response_format: 'url',
    });

    const imageUrl = response.data[0]?.url;

    if (!imageUrl) {
      throw new Error('No image URL received from DALL-E');
    }

    return imageUrl;
  } catch (error) {
    console.error('Error generating image:', error);
    if (error instanceof Error) {
      // Check if it's an OpenAI API error by checking for status property
      if ('status' in error && typeof error.status === 'number') {
        throw new Error(`OpenAI API Error: ${error.message}`);
      }
      throw new Error(`Failed to generate image: ${error.message}`);
    }
    throw new Error(`Failed to generate image: ${(error as Error).message}`);
  }
};

/**
 * Enhances the prompt based on specified enhancement level
 * Emphasizes showing recipe steps clearly and accurately
 * @param basePrompt The original user prompt
 * @param level The enhancement level (minimal, moderate, full)
 * @returns Enhanced prompt
 */
function enhancePrompt(basePrompt: string, level: string): string {
  const trimmed = basePrompt.trim();
  
  // Handle illustration tag if present
  const startsWithIllustration = trimmed.toLowerCase().startsWith('illustration:');
  const promptBody = startsWithIllustration
    ? trimmed.substring("illustration:".length).trim()
    : trimmed;

  // Check if this is a recipe step
  const isRecipeStep = promptBody.toLowerCase().includes('recipe') || 
                       promptBody.toLowerCase().includes('step') ||
                       promptBody.toLowerCase().includes('cooking') ||
                       promptBody.toLowerCase().includes('prepare');
  
  // Recipe step emphasis to add to all prompts
  const recipeStepEmphasis = isRecipeStep ? 
    "IMPORTANT: The image should clearly show and communicate this specific recipe step in action. Focus on the technique, ingredients, and visual cues that indicate this exact stage of preparation. The image should be instructional and show the process clearly." : "";

  // For minimal enhancement, just ensure the prompt is clean
  if (level === 'minimal') {
    return `Food photography of ${promptBody}. No text, watermarks, or people. ${recipeStepEmphasis}`;
  }
  
  // For moderate enhancement, add some photography details but keep it brief
  if (level === 'moderate') {
    return `Professional food photography of ${promptBody}. Shot with good lighting and composition. 
No text, watermarks, or people. High-quality, appetizing presentation. ${recipeStepEmphasis}`;
  }
  
  // For full enhancement (premium tier), use detailed photography specifications
  // But still more concise than the original
  return `Award-winning food photography of ${promptBody}. Shot with professional camera and lighting.
Perfect composition with beautiful food styling. Rich colors and textures with pleasing bokeh background.
High-end presentation on elegant tableware. NO text, watermarks, human faces, hands or people. 
${recipeStepEmphasis}`;
}