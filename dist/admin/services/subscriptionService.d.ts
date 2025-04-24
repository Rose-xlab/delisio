/**
 * Get subscription tiers overview
 */
export declare const getSubscriptionTiersOverview: () => Promise<{
    tiers: {
        free: {
            count: number;
            percentage: number;
        };
        basic: {
            count: number;
            percentage: number;
        };
        premium: {
            count: number;
            percentage: number;
        };
    };
    totalUsers: number;
}>;
/**
 * Get current month revenue
 */
export declare const getCurrentMonthRevenue: () => Promise<{
    currentMonth: number;
    previousMonth: number;
    growth: number;
}>;
/**
 * Get revenue metrics over a period
 */
export declare const getRevenueMetrics: (period: string) => Promise<{
    total: number;
    recurring: number;
    oneTime: number;
    refunds: number;
    byTier: {
        basic: number;
        premium: number;
    };
    trend: {
        month: string;
        revenue: number;
    }[];
}>;
/**
 * Get revenue trend over a period
 */
export declare const getRevenueTrend: (period: string) => Promise<{
    month: string;
    revenue: number;
}[]>;
/**
 * Get churn analysis
 */
export declare const getChurnAnalysis: (period: string) => Promise<{
    churnRate: number;
    canceledSubscriptions: number;
    totalSubscriptions: number;
    churnByTier: {
        basic: number;
        premium: number;
    };
    reasons: {
        reason: string;
        count: number;
    }[];
}>;
/**
 * Get conversion rates between tiers
 */
export declare const getConversionRates: () => Promise<{
    counts: {
        freeToBasic: number;
        freeToPremium: number;
        basicToPremium: number;
        premiumToBasic: number;
        basicToFree: number;
        premiumToFree: number;
        totalConversions: number;
    };
    percentages: {
        freeToBasic: number;
        freeToPremium: number;
        basicToPremium: number;
        premiumToBasic: number;
        basicToFree: number;
        premiumToFree: number;
    };
    totalUsers: number;
    totalConversions: number;
}>;
