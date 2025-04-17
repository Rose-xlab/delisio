import { supabase } from '../config/supabase';
import { User } from '../models/User';
import { logger } from '../utils/logger';

/**
 * Signs up a new user with email and password
 * @param email User's email
 * @param password User's password
 * @param name User's name
 * @returns User object if successful
 */
export const signUp = async (
  email: string,
  password: string,
  name: string
): Promise<User> => {
  try {
    // Create user in Supabase auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    });
    
    if (error) {
      logger.error('Error signing up user:', error);
      throw error;
    }
    
    if (!data.user) {
      throw new Error('Failed to create user');
    }
    
    return {
      id: data.user.id,
      email: data.user.email || '',
      name: data.user.user_metadata.full_name || '',
      createdAt: new Date(data.user.created_at || Date.now())
    };
  } catch (error) {
    logger.error('Error signing up:', error);
    throw new Error(`Failed to sign up: ${(error as Error).message}`);
  }
};

/**
 * Signs in a user with email and password
 * @param email User's email
 * @param password User's password
 * @returns User object and session if successful
 */
export const signIn = async (
  email: string,
  password: string
): Promise<{ user: User; session: any }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      logger.error('Error signing in user:', error);
      throw error;
    }
    
    if (!data.user || !data.session) {
      throw new Error('Failed to sign in');
    }
    
    const user: User = {
      id: data.user.id,
      email: data.user.email || '',
      name: data.user.user_metadata.full_name || '',
      createdAt: new Date(data.user.created_at || Date.now())
    };
    
    return { user, session: data.session };
  } catch (error) {
    logger.error('Error signing in:', error);
    throw new Error(`Failed to sign in: ${(error as Error).message}`);
  }
};

/**
 * Signs out the current user
 */
export const signOut = async (): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      logger.error('Error signing out user:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Error signing out:', error);
    throw new Error(`Failed to sign out: ${(error as Error).message}`);
  }
};

/**
 * Gets the current user from session
 * @returns User object if there is an active session
 */
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      logger.error('Error getting current user:', error);
      throw error;
    }
    
    if (!data.user) {
      return null;
    }
    
    return {
      id: data.user.id,
      email: data.user.email || '',
      name: data.user.user_metadata.full_name || '',
      createdAt: new Date(data.user.created_at || Date.now())
    };
  } catch (error) {
    logger.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Verifies a JWT token from the request
 * @param token JWT token from request headers
 * @returns User object if token is valid
 */
export const verifyToken = async (token: string): Promise<User | null> => {
  try {
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error) {
      logger.error('Error verifying token:', error);
      throw error;
    }
    
    if (!data.user) {
      return null;
    }
    
    return {
      id: data.user.id,
      email: data.user.email || '',
      name: data.user.user_metadata.full_name || '',
      createdAt: new Date(data.user.created_at || Date.now())
    };
  } catch (error) {
    logger.error('Error verifying token:', error);
    return null;
  }
};

/**
 * Sends a password reset email
 * @param email User's email
 */
export const resetPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
    });
    
    if (error) {
      logger.error('Error sending password reset:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Error sending password reset:', error);
    throw new Error(`Failed to send password reset: ${(error as Error).message}`);
  }
};