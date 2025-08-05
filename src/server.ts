// *** MODIFIED ***
// src/server.ts

import dotenv from 'dotenv';

// --- MODIFIED ---
// Only load variables from .env file if not in a production environment
// This should be the VERY first thing in your application entry point.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}
// --- END MODIFICATION ---

import app from './app';

// Get port from environment variables or use default
const PORT = parseInt(process.env.PORT || '3002', 10);

// Start the API server
app.listen(PORT,  '0.0.0.0', () => {
  // Changed log message slightly for clarity
  console.log(`API Server process started, listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    console.warn('WARNING: OPENAI_API_KEY is not set. This will cause errors.');
  }
});