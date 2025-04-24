/**
 * Get error trends from Sentry
 */
export declare const getSentryErrorTrends: (period: string) => Promise<any>;
/**
 * Get most frequent errors from Sentry
 */
export declare const getSentryFrequentErrors: (limit: number) => Promise<any>;
/**
 * Get user impact assessment from Sentry
 */
export declare const getSentryUserImpact: () => Promise<{
    totalUsersImpacted: any;
    percentageOfAllUsers: number;
    impactByComponent: {
        component: string;
        usersImpacted: number;
        percentage: number;
    }[];
}>;
/**
 * Get recent error count (last 24 hours)
 */
export declare const getRecentErrorCount: () => Promise<any>;
/**
 * Get error trend over a period
 */
export declare const getErrorTrend: (period: string) => Promise<any>;
