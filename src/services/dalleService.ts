import openai, { OpenAI, DALLE_MODEL } from './openaiClient';
import { logger } from '../utils/logger'; // Assuming you have a logger utility

// Tiered configuration options
const TIER_CONFIG = {
  free: {
    size: '1792x1024', // Changed from '1024x1024' to premium's size
    quality: 'hd',       // Changed from 'standard' to premium's quality
    style: 'natural',
    enhancementLevel: 'full' // Changed from 'minimal' to match premium's potential for better results with HD
  },
  basic: {
    size: '1024x1024',
    quality: 'standard',
    style: 'natural',
    enhancementLevel: 'moderate'
  },
  premium: {
    size: '1792x1024',
    quality: 'hd',
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
 * Generates an image using DALL-E with quality based on subscription tier
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
    forceHighQuality?: boolean, // This option can still be used to force HD if other tiers were different
    customStyle?: 'natural' | 'vivid'
  }
): Promise<string> => {
  try {
    // Get tier configuration
    // If an invalid tier is passed, default to 'free' tier settings
    const currentTier = TIER_CONFIG[subscriptionTier] ? subscriptionTier : 'free';
    const tierConfig = TIER_CONFIG[currentTier];

    logger.info(`dalleService: Image generation request for tier: ${currentTier}. Original prompt (first 50 chars): "${prompt.substring(0,50)}"`);

    // Determine if prompt enhancement should be used
    const shouldEnhancePrompt = options?.enhancePrompt !== undefined
      ? options.enhancePrompt
      : tierConfig.enhancementLevel !== 'minimal';

    // Process the prompt according to enhancement level and identify if it's a recipe step
    const processedPrompt = shouldEnhancePrompt
      ? enhancePrompt(prompt, tierConfig.enhancementLevel)
      : prompt.trim() + (isRecipeStep(prompt) ? "\nIMPORTANT: The image should clearly show and communicate this specific recipe step." : "");

    // Set image size and quality based on tier config, with potential override from options
    // If forceHighQuality is true, it uses premium settings.
    const imageSize = options?.forceHighQuality ? TIER_CONFIG.premium.size : tierConfig.size;
    const imageQuality = options?.forceHighQuality ? TIER_CONFIG.premium.quality : tierConfig.quality;
    const imageStyle = options?.customStyle || tierConfig.style;

    logger.info(`dalleService: Generating image with DALL-E. Effective settings:`, {
        tierUsed: currentTier,
        promptUsed: processedPrompt.substring(0,100) + (processedPrompt.length > 100 ? "..." : ""), // Log a bit more of the prompt
        size: imageSize,
        quality: imageQuality,
        style: imageStyle,
        isEnhanced: shouldEnhancePrompt
    });

    const response = await openai.images.generate({
      model: DALLE_MODEL, // Ensure DALLE_MODEL is correctly defined (e.g., 'dall-e-3')
      prompt: processedPrompt,
      n: 1,
      size: imageSize as '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792', // DALL-E 3 supported sizes
      quality: imageQuality as 'standard' | 'hd',
      style: imageStyle as 'natural' | 'vivid', // DALL-E 3 supported styles
      response_format: 'url',
    });

    const imageUrl = response.data && response.data[0]?.url;

    if (!imageUrl) {
      logger.error('dalleService: No image URL received from DALL-E response.', { responseData: response.data });
      throw new Error('No image URL received from DALL-E');
    }

    logger.info(`dalleService: Image generated successfully. URL (first 50 chars): ${imageUrl.substring(0,50)}...`);
    return imageUrl;

  } catch (error) {
    const technicalErrorMessage = error instanceof Error ? error.message : 'Unknown error generating image';
    logger.error('dalleService: Error generating image with DALL-E:', {
        error: technicalErrorMessage,
        originalError: error, // Log the original error object
        stack: error instanceof Error ? error.stack : undefined,
        prompt: prompt.substring(0,100) + (prompt.length > 100 ? "..." : ""),
        tier: subscriptionTier
    });

    let userFacingReply = "I'm sorry, I encountered an issue while trying to generate the image. Please try again.";
    let errorCode = "DALLE_GENERATION_FAILED";

    if (error instanceof OpenAI.APIError) {
        userFacingReply = `I'm sorry, there was an issue with the image generation service (Status: ${error.status}, Type: ${error.type}). Please try again.`;
        errorCode = `DALLE_API_ERROR_S${error.status}_T${error.type}`;
        logger.error(`dalleService: OpenAI API Error during image generation:`, {
            status: error.status,
            type: error.type,
            code: error.code,
            param: error.param,
            message: error.message,
            headers: error.headers
        });
        // Specific handling for content policy violation
        if (error.code === 'content_policy_violation') {
            userFacingReply = "I'm sorry, but the request for an image was flagged due to content policy. Please try a different description.";
            errorCode = "DALLE_CONTENT_POLICY_VIOLATION";
        }
    }
    // Re-throw a new error with a more structured message or a specific error type if you have one
    // For now, throwing a generic error with the user-facing message.
    // The calling service (e.g., image worker) would then handle this.
    throw new Error(userFacingReply); // Or: throw new AppError(technicalErrorMessage, 500, userFacingReply); if you use AppError here
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

  const startsWithIllustration = trimmed.toLowerCase().startsWith('illustration:');
  const promptBody = startsWithIllustration
    ? trimmed.substring("illustration:".length).trim()
    : trimmed;

  const isThisARecipeStep = isRecipeStep(promptBody); // Use the helper function

  const recipeStepEmphasis = isThisARecipeStep ?
    "IMPORTANT: The image should clearly show and communicate this specific recipe step in action. Focus on the technique, ingredients, and visual cues that indicate this exact stage of preparation. The image should be instructional and show the process clearly." : "";

  let finalPrompt = "";

  switch (level) {
    case 'minimal':
      finalPrompt = `Food photography of ${promptBody}. No text, watermarks, or people. ${recipeStepEmphasis}`;
      break;
    case 'moderate':
      finalPrompt = `Professional food photography of ${promptBody}. Shot with good lighting and composition. No text, watermarks, or people. High-quality, appetizing presentation. ${recipeStepEmphasis}`;
      break;
    case 'full':
    default: // Default to full enhancement if level is unknown
      finalPrompt = `Award-winning food photography of ${promptBody}. Shot with professional camera and lighting. Perfect composition with beautiful food styling. Rich colors and textures with pleasing bokeh background. High-end presentation on elegant tableware. NO text, watermarks, human faces, hands or people. ${recipeStepEmphasis}`;
      break;
  }
  return finalPrompt.trim();
}
