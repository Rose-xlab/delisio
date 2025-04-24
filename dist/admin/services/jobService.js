"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJobPerformanceMetrics = exports.cancelJob = exports.retryJob = exports.getFailedJobs = exports.getQueueStats = exports.getAllQueueStats = void 0;
const queues_1 = require("../../queues");
const logger_1 = require("../../utils/logger");
// Map queue name to queue instance
const queueMap = {
    recipe: queues_1.recipeQueue,
    image: queues_1.imageQueue,
    chat: queues_1.chatQueue
};
/**
 * Get stats for all queues
 */
const getAllQueueStats = async () => {
    try {
        const recipeStats = await (0, exports.getQueueStats)('recipe');
        const imageStats = await (0, exports.getQueueStats)('image');
        const chatStats = await (0, exports.getQueueStats)('chat');
        return {
            recipe: recipeStats,
            image: imageStats,
            chat: chatStats
        };
    }
    catch (error) {
        logger_1.logger.error('Error getting all queue stats:', error);
        throw error;
    }
};
exports.getAllQueueStats = getAllQueueStats;
/**
 * Get stats for a specific queue
 */
const getQueueStats = async (queueName) => {
    try {
        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error(`Queue not found: ${queueName}`);
        }
        const jobCounts = await queue.getJobCounts();
        const { failed, active, completed, delayed, waiting, paused } = jobCounts;
        // Calculate health score (0-100)
        // Simple version: 100 - (failed jobs / (completed + active + 1) * 100)
        // Can be made more sophisticated
        const failureRate = failed / (completed + active + 1) * 100;
        const healthScore = Math.max(0, Math.min(100, 100 - failureRate));
        // Get recent throughput (jobs per minute)
        const now = Date.now();
        const oneMinuteAgo = now - 60 * 1000;
        const recentJobs = await queue.getJobs(['completed'], oneMinuteAgo, now);
        const throughputPerMinute = recentJobs.length;
        return {
            counts: {
                waiting: waiting || 0,
                active: active || 0,
                completed: completed || 0,
                failed: failed || 0,
                delayed: delayed || 0,
                paused: paused || 0,
                total: (waiting || 0) + (active || 0) + (completed || 0) + (failed || 0) + (delayed || 0) + (paused || 0)
            },
            health: {
                score: healthScore,
                status: healthScore > 90 ? 'healthy' : healthScore > 70 ? 'warning' : 'critical'
            },
            performance: {
                throughputPerMinute
            }
        };
    }
    catch (error) {
        logger_1.logger.error(`Error getting stats for queue ${queueName}:`, error);
        throw error;
    }
};
exports.getQueueStats = getQueueStats;
/**
 * Get failed jobs with pagination
 */
const getFailedJobs = async (filters) => {
    try {
        const { page, limit, queue } = filters;
        const skip = (page - 1) * limit;
        // If queue is 'all', get failed jobs from all queues
        if (queue === 'all') {
            const recipeFailedJobs = await getQueueFailedJobs('recipe', skip, limit);
            const imageFailedJobs = await getQueueFailedJobs('image', skip, limit);
            const chatFailedJobs = await getQueueFailedJobs('chat', skip, limit);
            // Combine and sort by failed time, descending
            const allJobs = [
                ...recipeFailedJobs.jobs.map(job => ({ ...job, queue: 'recipe' })),
                ...imageFailedJobs.jobs.map(job => ({ ...job, queue: 'image' })),
                ...chatFailedJobs.jobs.map(job => ({ ...job, queue: 'chat' }))
            ].sort((a, b) => (b.failedAt || 0) - (a.failedAt || 0));
            // Get total counts
            const totalFailed = recipeFailedJobs.total +
                imageFailedJobs.total +
                chatFailedJobs.total;
            // Paginate the combined result
            const paginatedJobs = allJobs.slice(0, limit);
            return {
                jobs: paginatedJobs,
                pagination: {
                    total: totalFailed,
                    page,
                    limit,
                    pages: Math.ceil(totalFailed / limit)
                }
            };
        }
        else {
            // Get failed jobs for a specific queue
            return await getQueueFailedJobs(queue, skip, limit);
        }
    }
    catch (error) {
        logger_1.logger.error('Error getting failed jobs:', error);
        throw error;
    }
};
exports.getFailedJobs = getFailedJobs;
/**
 * Get failed jobs for a specific queue
 */
const getQueueFailedJobs = async (queueName, skip, limit) => {
    try {
        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error(`Queue not found: ${queueName}`);
        }
        // Get failed job count
        const { failed } = await queue.getJobCounts();
        // Get failed jobs
        const failedJobs = await queue.getFailed(skip, skip + limit - 1);
        // Format jobs for display
        const formattedJobs = failedJobs.map(job => ({
            id: job.id || '',
            name: job.name,
            data: job.data,
            failedReason: job.failedReason,
            stacktrace: job.stacktrace,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
            finishedOn: job.finishedOn,
            processedOn: job.processedOn,
            failedAt: job.failedAt
        }));
        return {
            jobs: formattedJobs,
            pagination: {
                total: failed || 0,
                page: Math.floor(skip / limit) + 1,
                limit,
                pages: Math.ceil((failed || 0) / limit)
            }
        };
    }
    catch (error) {
        logger_1.logger.error(`Error getting failed jobs for queue ${queueName}:`, error);
        throw error;
    }
};
/**
 * Retry a failed job
 */
