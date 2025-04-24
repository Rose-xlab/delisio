// services/authService.ts
import { Request } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorMiddleware';

// User interface matching Supabase auth schema
export interface User {
  id: string;
  email: string;
  name?: string;
  app_metadata?: {
    provider?: string;
    [key: string]: any;
  };
  user_metadata?: {
    [key: string]: any;
  };
  aud?: string;
  created_at?: string;
}

/**
 * Verify a JWT token
 * @param token The JWT token to verify
 * @returns The user associated with the token or null if invalid
 */
export const verifyToken = async (token: string): Promise<User | null> => {
  try {
    if (!token) {
      return null;
    }

    // Use Supabase's getUser to verify the token and get the user
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logger.warn('Token verification failed:', error?.message);
      return null;
    }

    // Return user data
    return {
      id: data.user.id,
      email: data.user.email || '',
      name: data.user.user_metadata?.name || data.user.email,
      app_metadata: data.user.app_metadata,
      user_metadata: data.user.user_metadata,
      aud: data.user.aud,
      created_at: data.user.created_at
    };
  } catch (error) {
    logger.error('Error verifying token:', error);
    return null;
  }
};

/**
 * Extract token from request headers
 * @param req Express Request object
 * @returns The token or null if not found
 */
export const extractTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.split(' ')[1];
};

/**
 * Authenticate a user with email and password
 * @param email User email
 * @param password User password
 * @returns Authentication session data
 */
export const signIn = async (email: string, password: string) => {
  try {
    // Sign in with Supabase auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      logger.warn(`Sign in failed for ${email}:`, error.message);
      throw new AppError(error.message, 401);
    }

    if (!data.user || !data.session) {
      throw new AppError('Authentication failed', 401);
    }

    // Get admin role from the database
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', data.user.id)
      .single();

    if (adminError || !adminData) {
      logger.warn(`User ${email} attempted to sign in without admin privileges`);
      throw new AppError('You do not have admin privileges', 403);
    }

    // Return session and user data with role
    return {
      session: data.session,
      user: {
        ...data.user,
        role: adminData.role
      }
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Sign in error:', error);
    throw new AppError('Authentication failed', 401);
  }
};

/**
 * Sign out a user
 * @param token The token to invalidate
 */
export const signOut = async (token: string) => {
  try {
    if (!token) {
      return;
    }

    // Sign out from Supabase auth
    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      logger.warn('Sign out error:', error.message);
    }
  } catch (error) {
    logger.error('Sign out error:', error);
  }
};

/**
 * Verify if a user has admin privileges
 * @param userId User ID to check
 * @returns Boolean indicating if user has admin role
 */
export const verifyAdminRole = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.role === 'admin' || data.role === 'super_admin';
  } catch (error) {
    logger.error('Error verifying admin role:', error);
    return false;
  }
};