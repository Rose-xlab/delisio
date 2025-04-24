// src/services/openaiClient.ts
import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';

// Load environment variables first thing
dotenv.config();

// Get API key
const apiKey = process.env.OPENAI_API_KEY;

// Check if API key is available
if (!apiKey) {
  console.error('FATAL ERROR: OPENAI_API_KEY environment variable not set.');
  // You can choose to throw an error here or handle it differently
  // throw new Error('OPENAI_API_KEY environment variable not set.');
}

// Create a single OpenAI client instance to be shared across services
const openai = new OpenAI({ apiKey });

// Export the configured client
export default openai;

// Export OpenAI class for type usage
export { OpenAI };

// Export common configurations
export const GPT_MODEL = process.env.GPT_MODEL || 'gpt-4-1106-preview';
export const DALLE_MODEL = process.env.DALLE_MODEL || 'dall-e-3';