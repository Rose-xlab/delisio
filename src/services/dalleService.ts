
import { OpenAI } from 'openai';
// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// DALL-E configuration
const DALLE_MODEL = process.env.DALLE_MODEL || 'dall-e-3';
const IMAGE_SIZE = process.env.IMAGE_SIZE || '1024x1024';
const IMAGE_QUALITY = process.env.IMAGE_QUALITY || 'standard';
const IMAGE_STYLE = process.env.IMAGE_STYLE || 'natural';

/**
 * Generates an image using DALL-E 3
 * @param prompt The text description for image generation
 * @returns URL of the generated image
 */
export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const enhancedPrompt = enhanceImagePrompt(prompt);

    const response = await openai.images.generate({
      model: DALLE_MODEL,
      prompt: enhancedPrompt,
      n: 1,
      size: IMAGE_SIZE as '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792',
      quality: IMAGE_QUALITY as 'standard' | 'hd',
      style: IMAGE_STYLE as 'natural' | 'vivid',
      response_format: 'url',
    });

    const imageUrl = response.data[0]?.url;

    if (!imageUrl) {
      throw new Error('No image URL received from DALL-E');
    }

    return imageUrl;
  } catch (error) {
    console.error('Error generating image:', error);
    throw new Error(`Failed to generate image: ${(error as Error).message}`);
  }
};

/**
 * Enhances the image prompt to ensure consistent style
 * @param basePrompt The base prompt for image generation
 * @returns Enhanced prompt with style specifications
 */
function enhanceImagePrompt(basePrompt: string): string {
  const trimmed = basePrompt.trim();

  const startsWithIllustration = trimmed.toLowerCase().startsWith('illustration:');
  const promptBody = startsWithIllustration
    ? trimmed.substring("illustration:".length).trim()
    : trimmed;

  const cartoonPrefix = promptBody.toLowerCase().includes('cartoon-style')
    ? promptBody
    : `Cartoon-style illustration of ${promptBody}`;

  return `${cartoonPrefix}. The illustration should be bright, colorful, and child-friendly with a clean, simple style. It should focus only on the cooking step described, with good lighting and clear details. No text or captions in the image.`;
}
