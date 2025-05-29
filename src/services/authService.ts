// src/services/authService.ts
import { supabase } from '../config/supabase';
import { User as BackendUserModel, UserPreferences as BackendUserPreferencesModel } from '../models/User';
import { logger } from '../utils/logger';
import { Database, TablesInsert } from '../types/supabase'; // Database type is used here
import { PostgrestError, Session as SupabaseSession, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// If you integrate Stripe, uncomment and configure:
// import Stripe from 'stripe';
// if (!process.env.STRIPE_SECRET_KEY) {
//   logger.warn('Stripe secret key is not set. Stripe operations will fail.');
// }
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2024-04-10', // Use the API version you are developing against
//   typescript: true,
// });


export interface ClientUserPreferencesPayload {
  dietaryRestrictions?: string[];
  favoriteCuisines?: string[];
  allergies?: string[];
  cookingSkill?: 'beginner' | 'intermediate' | 'advanced';
  likedFoodCategoryIds?: string[];
}

type UserPreferencesRow = Database['public']['Tables']['user_preferences']['Row'];

// Keep all your existing functions (signUp, signIn, signOut, getCurrentUserWithPreferences, updatePreferences, verifyToken, resetPassword) as they were.
// For brevity, I'm not re-listing them here, but they should remain in your actual file.
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
    
    const supabaseUser: SupabaseAuthUser = authData.user;
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
): Promise<{ user: BackendUserModel; session: SupabaseSession }> => {
  logger.info(`AuthService: Attempting Supabase signInWithPassword for email: ${email}`);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { logger.error('AuthService: Error signing in user:', error); throw error; }
    if (!data.user || !data.session) { logger.error('AuthService: Supabase signIn did not return a user or session.'); throw new Error('Failed to sign in: Invalid credentials or user may not exist.'); }
    
    const supabaseUser: SupabaseAuthUser = data.user;
    const session: SupabaseSession = data.session;

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
    if (error instanceof Error) throw error;
    throw new Error(`Failed to sign out: ${(error as any).message || 'An unknown error occurred.'}`);
  }
};

export const getCurrentUserWithPreferences = async (userIdFromAuthMiddleware: string): Promise<BackendUserModel | null> => {
  logger.info(`Backend AuthService: Getting current user profile and preferences for user ${userIdFromAuthMiddleware}`);
  try {
    const { data: authUserWithPrefsData, error: fetchError } = await supabase
      .from('profiles') 
      .select(`
        id,
        username,
        avatar_url,
        user_app_id, 
        user_preferences ( * )
      `)
      .eq('id', userIdFromAuthMiddleware)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') { 
        logger.warn(`Backend AuthService: No profile found for user ${userIdFromAuthMiddleware}. Fetching auth user directly.`);
        const { data: authUserOnly, error: authUserError } = await supabase.auth.admin.getUserById(userIdFromAuthMiddleware); 
        if (authUserError || !authUserOnly.user) {
            logger.error(`Backend AuthService: Error fetching user from auth.users after profile not found for ${userIdFromAuthMiddleware}:`, authUserError);
            return null;
        }
        const user = authUserOnly.user;
        return {
            id: user.id,
            email: user.email || '',
            name: (user.user_metadata?.full_name as string) || (user.email?.split('@')[0] || 'User'),
            createdAt: new Date(user.created_at || Date.now()),
            preferences: undefined, 
        };
      }
      logger.error(`Backend AuthService: Error fetching user profile and preferences for ${userIdFromAuthMiddleware}:`, fetchError);
      throw fetchError;
    }

    if (!authUserWithPrefsData) {
      logger.warn(`Backend AuthService: No data returned for user profile ${userIdFromAuthMiddleware}.`);
      return null;
    }

    const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(userIdFromAuthMiddleware);
    if (authUserError || !authUserData.user) {
        logger.error(`Backend AuthService: Could not fetch core auth data for user ${userIdFromAuthMiddleware}:`, authUserError);
        throw new Error('Could not retrieve core user authentication data.');
    }
    const coreAuthUser = authUserData.user;

    let preferences: BackendUserPreferencesModel | undefined = undefined;
    const rawPrefsData = Array.isArray(authUserWithPrefsData.user_preferences) 
        ? authUserWithPrefsData.user_preferences[0] 
        : authUserWithPrefsData.user_preferences;

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

    return {
      id: authUserWithPrefsData.id, 
      email: coreAuthUser.email || '',
      name: (authUserWithPrefsData.username as string) || (coreAuthUser.user_metadata?.full_name as string) || (coreAuthUser.email?.split('@')[0] || 'User'),
      createdAt: new Date(coreAuthUser.created_at || Date.now()),
      preferences: preferences,
    };
  } catch (error) {
    logger.error(`Backend AuthService: Unexpected error in getCurrentUserWithPreferences for ${userIdFromAuthMiddleware}:`, error);
    if (error instanceof Error) throw error;
    throw new Error(`Failed to get user profile: ${(error as any).message || 'An unknown error occurred.'}`);
  }
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

    if (error) { 
      logger.error(`Backend AuthService: Error upserting preferences for user ${userId}:`, error);
      throw error; 
    }
    if (!data) { 
      logger.error(`Backend AuthService: No data returned after upserting preferences for user ${userId}.`);
      throw new Error('User preference update failed to return data.'); 
    }
    
    logger.info(`Backend AuthService: Preferences successfully saved/updated for user ${userId}.`);
    return { 
        dietaryRestrictions: data.dietary_restrictions || [],
        favoriteCuisines: data.favorite_cuisines || [],
        allergies: data.allergies || [],
        cookingSkill: (data.cooking_skill as BackendUserPreferencesModel['cookingSkill']) || 'beginner',
        likedFoodCategoryIds: data.liked_food_category_ids || [],
    };
  } catch (error) {
    logger.error(`Backend AuthService: Error updating preferences for user ${userId}:`, error);
    if (error instanceof Error) throw error;
    throw new Error(`Failed to update preferences: ${(error as any).message || 'An unknown error occurred.'}`);
  }
};

