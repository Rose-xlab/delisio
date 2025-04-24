"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImage = void 0;
// src/services/dalleService.ts
const openai_1 = require("openai");
// Initialize OpenAI client
const openai = new openai_1.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// DALL-E configuration
const DALLE_MODEL = process.env.DALLE_MODEL || 'dall-e-3';
/**
 * Generates an image using DALL-E 3 with quality based on subscription tier
 * @param prompt The text description for image generation
 * @param subscriptionTier The user's subscription tier (free, basic, premium)
 * @returns URL of the generated image
 */
const generateImage = async (prompt, subscriptionTier = 'free') => {
    try {
        // Enhanced prompt for realistic food photography
        const enhancedPrompt = enhanceRealisticPrompt(prompt);
        // Set image quality based on subscription tier
        // Free tier gets smaller size and standard quality
        // Paid tiers get larger size and HD quality
        const imageSize = subscriptionTier === 'free' ? '1024x1024' : '1792x1024';
        const imageQuality = subscriptionTier === 'free' ? 'standard' : 'hd';
        const IMAGE_STYLE = 'natural'; // Always use natural style
        // Log the enhanced prompt and quality settings for debugging
        console.log(`Generating realistic image with prompt: ${enhancedPrompt.substring(0, 100)}...`);
        console.log(`Using quality settings: size=${imageSize}, quality=${imageQuality} for tier=${subscriptionTier}`);
        const response = await openai.images.generate({
            model: DALLE_MODEL,
            prompt: enhancedPrompt,
            n: 1,
            size: imageSize,
            quality: imageQuality,
            style: IMAGE_STYLE,
            response_format: 'url',
        });
        const imageUrl = response.data[0]?.url;
        if (!imageUrl) {
            throw new Error('No image URL received from DALL-E');
        }
        return imageUrl;
    }
    catch (error) {
        console.error('Error generating image:', error);
        throw new Error(`Failed to generate image: ${error.message}`);
    }
};
exports.generateImage = generateImage;
/**
 * Enhances the image prompt for realistic photo style using techniques known
 * to produce the highest quality DALL-E results for food photography
 *
 * @param basePrompt The base prompt for image generation
 * @returns Enhanced prompt with realistic photo specifications
 */
function enhanceRealisticPrompt(basePrompt) {
    const trimmed = basePrompt.trim();
    const startsWithIllustration = trimmed.toLowerCase().startsWith('illustration:');
    const promptBody = startsWithIllustration
        ? trimmed.substring("illustration:".length).trim()
        : trimmed;
    // Define photography techniques and equipment associated with high-end food photography
    const cameraType = "Phase One medium format camera";
    const lensType = "90mm f/2.8 prime lens";
    const lightingSetup = "professional studio lighting setup with soft boxes, diffusers, and reflectors for perfect highlight control";
    const postProcessing = "expertly color graded in Capture One with professional color science";
    // Create a detailed photography-focused prompt
    return `Award-winning, professional food photography of ${promptBody}. 16K ultra-high-resolution image shot with ${cameraType} and ${lensType}, using ${lightingSetup}. ${postProcessing}.

The image has perfect composition following the rule of thirds, with stunning food styling by a world-class culinary artist. Extreme macro detail showing intricate food textures. Crisp foreground with creamy bokeh background. Dramatic side lighting that accentuates textures and creates gentle shadows.

The scene features impeccable food presentation on minimalist, high-end tableware. Background elements are deliberately out of focus creating professional depth. Rich, vibrant colors with perfect white balance. The food looks absolutely mouthwatering with glistening highlights and perfect garnishes.

IMPORTANT RESTRICTIONS:
- This is STRICTLY FOOD ONLY photography - NO HUMAN FACES, HANDS, or PEOPLE whatsoever.
- The image MUST NOT contain ANY text, words, labels, captions, numbers, or letters.
- No watermarks, logos, menu text, recipe text, signs, or any textual elements in the image.
- No text on plates, utensils, packaging, or backgrounds.

The photograph appears to be from a Michelin-starred restaurant cookbook or award-winning culinary magazine spread. No text, watermarks, or borders. Photorealistic, NOT AI-generated in appearance.`;
}
//# sourceMappingURL=dalleService.js.map