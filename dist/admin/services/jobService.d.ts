/**
 * Get stats for all queues
 */
export declare const getAllQueueStats: () => Promise<{
    recipe: {
        counts: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
            paused: number;
            total: number;
        };
        health: {
            score: number;
            status: string;
        };
        performance: {
            throughputPerMinute: number;
        };
    };
    image: {
        counts: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
            paused: number;
            total: number;
        };
        health: {
            score: number;
            status: string;
        };
        performance: {
            throughputPerMinute: number;
        };
    };
    chat: {
        counts: {
            waiting: number;
            active: number;
            completed: number;
            failed: number;
            delayed: number;
            paused: number;
            total: number;
        };
        health: {
            score: number;
            status: string;
        };
        performance: {
            throughputPerMinute: number;
        };
    };
}>;
/**
 * Get stats for a specific queue
 */
export declare const getQueueStats: (queueName: string) => Promise<{
    counts: {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        paused: number;
        total: number;
    };
    health: {
        score: number;
        status: string;
    };
    performance: {
        throughputPerMinute: number;
    };
}>;
/**
 * Get failed jobs with pagination
 */
export declare const getFailedJobs: (filters: {
    page: number;
    limit: number;
    queue: string;
}) => Promise<{
    jobs: {
        id: any;
        name: any;
        data: any;
        failedReason: any;
        stacktrace: any;
        attemptsMade: any;
        timestamp: any;
        finishedOn: any;
        processedOn: any;
        failedAt: any;
    }[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
} | {
    jobs: {
        queue: string;
        id: any;
        name: any;
        data: any;
        failedReason: any;
        stacktrace: any;
        attemptsMade: any;
        timestamp: any;
        finishedOn: any;
        processedOn: any;
        failedAt: any;
    }[];
    pagination: {
        total: any;
        page: number;
        limit: number;
        pages: number;
    };
}>;
/**
 * Retry a failed job
 */
export declare const retryJob: (queueName: string, jobId: string) => Promise<{
    success: boolean;
}>;
/**
 * Cancel a job
 */
export declare const cancelJob: (queueName: string, jobId: string) => Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Get job performance metrics
 */
export declare const getJobPerformanceMetrics: (queueName: string, period: string) => Promise<{
    completed: number;
    failed: number;
    total: number;
    successRate: number;
    avgProcessingTimeMs: number;
    avgWaitingTimeMs: number;
    throughputPerHour: number;
} | {
    recipe: {
        completed: number;
        failed: number;
        total: number;
        successRate: number;
        avgProcessingTimeMs: number;
        avgWaitingTimeMs: number;
        throughputPerHour: number;
    };
    image: {
        completed: number;
        failed: number;
        total: number;
        successRate: number;
        avgProcessingTimeMs: number;
        avgWaitingTimeMs: number;
        throughputPerHour: number;
    };
    chat: {
        completed: number;
        failed: number;
        total: number;
        successRate: number;
        avgProcessingTimeMs: number;
        avgWaitingTimeMs: number;
        throughputPerHour: number;
    };
}>;
