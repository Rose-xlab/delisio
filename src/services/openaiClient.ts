// src/services/openaiClient.ts
import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';
import { logger } from '../utils/logger';

// Always try to load .env file, regardless of environment
// This ensures consistency across all processes
dotenv.config();

// Get API key
const apiKey = process.env.OPENAI_API_KEY;

// Validate API key exists and looks valid
if (!apiKey) {
    const errorMsg = 'CRITICAL: OPENAI_API_KEY is not set in environment variables';
    console.error(`[OpenAI Client] ${errorMsg}`);
    logger?.error(errorMsg);
    throw new Error(errorMsg);
}

if (!apiKey.startsWith('sk-')) {
    const errorMsg = 'CRITICAL: OPENAI_API_KEY exists but does not appear to be valid (should start with "sk-")';
    console.error(`[OpenAI Client] ${errorMsg}`);
    logger?.error(errorMsg);
    throw new Error(errorMsg);
}

// Log success (partial key only for security)
const maskedKey = `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`;
console.log(`[OpenAI Client] API Key loaded successfully: ${maskedKey}`);
logger?.info(`OpenAI client initialized with API key: ${maskedKey}`);

// Create a single OpenAI client instance to be shared across services
const openai = new OpenAI({ 
    apiKey,
    maxRetries: 3, // Add retry logic
    timeout: 30000, // 30 second timeout
});

// Test the API key on initialization (optional but helpful)
if (process.env.NODE_ENV !== 'production') {
    openai.models.list()
        .then(() => {
            console.log('[OpenAI Client] API key validated successfully - can access OpenAI API');
            logger?.info('OpenAI API key validated successfully');
        })
        .catch((error) => {
            console.error('[OpenAI Client] API key validation failed:', error.message);
            logger?.error('OpenAI API key validation failed', { error: error.message });
        });
}

// Export the configured client
export default openai;

// Export OpenAI class for type usage
export { OpenAI };

// Export common configurations
export const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4-1106-preview';
export const DALLE_MODEL = process.env.DALLE_MODEL || 'dall-e-3';