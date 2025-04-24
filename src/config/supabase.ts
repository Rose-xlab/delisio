// src/config/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase'; 
import { logger } from '../utils/logger';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
// Ensure this runs before any code that needs process.env variables
// Alternatively, call dotenv.config() once in your main application entry point file.
dotenv.config();

// Use specific variable names for clarity
const supabaseUrl: string | undefined = process.env.SUPABASE_URL;
const supabaseServiceKey: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY; // Recommended name

// Check if credentials are provided and throw if missing
if (!supabaseUrl) {
  const errorMsg = 'Missing Supabase URL. Set SUPABASE_URL in .env file';
  logger.error(errorMsg);
  throw new Error(errorMsg);
}

if (!supabaseServiceKey) {
  const errorMsg = 'Missing Supabase Service Role Key. Set SUPABASE_SERVICE_ROLE_KEY in .env file';
  logger.error(errorMsg);
  throw new Error(errorMsg);
}

// Initialize and export the typed Supabase client
// Using 'export const' instead of 'export default' is often preferred for clarity, but default is fine too.
export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // Good for server-side
    autoRefreshToken: false, // Recommended when using service_role key
    detectSessionInUrl: false // Good for server-side
  }
});

logger.info('Supabase client initialized successfully.'); // Use info level for success

