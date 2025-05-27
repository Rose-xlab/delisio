// src/admin/services/userService.ts
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { resetUsageCounter } from '../../services/subscriptionService';
import { Database, Tables as SupabaseTables, TablesInsert, TablesUpdate } from '../../types/supabase'; // Ensure this path is correct

import { SubscriptionTier as ModelSubscriptionTier, SubscriptionStatus as ModelSubscriptionStatus } from '../../models/Subscription';

// Specific types based on your Database definition
type AuthUserRow = Database['auth']['Tables']['users']['Row'];
type PublicSubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];
type PublicUserPreferencesRow = Database['public']['Tables']['user_preferences']['Row'];

interface FetchedUserDetailsData extends AuthUserRow {
  subscriptions: PublicSubscriptionRow | PublicSubscriptionRow[] | null;
  user_preferences: PublicUserPreferencesRow | PublicUserPreferencesRow[] | null;
}

interface UserListItem {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  name?: string | null;
  subscription?: {
    tier: string | null;
    status: string | null;
    current_period_end: string | null;
  } | null;
}

export const getUsersList = async (filters: { /* ... */ }) => { /* ... (Implementation from response #60) ... */ };
export const getUserDetails = async (userId: string): Promise<any | null> => { /* ... (Implementation from response #60) ... */ };

// Use the specific Insert and Update types from supabase.ts
type SubscriptionInsertPayload = TablesInsert<'subscriptions'>;
type SubscriptionUpdatePayload = Partial<TablesUpdate<'subscriptions'>>; // Partial because not all fields are always updated

export const updateSubscription = async (
    userId: string,
    tier: ModelSubscriptionTier, // Expecting mapped model tier
    status?: ModelSubscriptionStatus,
    currentPeriodStartStr?: string | null,
    currentPeriodEndStr?: string | null,
    cancelAtEnd?: boolean
) => {
  try {
    const now = new Date();

    const { data: existingSubscription, error: subCheckError } = await supabase
        .from('subscriptions')
        .select('id, current_period_start, current_period_end')
        .eq('user_id', userId)
        .maybeSingle<PublicSubscriptionRow>();

    if (subCheckError) {
        logger.error(`Error checking existing subscription for user ${userId} during admin update:`, subCheckError);
        throw new Error('Failed to check existing subscription status');
    }

    let finalPeriodStart: Date | null = null;
    let finalPeriodEnd: Date | null = null;
    let operationSuccessful = false;

    if (existingSubscription) {
        logger.info(`Admin: Updating existing subscription for user ${userId} to tier ${tier}`);
        const updatePayload: SubscriptionUpdatePayload = { // Use specific Update type
          tier: tier,
          updated_at: now.toISOString(),
        };
        if (status) updatePayload.status = status;
        if (currentPeriodStartStr !== undefined) updatePayload.current_period_start = currentPeriodStartStr ? new Date(currentPeriodStartStr).toISOString() : null;
        if (currentPeriodEndStr !== undefined) updatePayload.current_period_end = currentPeriodEndStr ? new Date(currentPeriodEndStr).toISOString() : null;
        if (cancelAtEnd !== undefined) updatePayload.cancel_at_period_end = cancelAtEnd;

        const { error: updateError } = await supabase.from('subscriptions').update(updatePayload).eq('user_id', userId);
        if (updateError) {
            logger.error(`Error updating subscription for user ${userId} (admin):`, updateError);
            throw new Error('Failed to update subscription');
        }
        finalPeriodStart = updatePayload.current_period_start ? new Date(updatePayload.current_period_start) : (existingSubscription.current_period_start ? new Date(existingSubscription.current_period_start) : null) ;
        finalPeriodEnd = updatePayload.current_period_end ? new Date(updatePayload.current_period_end) : (existingSubscription.current_period_end ? new Date(existingSubscription.current_period_end) : null);
        operationSuccessful = true;
    } else {
        logger.info(`Admin: No existing subscription for user ${userId}. Creating new one with tier ${tier}`);
        // Construct the payload strictly according to TablesInsert<'subscriptions'>
        // Fields like 'id', 'created_at', 'updated_at' should be optional in TablesInsert if DB handles them.
        // stripe_customer_id and stripe_subscription_id are also optional.
        const insertPayload: SubscriptionInsertPayload = {
            user_id: userId,
            tier: tier,
            status: status || 'active', // Default to 'active' if status not provided for new sub
            // Provide non-null dates if your DB schema for Insert requires them and they don't have defaults.
            // Your latest supabase.ts shows current_period_start/end as string | null for Insert.
            current_period_start: currentPeriodStartStr ? new Date(currentPeriodStartStr).toISOString() : now.toISOString(),
            current_period_end: currentPeriodEndStr ? new Date(currentPeriodEndStr).toISOString() : new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
            cancel_at_period_end: cancelAtEnd !== undefined ? cancelAtEnd : false,
            // No need to specify id, created_at, updated_at if DB auto-generates/handles them
        };
        const { error: createError } = await supabase.from('subscriptions').insert(insertPayload);
        if (createError) {
            logger.error(`Error creating subscription for user ${userId} (admin):`, createError);
            if (createError.code === '23503') { throw new Error(`Cannot create subscription: User with ID ${userId} does not exist or other FK violation.`); }
            throw new Error(`Failed to create subscription: ${createError.message}`);
        }
        // Type assertion needed as insertPayload dates are string|null but we expect string for Date constructor after default
        finalPeriodStart = new Date(insertPayload.current_period_start!);
        finalPeriodEnd = new Date(insertPayload.current_period_end!);
        operationSuccessful = true;
    }
    
    if (operationSuccessful && finalPeriodStart && finalPeriodEnd) {
        await resetUsageCounter(userId, finalPeriodStart, finalPeriodEnd);
        logger.info(`Admin: Successfully reset usage counter for user ${userId}`);
    } else if (operationSuccessful) {
        logger.warn(`Admin: Not resetting usage counter for user ${userId} due to missing period dates after update/insert.`);
    }
    return true;

  } catch (error) {
    logger.error(`Error in updateSubscription (admin) for user ${userId} with tier ${tier}:`, error);
    throw error;
  }
};

export const resetUsageLimits = async (userId: string) => { /* ... (Implementation from response #60) ... */ return true;};