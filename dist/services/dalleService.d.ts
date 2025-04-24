/**
 * Generates an image using DALL-E 3 with quality based on subscription tier
 * @param prompt The text description for image generation
 * @param subscriptionTier The user's subscription tier (free, basic, premium)
 * @returns URL of the generated image
 */
export declare const generateImage: (prompt: string, subscriptionTier?: "free" | "basic" | "premium") => Promise<string>;