export const verifyToken = async (token: string): Promise<BackendUserModel | null> => {
  try {
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    if (error) { logger.error('Error verifying token:', error); throw error; } 
    if (!supabaseUser) { return null; }
    
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: (supabaseUser.user_metadata?.full_name as string) || (supabaseUser.email?.split('@')[0] || 'User'),
      createdAt: new Date(supabaseUser.created_at || Date.now()),
    };
  } catch (error) { 
    logger.error('Exception during token verification:', error); 
    throw error; 
  }
};

export const resetPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/update-password`, 
    });
    if (error) { logger.error('Error sending password reset:', error); throw error; }
    logger.info(`Password reset email sent to ${email}`);
  } catch (error) {
    logger.error('Error sending password reset:', error);
    if (error instanceof Error) throw error;
    throw new Error(`Failed to send password reset: ${(error as any).message || 'An unknown error occurred.'}`);
  }
};


// --- SERVICE FUNCTION FOR ACCOUNT DELETION ---
export const deleteUserAccount = async (userId: string): Promise<void> => {
  logger.info(`AuthService: Starting account deletion process for user ID: ${userId}`);

  try {
    logger.info(`AuthService: [User ${userId}] Checking for third-party (e.g., Stripe) data to clean up.`);
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (subError) {
      logger.error(`AuthService: [User ${userId}] Error fetching subscription for cleanup: ${subError.message}`);
    }

    if (subscription?.stripe_subscription_id) {
      logger.info(`AuthService: [User ${userId}] Found Stripe subscription ID: ${subscription.stripe_subscription_id}. Placeholder for cancellation.`);
      // Placeholder: Actual Stripe cancellation logic
      // try {
      //   if (!stripe) throw new Error("Stripe client not initialized.");
      //   await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      //   logger.info(`AuthService: [User ${userId}] Stripe subscription ${subscription.stripe_subscription_id} cancellation initiated.`);
      // } catch (e) {
      //   logger.error(`AuthService: [User ${userId}] Error handling Stripe subscription ${subscription.stripe_subscription_id}:`, e);
      // }
    }
    if (subscription?.stripe_customer_id) {
       logger.info(`AuthService: [User ${userId}] Found Stripe customer ID: ${subscription.stripe_customer_id}. Placeholder for deletion.`);
      // Placeholder: Actual Stripe customer deletion logic
      // try {
      //   if (!stripe) throw new Error("Stripe client not initialized.");
      //   await stripe.customers.del(subscription.stripe_customer_id);
      //   logger.info(`AuthService: [User ${userId}] Stripe customer ${subscription.stripe_customer_id} deletion initiated.`);
      // } catch (e) {
      //   logger.error(`AuthService: [User ${userId}] Error deleting Stripe customer ${subscription.stripe_customer_id}:`, e);
      // }
    }

    logger.info(`AuthService: [User ${userId}] Deleting application-specific data.`);

    const { data: userConversations, error: convFetchErr } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId);
    if (convFetchErr) throw new Error(`Failed to fetch conversations for cleanup: ${convFetchErr.message}`);
    if (userConversations && userConversations.length > 0) {
        const convIds = userConversations.map(c => c.id);
        const { error: msgDelErr } = await supabase.from('messages').delete().in('conversation_id', convIds);
        if (msgDelErr) throw new Error(`Failed to delete messages: ${msgDelErr.message}`);
        const { error: convDelErr } = await supabase.from('conversations').delete().eq('user_id', userId);
        if (convDelErr) throw new Error(`Failed to delete conversations: ${convDelErr.message}`);
    }
    
    // --- CORRECTED LOOP ---
    // Explicitly type the array elements as keys of your public tables
    const tablesWithUserId: (keyof Database['public']['Tables'])[] = [
      'ai_chat_usage', 'favorites', 'payment_methods', 'recipe_usage', 
      'search_history', 'subscription_history', 'subscriptions', 
      'user_activity', 'user_preferences'
    ];

    for (const tableName of tablesWithUserId) {
      // Now 'tableName' is correctly typed, and supabase.from(tableName) will be type-safe
      const { error } = await supabase.from(tableName).delete().eq('user_id', userId);
      if (error) {
        logger.error(`AuthService: [User ${userId}] Error deleting from ${tableName}:`, error);
        throw new Error(`Failed to delete from ${tableName}: ${error.message}`);
      }
      logger.info(`AuthService: [User ${userId}] Deleted records from public.${tableName}`);
    }
    // --- END OF CORRECTED LOOP ---
    
    const { error: recipeUserDeleteError } = await supabase.from('recipes').delete().eq('user_id', userId);
    if (recipeUserDeleteError) throw new Error (`Failed to delete user recipes: ${recipeUserDeleteError.message}`);
    logger.info(`AuthService: [User ${userId}] Handled user-associated recipes.`);

    logger.info(`AuthService: [User ${userId}] Deleting record from public.profiles.`);
    const { error: profileDeleteError } = await supabase.from('profiles').delete().eq('id', userId);
    if (profileDeleteError && profileDeleteError.code !== 'PGRST116') { 
      logger.error(`AuthService: [User ${userId}] Error deleting from profiles:`, profileDeleteError);
      throw new Error(`Failed to delete profile for user ${userId}: ${profileDeleteError.message}`);
    }

    logger.info(`AuthService: [User ${userId}] Attempting to delete user from Supabase Auth system.`);
    // Ensure the 'supabase' client here has admin privileges (initialized with service_role_key)
    const { data: adminUserDeleteData, error: adminUserDeleteError } = await supabase.auth.admin.deleteUser(userId, true); 

    if (adminUserDeleteError) {
      if (adminUserDeleteError.message?.includes('User not found') || (adminUserDeleteError as any).status === 404) {
        logger.warn(`AuthService: [User ${userId}] User not found in Supabase Auth system. Might have been already deleted.`);
      } else {
        logger.error(`AuthService: [User ${userId}] Critical error deleting user from Supabase Auth system:`, adminUserDeleteError);
        throw new Error(`Failed to delete user from authentication system: ${adminUserDeleteError.message}`);
      }
    } else {
      logger.info(`AuthService: [User ${userId}] Successfully deleted user from Supabase Auth system.`);
    }

    logger.info(`AuthService: Account deletion process completed successfully for user ID: ${userId}`);

  } catch (error) {
    logger.error(`AuthService: [User ${userId}] Overall error during account deletion process:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`An unexpected error occurred during account deletion for user ${userId}.`);
  }
};