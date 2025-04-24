// config/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Get Supabase URL and key from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Check if Supabase credentials are available
if (!supabaseUrl || !supabaseKey) {
  logger.error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
  process.exit(1);
}

// Create and export Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test the connection
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    logger.error('Supabase authentication error:', error);
  } else {
    logger.info('Supabase connection established successfully');
  }
}).catch(err => {
  logger.error('Supabase connection error:', err);
});

export default supabase;