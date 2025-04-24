"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardTrends = exports.getDashboardStats = void 0;
const supabase_1 = require("../../config/supabase");
const logger_1 = require("../../utils/logger");
const queues_1 = require("../../queues");
const errorService = __importStar(require("./errorService"));
const subscriptionService = __importStar(require("./subscriptionService"));
// Helper: Convert period string to date
const getPeriodStartDate = (period) => {
    const now = new Date();
    const number = parseInt(period);
    const unit = period.slice(-1);
    switch (unit) {
        case 'd':
            return new Date(now.setDate(now.getDate() - number));
        case 'w':
            return new Date(now.setDate(now.getDate() - (number * 7)));
        case 'm':
            return new Date(now.setMonth(now.getMonth() - number));
        case 'y':
            return new Date(now.setFullYear(now.getFullYear() - number));
        default:
            return new Date(now.setDate(now.getDate() - 30)); // Default to 30 days
    }
};
/**
 * Get dashboard stats
 */
const getDashboardStats = async () => {
    try {
        // Get active users count (users active in the last 24 hours)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const { count: activeUsers, error: activeUsersError } = await supabase_1.supabase
            .from('user_activity')
            .select('*', { count: 'exact', head: true })
            .gt('last_active', yesterday.toISOString());
        if (activeUsersError) {
            logger_1.logger.error('Error getting active users count:', activeUsersError);
            throw new Error('Failed to fetch active users count');
        }
        // Get total users count
        const { count: totalUsers, error: totalUsersError } = await supabase_1.supabase
            .from('users')
            .select('*', { count: 'exact', head: true });
        if (totalUsersError) {
            logger_1.logger.error('Error getting total users count:', totalUsersError);
            throw new Error('Failed to fetch total users count');
        }
        // Get recipe generations count for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: recipeGenerationsToday, error: recipeGenTodayError } = await supabase_1.supabase
            .from('recipes')
            .select('*', { count: 'exact', head: true })
            .gt('created_at', today.toISOString());
        if (recipeGenTodayError) {
            logger_1.logger.error('Error getting today recipe generations count:', recipeGenTodayError);
            throw new Error('Failed to fetch today recipe generations count');
        }
        // Get recipe generations count for week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count: recipeGenerationsWeek, error: recipeGenWeekError } = await supabase_1.supabase
            .from('recipes')
            .select('*', { count: 'exact', head: true })
            .gt('created_at', weekAgo.toISOString());
        if (recipeGenWeekError) {
            logger_1.logger.error('Error getting weekly recipe generations count:', recipeGenWeekError);
            throw new Error('Failed to fetch weekly recipe generations count');
        }
        // Get queue health
        const recipeQueueCounts = await queues_1.recipeQueue.getJobCounts();
        const imageQueueCounts = await queues_1.imageQueue.getJobCounts();
        const chatQueueCounts = await queues_1.chatQueue.getJobCounts();
        const queueHealth = {
            recipe: {
                waiting: recipeQueueCounts.waiting || 0,
                active: recipeQueueCounts.active || 0,
                failed: recipeQueueCounts.failed || 0,
                delayed: recipeQueueCounts.delayed || 0,
                completed: recipeQueueCounts.completed || 0
            },
            image: {
                waiting: imageQueueCounts.waiting || 0,
                active: imageQueueCounts.active || 0,
                failed: imageQueueCounts.failed || 0,
                delayed: imageQueueCounts.delayed || 0,
                completed: imageQueueCounts.completed || 0
            },
            chat: {
                waiting: chatQueueCounts.waiting || 0,
                active: chatQueueCounts.active || 0,
                failed: chatQueueCounts.failed || 0,
                delayed: chatQueueCounts.delayed || 0,
                completed: chatQueueCounts.completed || 0
            }
        };
        // Get error count for last 24h
        const errorCount = await errorService.getRecentErrorCount();
        // Get subscription revenue
        const revenue = await subscriptionService.getCurrentMonthRevenue();
        return {
            activeUsers: activeUsers || 0,
            totalUsers: totalUsers || 0,
            recipeGenerationsToday: recipeGenerationsToday || 0,
            recipeGenerationsWeek: recipeGenerationsWeek || 0,
            queueHealth,
            errorCount,
            revenue
        };
    }
    catch (error) {
        logger_1.logger.error('Error in getDashboardStats:', error);
        throw error;
    }
};
exports.getDashboardStats = getDashboardStats;
/**
 * Get dashboard trends for charts
 */
const getDashboardTrends = async (period) => {
    try {
        const startDate = getPeriodStartDate(period);
        const startDateIso = startDate.toISOString();
        // For daily grouping
        const intervalUnit = period.endsWith('d') && parseInt(period) <= 60 ? 'day' :
            period.endsWith('w') && parseInt(period) <= 12 ? 'day' :
                period.endsWith('m') && parseInt(period) <= 6 ? 'day' : 'week';
        // Get user growth trend
        const { data: userGrowth, error: userGrowthError } = await supabase_1.supabase.rpc('get_user_growth_trend', {
            p_start_date: startDateIso,
            p_interval: intervalUnit
        });
        if (userGrowthError) {
            logger_1.logger.error('Error getting user growth trend:', userGrowthError);
            throw new Error('Failed to fetch user growth trend');
        }
        // Get recipe generation trend
        const { data: recipeGenerations, error: recipeGenError } = await supabase_1.supabase.rpc('get_recipe_generation_trend', {
            p_start_date: startDateIso,
            p_interval: intervalUnit
        });
        if (recipeGenError) {
            logger_1.logger.error('Error getting recipe generation trend:', recipeGenError);
            throw new Error('Failed to fetch recipe generation trend');
        }
        // Get subscription revenue trend
        const revenueTrend = await subscriptionService.getRevenueTrend(period);
        // Get error trend
        const errorTrend = await errorService.getErrorTrend(period);
        return {
            userGrowth: userGrowth || [],
            recipeGenerations: recipeGenerations || [],
            revenue: revenueTrend,
            errors: errorTrend
        };
    }
    catch (error) {
        logger_1.logger.error('Error in getDashboardTrends:', error);
        throw error;
    }
};
exports.getDashboardTrends = getDashboardTrends;
//# sourceMappingURL=dashboardService.js.map