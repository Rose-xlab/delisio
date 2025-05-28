// src/services/authService.ts (Backend)
import { supabase } from '../config/supabase';
import { User as BackendUserModel, UserPreferences as BackendUserPreferencesModel } from '../models/User';
import { logger } from '../utils/logger';
import { Database, TablesInsert, TablesUpdate } from '../types/supabase';
import { PostgrestError, Session as SupabaseSession, User as SupabaseAuthUser } from '@supabase/supabase-js'; // <<< IMPORTED SupabaseSession and SupabaseAuthUser
import { v4 as uuidv4 } from 'uuid';

export interface ClientUserPreferencesPayload {
  dietaryRestrictions?: string[];
  favoriteCuisines?: string[];
  allergies?: string[];
  cookingSkill?: 'beginner' | 'intermediate' | 'advanced';
  likedFoodCategoryIds?: string[];
}

type UserPreferencesRow = Database['public']['Tables']['user_preferences']['Row'];
type UserPreferencesInsert = TablesInsert<'user_preferences'>;

export const signUp = async (
  email: string,
  password: string,
  name: string
): Promise<BackendUserModel> => {
  logger.info(`AuthService: Attempting Supabase signUp with email: ${email}`);
  try {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });
    
    if (signUpError) { logger.error('AuthService: Error signing up user in Supabase auth:', signUpError); throw signUpError; }
    if (!authData.user) { logger.error('AuthService: Supabase auth.signUp did not return a user object.'); throw new Error('User creation failed during signup (no user object returned).'); }
    
    const supabaseUser: SupabaseAuthUser = authData.user; // Use imported type
    logger.info(`AuthService: Supabase auth.signUp successful for user ${supabaseUser.id}.`);

    const userAppIdValue = uuidv4();
    const profileData = {
      id: supabaseUser.id,
      user_app_id: userAppIdValue,
      username: name,
    };

    logger.info(`AuthService: Attempting to UPSERT into profiles table for user ${supabaseUser.id}:`, profileData);
    const { data: profileResult, error: profileError } = await supabase
        .from("profiles")
        .upsert(profileData, { onConflict: 'id' })
        .select()
        .single();

    if (profileError) {
        logger.error(`AuthService: Failed to create/update user profile for ${supabaseUser.id}:`, profileError);
        throw new Error(`Profile creation/update failed: ${profileError.message}`);
    } else {
        logger.info(`AuthService: Profile created/updated successfully for user ${supabaseUser.id}. Profile data:`, profileResult);
    }
    
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: (supabaseUser.user_metadata?.full_name as string) || name || (supabaseUser.email?.split('@')[0] || 'User'),
      createdAt: new Date(supabaseUser.created_at || Date.now()),
      preferences: undefined,
    };
  } catch (error) {
    logger.error('AuthService: Error in signUp process:', error);
    if (error instanceof Error) throw error;
    throw new Error(`Failed to sign up: ${(error as any).message || 'An unknown error occurred.'}`);
  }
};

export const signIn = async (
  email: string,
  password: string
): Promise<{ user: BackendUserModel; session: SupabaseSession }> => { // <<< USED IMPORTED SupabaseSession
  logger.info(`AuthService: Attempting Supabase signInWithPassword for email: ${email}`);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { logger.error('AuthService: Error signing in user:', error); throw error; }
    if (!data.user || !data.session) { logger.error('AuthService: Supabase signIn did not return a user or session.'); throw new Error('Failed to sign in: Invalid credentials or user may not exist.'); }
    
    const supabaseUser: SupabaseAuthUser = data.user; // Use imported type
    const session: SupabaseSession = data.session;   // Use imported type

    const user: BackendUserModel = {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: (supabaseUser.user_metadata?.full_name as string) || (supabaseUser.email?.split('@')[0] || 'User'),
      createdAt: new Date(supabaseUser.created_at || Date.now()),
      preferences: undefined,
    };
    
    logger.info(`AuthService: User ${user.id} signed in successfully.`);
    return { user, session: session };
  } catch (error) {
    logger.error('AuthService: Error during signIn:', error);
    if (error instanceof Error) throw error;
    throw new Error(`Failed to sign in: ${(error as any).message || 'An unknown error occurred.'}`);
  }
};

export const signOut = async (): Promise<void> => {
  logger.info("AuthService: Attempting Supabase signOut...");
  try {
    const { error } = await supabase.auth.signOut();
    if (error) { logger.error('AuthService: Error signing out user:', error); throw error; }
    logger.info("AuthService: Supabase signOut successful.");
  } catch (error) {
    logger.error('AuthService: Error during signOut:', error);
    throw new Error(`Failed to sign out: ${(error as Error).message}`);
  }
};

