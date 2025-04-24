// src/admin/services/userService.ts
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { resetUsageCounter } from '../../services/subscriptionService'; // Assuming this path is correct

/**
 * Get list of users with pagination and filters
 */
export const getUsersList = async (filters: {
  page: number;
  limit: number;
  search: string;
  tier: string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
}) => {
  try {
    // Instead of directly querying 'users' which is in auth schema, create a custom RPC function
    // or use a type assertion as a temporary solution

    // Note: 'last_sign_in_at' is used below to match the typical auth.users schema (changed from original 'last_login' idea if applicable)
    let query = supabase
      .from('auth.users' as any) // Use type assertion to bypass TypeScript error
      .select(`
        id,
        email,
        created_at,
        last_sign_in_at,
        subscriptions(tier, status, current_period_end)
      `); // Ensure 'subscriptions' relation exists and is configured if needed

    // Apply search filter if provided
    if (filters.search) {
      // Searching UUID might require exact match, ilike is for strings.
      // Consider if searching ID is truly needed or if email search is sufficient.
      query = query.or(`email.ilike.%${filters.search}%`);
      // If searching ID is required: query = query.or(`email.ilike.%${filters.search}%,id.eq.${filters.search}`);
    }

    // Apply tier filter if provided - Requires a JOIN on subscriptions table
    // Filtering on related tables requires careful query construction.
    // Supabase JS v2 doesn't directly support .eq('related_table.column', value) in the main query chain like this.
    // You might need a different approach like fetching users and then filtering/sorting in JS,
    // or using an RPC function (stored procedure) in Supabase for complex filtering/sorting.
    // Let's assume for now the intention is to filter/sort on the primary 'users' table fields
    // and handle subscription data after fetching.
    /*
    if (filters.tier) {
        // This syntax likely won't work as intended for filtering related tables directly.
        // query = query.eq('subscriptions.tier', filters.tier);
    }
    */

    // --- IMPORTANT REVISION for Counting and Filtering/Sorting ---
    // Building the count query based on potentially complex filters (especially across relations)
    // needs careful handling. Direct filtering/sorting on joined tables like 'subscriptions'
    // is complex with the basic JS client. An RPC function is often the best solution.

    // Let's simplify the counting and sorting to only use 'users' table fields for this example,
    // assuming subscription filtering/sorting might be handled differently (e.g., post-fetch or via RPC).

    let countQuery = supabase.from('auth.users' as any).select('id', { count: 'exact', head: true });
    if (filters.search) {
        countQuery = countQuery.or(`email.ilike.%${filters.search}%`);
    }
    // Add other primary table filters to countQuery if needed.

    const { count, error: countError } = await countQuery;

    if (countError) {
      logger.error('Error counting users:', countError);
      throw new Error('Failed to count users');
    }

    // Apply sorting ONLY on users table fields for direct query
    // Sorting by related table fields ('tier', 'subscription_status') directly is not straightforward.
    const validUserSortFields = ['email', 'created_at', 'last_sign_in_at', 'id'];
    if (validUserSortFields.includes(filters.sortBy)) {
          query = query.order(filters.sortBy as any, { ascending: filters.sortDir === 'asc' });
    } else {
        // Default sort if sortBy is not a direct user field or invalid
        query = query.order('created_at', { ascending: false });
        if (filters.sortBy === 'tier' || filters.sortBy === 'subscription_status') {
            logger.warn(`Sorting by related field '${filters.sortBy}' requested but not directly applied in query. Apply post-fetch or use RPC.`);
        }
    }

    // Apply pagination
    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;

    query = query.range(from, to);

    // Execute query
    const { data, error } = await query;

    if (error) {
      // Log the specific parsing error if it occurs, along with the attempted query structure
      logger.error(`Error fetching users: ${error.message}`, { details: error }); // Log full error object
      throw new Error('Failed to fetch users'); // Throw a generic error upwards
    }

    // TODO: If filtering/sorting by subscription tier/status is needed,
    // implement it here on the 'data' array after fetching, or use an RPC function.

    // Format the response
    return {
      users: data || [],
      pagination: {
        total: count || 0,
        page: filters.page,
        limit: filters.limit,
        pages: Math.ceil((count || 0) / filters.limit)
      }
    };
  } catch (error) {
    // Log the error caught within this function before re-throwing
    if (error instanceof Error) {
        logger.error(`Error in getUsersList: ${error.message}`, { stack: error.stack });
    } else {
        logger.error('An unknown error occurred in getUsersList:', error);
    }
    // Re-throw the error to be handled by the calling function/controller
    // Ensure it's an actual Error object being thrown
    throw error instanceof Error ? error : new Error('An unexpected error occurred while getting the user list.');
  }
};

