// src/services/openaiClient.ts

import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';

// Only load variables from .env file if not in a production environment
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Get API key
const apiKey = process.env.OPENAI_API_KEY;

// --- ADDED: Diagnostic Logging ---
// This will run every time the server starts or restarts.
// We are logging whether the key exists, NOT the key itself for security.
if (apiKey && apiKey.startsWith('sk-')) {
    console.log('[Startup Check] OpenAI API Key loaded successfully from environment.');
} else {
    console.error('[Startup Check] FATAL ERROR: OPENAI_API_KEY is missing or invalid in the environment.');
}
// --- END: Diagnostic Logging ---


// Create a single OpenAI client instance to be shared across services
const openai = new OpenAI({ apiKey });

// Export the configured client
export default openai;

// Export OpenAI class for type usage
export { OpenAI };

// Export common configurations
export const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4-1106-preview';
export const DALLE_MODEL = process.env.DALLE_MODEL || 'dall-e-3';