const retryJob = async (queueName, jobId) => {
    try {
        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error(`Queue not found: ${queueName}`);
        }
        // Get the job
        const job = await queue.getJob(jobId);
        if (!job) {
            throw new Error(`Job not found: ${jobId}`);
        }
        // Check if job is failed
        const state = await job.getState();
        if (state !== 'failed') {
            throw new Error(`Cannot retry job in state: ${state}`);
        }
        // Retry the job
        await job.retry();
        logger_1.logger.info(`Job ${jobId} in queue ${queueName} retried successfully`);
        return { success: true };
    }
    catch (error) {
        logger_1.logger.error(`Error retrying job ${jobId} in queue ${queueName}:`, error);
        throw error;
    }
};
exports.retryJob = retryJob;
/**
 * Cancel a job
 */
const cancelJob = async (queueName, jobId) => {
    try {
        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error(`Queue not found: ${queueName}`);
        }
        // Get the job
        const job = await queue.getJob(jobId);
        if (!job) {
            throw new Error(`Job not found: ${jobId}`);
        }
        // Check job state
        const state = await job.getState();
        // For active jobs, update data to mark as cancelled
        if (state === 'active') {
            // Update job data to add 'cancelled' flag
            await job.updateData({
                ...job.data,
                cancelled: true
            });
            logger_1.logger.info(`Active job ${jobId} in queue ${queueName} marked as cancelled`);
            return { success: true, message: 'Job marked as cancelled' };
        }
        // For waiting or delayed jobs, remove them
        if (state === 'waiting' || state === 'delayed') {
            await job.remove();
            logger_1.logger.info(`Job ${jobId} in queue ${queueName} removed successfully`);
            return { success: true, message: 'Job removed' };
        }
        // For completed or failed jobs, can't cancel
        throw new Error(`Cannot cancel job in state: ${state}`);
    }
    catch (error) {
        logger_1.logger.error(`Error cancelling job ${jobId} in queue ${queueName}:`, error);
        throw error;
    }
};
exports.cancelJob = cancelJob;
/**
 * Get job performance metrics
 */
const getJobPerformanceMetrics = async (queueName, period) => {
    try {
        // Determine period boundaries
        const now = Date.now();
        let startTime = now - 24 * 60 * 60 * 1000; // Default to 24 hours
        if (period.endsWith('h')) {
            const hours = parseInt(period);
            startTime = now - hours * 60 * 60 * 1000;
        }
        else if (period.endsWith('d')) {
            const days = parseInt(period);
            startTime = now - days * 24 * 60 * 60 * 1000;
        }
        // Process specific queue or all queues
        if (queueName === 'all') {
            const recipeMetrics = await getQueuePerformanceMetrics('recipe', startTime, now);
            const imageMetrics = await getQueuePerformanceMetrics('image', startTime, now);
            const chatMetrics = await getQueuePerformanceMetrics('chat', startTime, now);
            return {
                recipe: recipeMetrics,
                image: imageMetrics,
                chat: chatMetrics
            };
        }
        else {
            return await getQueuePerformanceMetrics(queueName, startTime, now);
        }
    }
    catch (error) {
        logger_1.logger.error(`Error getting job performance metrics for ${queueName}:`, error);
        throw error;
    }
};
exports.getJobPerformanceMetrics = getJobPerformanceMetrics;
/**
 * Get performance metrics for a specific queue
 */
const getQueuePerformanceMetrics = async (queueName, startTime, endTime) => {
    try {
        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error(`Queue not found: ${queueName}`);
        }
        // Get completed jobs in period
        const completedJobs = await queue.getJobs(['completed'], startTime, endTime);
        // Get failed jobs in period
        const failedJobs = await queue.getJobs(['failed'], startTime, endTime);
        // Calculate metrics
        let totalProcessingTime = 0;
        let processingTimeCount = 0;
        let totalWaitingTime = 0;
        let waitingTimeCount = 0;
        completedJobs.forEach(job => {
            if (job.processedOn && job.finishedOn) {
                totalProcessingTime += job.finishedOn - job.processedOn;
                processingTimeCount++;
            }
            if (job.timestamp && job.processedOn) {
                totalWaitingTime += job.processedOn - job.timestamp;
                waitingTimeCount++;
            }
        });
        // Compute averages
        const avgProcessingTime = processingTimeCount > 0 ? totalProcessingTime / processingTimeCount : 0;
        const avgWaitingTime = waitingTimeCount > 0 ? totalWaitingTime / waitingTimeCount : 0;
        // Calculate success rate
        const totalJobs = completedJobs.length + failedJobs.length;
        const successRate = totalJobs > 0 ? (completedJobs.length / totalJobs) * 100 : 100;
        // Calculate throughput (jobs per hour)
        const periodHours = (endTime - startTime) / (60 * 60 * 1000);
        const throughputPerHour = periodHours > 0 ? completedJobs.length / periodHours : 0;
        return {
            completed: completedJobs.length,
            failed: failedJobs.length,
            total: totalJobs,
            successRate: parseFloat(successRate.toFixed(2)),
            avgProcessingTimeMs: Math.round(avgProcessingTime),
            avgWaitingTimeMs: Math.round(avgWaitingTime),
            throughputPerHour: parseFloat(throughputPerHour.toFixed(2))
        };
    }
    catch (error) {
        logger_1.logger.error(`Error getting performance metrics for queue ${queueName}:`, error);
        throw error;
    }
};
//# sourceMappingURL=jobService.js.map