/**
 * Get detailed information about a user
 */
export const getUserDetails = async (userId: string) => {
  try {
    // Get user info - Selecting '*' might expose sensitive fields from auth.users. Be specific.
    const { data: user, error: userError } = await supabase
      .from('auth.users' as any) // Use type assertion to bypass TypeScript error
      .select(`
        id,
        email,
        created_at,
        updated_at,
        last_sign_in_at,
        email_confirmed_at,
        phone,
        phone_confirmed_at,
        raw_user_meta_data, // Contains user-specific metadata
        raw_app_meta_data, // Contains app-specific metadata (like roles, provider)
        subscriptions(*),
        user_preferences(*)
      `) // Add relationships as needed
      .eq('id', userId)
      .single();

    if (userError) {
        if (userError.code === 'PGRST116') { // Standard code for row not found with .single()
             logger.warn(`User details not found for user ${userId}`);
             return null; // Return null if user not found
        }
        logger.error(`Error fetching user ${userId}:`, userError);
        throw new Error('Failed to fetch user details');
    }

    // User guaranteed to exist here if no error and not PGRST116
    // if (!user) { return null; } // This check is technically redundant after .single() error handling


    // Get user activity
    const { data: activity, error: activityError } = await supabase
      .from('user_activity') // Ensure this table exists in 'public' schema types
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (activityError) {
      logger.error(`Error fetching activity for user ${userId}:`, activityError);
      // Don't throw - we can still return user without activity
    }

    // Get recipe count
    const { count: recipeCount, error: recipeError } = await supabase
      .from('recipes') // Ensure this table exists in 'public' schema types
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (recipeError) {
      logger.error(`Error counting recipes for user ${userId}:`, recipeError);
      // Don't throw - we can still return user without recipe count
    }

    // Get favorite count
    const { count: favoriteCount, error: favoriteError } = await supabase
      .from('favorites') // Ensure this table exists in 'public' schema types
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (favoriteError) {
      logger.error(`Error counting favorites for user ${userId}:`, favoriteError);
      // Don't throw - we can still return user without favorite count
    }

    // Get usage data
    const { data: usage, error: usageError } = await supabase
      .from('recipe_usage') // Ensure this table exists in 'public' schema types
      .select('*')
      .eq('user_id', userId)
      .order('period_start', { ascending: false })
      .limit(6);

    if (usageError) {
      logger.error(`Error fetching usage for user ${userId}:`, usageError);
      // Don't throw - we can still return user without usage data
    }

    return {
      user, // User is guaranteed to be non-null here based on earlier logic
      activity: activity || [],
      stats: {
        recipeCount: recipeCount ?? 0, // Use nullish coalescing
        favoriteCount: favoriteCount ?? 0 // Use nullish coalescing
      },
      usage: usage || []
    };
  } catch (error) {
      // Check if it's the specific error we throw or another unexpected one
      if (error instanceof Error && error.message === 'Failed to fetch user details') {
          throw error; // Re-throw the specific error
      }
      // Log unexpected errors
      logger.error(`Unexpected error in getUserDetails for ${userId}:`, error);
      // Depending on desired behavior, you might throw a generic error or the original one
      throw new Error(`An unexpected error occurred fetching details for user ${userId}`);
  }
};

/**
 * Update a user's subscription (Admin action - assumes necessary permissions)
 */
