"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetUsageLimits = exports.updateSubscription = exports.getUserDetails = exports.getUsersList = void 0;
const supabase_1 = require("../../config/supabase");
const logger_1 = require("../../utils/logger");
const subscriptionService_1 = require("../../services/subscriptionService");
/**
 * Get list of users with pagination and filters
 */
const getUsersList = async (filters) => {
    try {
        // Start with base query
        let query = supabase_1.supabase
            .from('users')
            .select(`
        id,
        email,
        created_at,
        last_login,
        subscriptions(tier, status, current_period_end)
      `);
        // Apply search filter if provided
        if (filters.search) {
            query = query.or(`email.ilike.%${filters.search}%,id.eq.${filters.search}`);
        }
        // Apply tier filter if provided
        if (filters.tier) {
            query = query.eq('subscriptions.tier', filters.tier);
        }
        // Get total count first (for pagination)
        const countQuery = query.clone();
        const { count, error: countError } = await countQuery.count();
        if (countError) {
            logger_1.logger.error('Error counting users:', countError);
            throw new Error('Failed to count users');
        }
        // Apply sorting
        if (filters.sortBy === 'tier') {
            query = query.order('subscriptions.tier', { ascending: filters.sortDir === 'asc' });
        }
        else if (filters.sortBy === 'subscription_status') {
            query = query.order('subscriptions.status', { ascending: filters.sortDir === 'asc' });
        }
        else {
            // Default sort by created_at or other user fields
            query = query.order(filters.sortBy, { ascending: filters.sortDir === 'asc' });
        }
        // Apply pagination
        const from = (filters.page - 1) * filters.limit;
        const to = from + filters.limit - 1;
        query = query.range(from, to);
        // Execute query
        const { data, error } = await query;
        if (error) {
            logger_1.logger.error('Error fetching users:', error);
            throw new Error('Failed to fetch users');
        }
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
    }
    catch (error) {
        logger_1.logger.error('Error in getUsersList:', error);
        throw error;
    }
};
exports.getUsersList = getUsersList;
/**
 * Get detailed information about a user
 */
const getUserDetails = async (userId) => {
    try {
        // Get user info
        const { data: user, error: userError } = await supabase_1.supabase
            .from('users')
            .select(`
        *,
        subscriptions(*),
        user_preferences(*)
      `)
            .eq('id', userId)
            .single();
        if (userError) {
            logger_1.logger.error(`Error fetching user ${userId}:`, userError);
            throw new Error('Failed to fetch user details');
        }
        if (!user) {
            return null;
        }
        // Get user activity
        const { data: activity, error: activityError } = await supabase_1.supabase
            .from('user_activity')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (activityError) {
            logger_1.logger.error(`Error fetching activity for user ${userId}:`, activityError);
            // Don't throw - we can still return user without activity
        }
        // Get recipe count
        const { count: recipeCount, error: recipeError } = await supabase_1.supabase
            .from('recipes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
        if (recipeError) {
            logger_1.logger.error(`Error counting recipes for user ${userId}:`, recipeError);
            // Don't throw - we can still return user without recipe count
        }
        // Get favorite count
        const { count: favoriteCount, error: favoriteError } = await supabase_1.supabase
            .from('favorites')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
        if (favoriteError) {
            logger_1.logger.error(`Error counting favorites for user ${userId}:`, favoriteError);
            // Don't throw - we can still return user without favorite count
        }
        // Get usage data
        const { data: usage, error: usageError } = await supabase_1.supabase
            .from('recipe_usage')
            .select('*')
            .eq('user_id', userId)
            .order('period_start', { ascending: false })
            .limit(6);
        if (usageError) {
            logger_1.logger.error(`Error fetching usage for user ${userId}:`, usageError);
            // Don't throw - we can still return user without usage data
        }
        return {
            user,
            activity: activity || [],
            stats: {
                recipeCount: recipeCount || 0,
                favoriteCount: favoriteCount || 0
            },
            usage: usage || []
        };
    }
    catch (error) {
        logger_1.logger.error(`Error in getUserDetails for ${userId}:`, error);
        throw error;
    }
};
exports.getUserDetails = getUserDetails;
/**
 * Update a user's subscription
 */
const updateSubscription = async (userId, tier) => {
    try {
        // Check if user exists
        const { data: user, error: userError } = await supabase_1.supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();
        if (userError || !user) {
            logger_1.logger.error(`Error checking user ${userId} existence:`, userError);
            throw new Error('User not found');
        }
        // Check if user has a subscription
        const { data: subscription, error: subError } = await supabase_1.supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (subError && subError.code !== 'PGRST116') { // Ignore 'Row not found' error
            logger_1.logger.error(`Error checking subscription for user ${userId}:`, subError);
            throw new Error('Failed to check subscription status');
        }
        // Get current period dates
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        if (!subscription) {
            // Create new subscription if it doesn't exist
            const { error: createError } = await supabase_1.supabase
                .from('subscriptions')
                .insert({
                user_id: userId,
                tier: tier,
                status: 'active',
                current_period_start: now.toISOString(),
                current_period_end: periodEnd.toISOString(),
                cancel_at_period_end: false
            });
            if (createError) {
                logger_1.logger.error(`Error creating subscription for user ${userId}:`, createError);
                throw new Error('Failed to create subscription');
            }
        }
        else {
            // Update existing subscription
            const { error: updateError } = await supabase_1.supabase
                .from('subscriptions')
                .update({
                tier: tier,
                status: 'active', // Make sure it's active
                updated_at: now.toISOString()
            })
                .eq('user_id', userId);
            if (updateError) {
                logger_1.logger.error(`Error updating subscription for user ${userId}:`, updateError);
                throw new Error('Failed to update subscription');
            }
        }
        // Reset usage counter
        await (0, subscriptionService_1.resetUsageCounter)(userId, now, periodEnd);
        logger_1.logger.info(`Successfully updated subscription for user ${userId} to ${tier}`);
        return true;
    }
    catch (error) {
        logger_1.logger.error(`Error in updateSubscription for ${userId}:`, error);
        throw error;
    }
};
exports.updateSubscription = updateSubscription;
/**
 * Reset a user's usage limits
 */
const resetUsageLimits = async (userId) => {
    try {
        // Check if user exists
        const { data: user, error: userError } = await supabase_1.supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .single();
        if (userError || !user) {
            logger_1.logger.error(`Error checking user ${userId} existence:`, userError);
            throw new Error('User not found');
        }
        // Get current subscription to determine period dates
        const { data: subscription, error: subError } = await supabase_1.supabase
            .from('subscriptions')
            .select('current_period_start, current_period_end')
            .eq('user_id', userId)
            .single();
        if (subError) {
            logger_1.logger.error(`Error getting subscription for user ${userId}:`, subError);
            throw new Error('Failed to get subscription information');
        }
        if (!subscription) {
            throw new Error('User does not have an active subscription');
        }
        // Reset usage counter using the period from the subscription
        const periodStart = new Date(subscription.current_period_start);
        const periodEnd = new Date(subscription.current_period_end);
        await (0, subscriptionService_1.resetUsageCounter)(userId, periodStart, periodEnd);
        logger_1.logger.info(`Successfully reset usage limits for user ${userId}`);
        return true;
    }
    catch (error) {
        logger_1.logger.error(`Error in resetUsageLimits for ${userId}:`, error);
        throw error;
    }
};
exports.resetUsageLimits = resetUsageLimits;
//# sourceMappingURL=userService.js.map