export const getCurrentUserWithPreferences = async (userIdFromAuthMiddleware: string): Promise<BackendUserModel | null> => {
  logger.info(`Backend AuthService: Getting current user profile and preferences for user ${userIdFromAuthMiddleware}`);
  try {
    const { data: authUserWithPrefs, error: fetchError } = await supabase
      .schema('auth')
      .from('users')
      .select(`
        id,
        email,
        created_at,
        raw_user_meta_data, 
        user_preferences ( * )
      `)
      .eq('id', userIdFromAuthMiddleware)
      .single();

    if (fetchError) { /* ... (error handling as in response #81) ... */ if (fetchError.code === 'PGRST116') return null; throw fetchError; }
    if (!authUserWithPrefs) { /* ... (warning and return null as in response #81) ... */ return null; }

    let preferences: BackendUserPreferencesModel | undefined = undefined;
    const rawPrefsData = Array.isArray(authUserWithPrefs.user_preferences) ? authUserWithPrefs.user_preferences[0] : authUserWithPrefs.user_preferences;

    if (rawPrefsData) {
      const dbPrefs = rawPrefsData as UserPreferencesRow;
      preferences = {
        dietaryRestrictions: dbPrefs.dietary_restrictions ?? [],
        favoriteCuisines: dbPrefs.favorite_cuisines ?? [],
        allergies: dbPrefs.allergies ?? [],
        cookingSkill: (dbPrefs.cooking_skill as BackendUserPreferencesModel['cookingSkill']) ?? 'beginner',
        likedFoodCategoryIds: dbPrefs.liked_food_category_ids ?? [],
      };
    }

    const metadata = authUserWithPrefs.raw_user_meta_data as { [key: string]: any } | null;
    const name = metadata?.full_name || metadata?.name || (authUserWithPrefs.email?.split('@')[0] || 'User');

    return {
      id: authUserWithPrefs.id,
      email: authUserWithPrefs.email || '',
      name: name as string,
      createdAt: new Date(authUserWithPrefs.created_at || Date.now()),
      preferences: preferences,
    };
  } catch (error) { /* ... (error handling as in response #81) ... */ throw error; }
};

export const updatePreferences = async (
  userId: string,
  preferencesToUpdate: ClientUserPreferencesPayload
): Promise<BackendUserPreferencesModel> => {
  logger.info(`Backend AuthService: Updating preferences for user ${userId}:`, JSON.stringify(preferencesToUpdate, null, 2));
  try {
    const upsertData: TablesInsert<'user_preferences'> = {
      user_id: userId,
      dietary_restrictions: preferencesToUpdate.dietaryRestrictions ?? [],
      favorite_cuisines: preferencesToUpdate.favoriteCuisines ?? [],
      allergies: preferencesToUpdate.allergies ?? [],
      cooking_skill: preferencesToUpdate.cookingSkill ?? 'beginner',
      liked_food_category_ids: preferencesToUpdate.likedFoodCategoryIds ?? [],
      updated_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('user_preferences')
      .upsert(upsertData, { onConflict: 'user_id' })
      .select()
      .single<UserPreferencesRow>();

    if (error) { /* ... (error handling as in response #81) ... */ throw error; }
    if (!data) { /* ... (error handling as in response #81) ... */ throw new Error('Preference update failed.'); }
    
    logger.info(`Backend AuthService: Preferences successfully saved/updated for user ${userId}.`);
    return { // Map DB row back to BackendUserPreferencesModel
        dietaryRestrictions: data.dietary_restrictions || [],
        favoriteCuisines: data.favorite_cuisines || [],
        allergies: data.allergies || [],
        cookingSkill: (data.cooking_skill as BackendUserPreferencesModel['cookingSkill']) || 'beginner',
        likedFoodCategoryIds: data.liked_food_category_ids || [],
    };
  } catch (error) { /* ... (error handling as in response #81) ... */ throw error; }
};

export const verifyToken = async (token: string): Promise<BackendUserModel | null> => {
  try {
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token); // Destructure user directly
    if (error) { logger.error('Error verifying token:', error); throw error; }
    if (!supabaseUser) { return null; } // supabaseUser is SupabaseAuthUser | null
    
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: (supabaseUser.user_metadata?.full_name as string) || '',
      createdAt: new Date(supabaseUser.created_at || Date.now()),
      // preferences: undefined // Consistent with original
    };
  } catch (error) { logger.error('Error verifying token:', error); return null; }
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
    });
    if (error) { logger.error('Error sending password reset:', error); throw error; }
  } catch (error) {
    logger.error('Error sending password reset:', error);
    throw new Error(`Failed to send password reset: ${(error as Error).message}`);
  }
};