export const updateSubscription = async (userId: string, tier: string) => {
  try {
    // We don't necessarily need to check if the user exists in auth.users first,
    // as the subscription update targets the 'subscriptions' table based on user_id.
    // If the user_id doesn't exist, the FK constraint on subscriptions should handle it.

    // Check if user has an existing subscription
    const { data: existingSubscription, error: subCheckError } = await supabase
        .from('subscriptions') // Ensure this table exists in 'public' schema types
        .select('id') // Just need to know if it exists
        .eq('user_id', userId)
        .maybeSingle(); // Use maybeSingle to handle 0 or 1 row without error

    if (subCheckError) {
        logger.error(`Error checking subscription for user ${userId}:`, subCheckError);
        throw new Error('Failed to check existing subscription status');
    }

    // Get current period dates - Use UTC for consistency
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1); // Simple month addition

    if (!existingSubscription) {
      // Create new subscription if it doesn't exist
      logger.info(`No existing subscription found for user ${userId}. Creating new one.`);
      const { error: createError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          tier: tier,
          status: 'active', // Assuming admin override makes it active
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false
          // Add stripe_customer_id/stripe_subscription_id if managed externally and known
        });

      if (createError) {
        logger.error(`Error creating subscription for user ${userId}:`, createError);
        // Check for specific errors like FK violation if user_id doesn't exist
        if (createError.code === '23503') { // Foreign key violation
             throw new Error(`Cannot create subscription: User with ID ${userId} does not exist.`);
        }
        throw new Error('Failed to create subscription');
      }
      logger.info(`Successfully created subscription for user ${userId} with tier ${tier}`);

    } else {
      // Update existing subscription
      logger.info(`Existing subscription found for user ${userId}. Updating tier.`);
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          tier: tier,
          status: 'active', // Ensure it's active on manual update
          updated_at: now.toISOString(), // Explicitly set update timestamp
          // Potentially update current_period_start/end if the tier change implies a new cycle
          // current_period_start: now.toISOString(),
          // current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false // Ensure cancellation flag is reset if needed
        })
        .eq('user_id', userId);

      if (updateError) {
        logger.error(`Error updating subscription for user ${userId}:`, updateError);
        throw new Error('Failed to update subscription');
      }
       logger.info(`Successfully updated subscription for user ${userId} to tier ${tier}`);
    }

    // Reset usage counter for the new/updated period
    // Use the same periodStart/End used for creation/update
    try {
        await resetUsageCounter(userId, now, periodEnd);
        logger.info(`Successfully reset usage counter for user ${userId}`);
    } catch (resetError) {
         logger.error(`Failed to reset usage counter for user ${userId} after subscription update:`, resetError);
         // Decide if this should throw or just be logged. Usually non-critical.
         // throw new Error('Subscription updated, but failed to reset usage counter.');
    }

    return true;
  } catch (error) {
    // Log the error before re-throwing or handling
    logger.error(`Error in updateSubscription for user ${userId} with tier ${tier}:`, error);
    // Re-throw the original error to be caught by the controller
    throw error;
  }
};

/**
 * Reset a user's usage limits based on their current subscription period
 */
export const resetUsageLimits = async (userId: string) => {
  try {
    // Get current subscription to determine period dates
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions') // Ensure this table exists in 'public' schema types
      .select('current_period_start, current_period_end, status')
      .eq('user_id', userId)
      .single(); // Expect exactly one row for an active user needing reset

    if (subError) {
        if (subError.code === 'PGRST116') {
            logger.error(`Cannot reset usage: No subscription found for user ${userId}`);
            throw new Error(`Cannot reset usage: No subscription found for user ${userId}`);
        }
        logger.error(`Error getting subscription for user ${userId} during usage reset:`, subError);
        throw new Error('Failed to get subscription information for usage reset');
    }

    // We might only want to reset for 'active' subscriptions, or handle others differently
    if (!subscription || subscription.status !== 'active') {
        logger.warn(`Usage reset requested for user ${userId}, but subscription is not active (Status: ${subscription?.status}). Skipping reset.`);
        // Depending on requirements, you might throw an error or just return false/log
        // throw new Error('Cannot reset usage limits: User does not have an active subscription');
        return false; // Indicate reset was not performed
    }

    // Reset usage counter using the period from the subscription
    const periodStart = new Date(subscription.current_period_start);
    const periodEnd = new Date(subscription.current_period_end);

    await resetUsageCounter(userId, periodStart, periodEnd);

    logger.info(`Successfully reset usage limits for user ${userId} for period ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
    return true;
  } catch (error) {
      // Log before re-throwing
      logger.error(`Error in resetUsageLimits for user ${userId}:`, error);
      // Re-throw the original error or a new one
      if (error instanceof Error && error.message.startsWith('Cannot reset usage:')) {
          throw error; // Re-throw specific known errors
      }
      throw new Error(`Failed to reset usage limits for user ${userId}.`);
  }
};