/**
 * Get dashboard stats
 */
export declare const getDashboardStats: () => Promise<{
    activeUsers: number;
    totalUsers: number;
    recipeGenerationsToday: number;
    recipeGenerationsWeek: number;
    queueHealth: {
        recipe: {
            waiting: any;
            active: any;
            failed: any;
            delayed: any;
            completed: any;
        };
        image: {
            waiting: any;
            active: any;
            failed: any;
            delayed: any;
            completed: any;
        };
        chat: {
            waiting: any;
            active: any;
            failed: any;
            delayed: any;
            completed: any;
        };
    };
    errorCount: any;
    revenue: {
        currentMonth: number;
        previousMonth: number;
        growth: number;
    };
}>;
/**
 * Get dashboard trends for charts
 */
export declare const getDashboardTrends: (period: string) => Promise<{
    userGrowth: {
        period: string;
        new_users: number;
        cumulative_users: number;
    }[];
    recipeGenerations: {
        period: string;
        recipe_count: number;
    }[];
    revenue: {
        month: string;
        revenue: number;
    }[];
    errors: any;
}>;
