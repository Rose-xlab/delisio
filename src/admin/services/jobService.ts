import { Queue, QueueEvents, Job } from 'bullmq'; // Import Job type
import { recipeQueue, imageQueue, chatQueue } from '../../queues';
// import { redisClient } from '../../config/redis'; // redisClient seems unused here
import { logger } from '../../utils/logger';

// Map queue name to queue instance
const queueMap: Record<string, Queue> = {
  recipe: recipeQueue,
  image: imageQueue,
  chat: chatQueue
};

// Define a type for the formatted job (optional but good practice)
interface FormattedJob {
    id: string;
    name: string;
    data: any;
    failedReason: string | undefined;
    stacktrace: string[] | undefined;
    attemptsMade: number;
    timestamp: number | undefined;
    finishedOn: number | undefined;
    processedOn: number | undefined;
    failedAt: number | undefined; // Added failedAt based on usage
    queue?: string; // Add queue name when combining
}


/**
 * Get stats for all queues
 */
export const getAllQueueStats = async () => {
  try {
    const recipeStats = await getQueueStats('recipe');
    const imageStats = await getQueueStats('image');
    const chatStats = await getQueueStats('chat');

    return {
      recipe: recipeStats,
      image: imageStats,
      chat: chatStats
    };
  } catch (error) {
    logger.error('Error getting all queue stats:', error);
    throw error;
  }
};

/**
 * Get stats for a specific queue
 */
export const getQueueStats = async (queueName: string) => {
  try {
    const queue = queueMap[queueName];

    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const jobCounts = await queue.getJobCounts();
    // Use default 0 if count is undefined/null
    const waiting = jobCounts.waiting ?? 0;
    const active = jobCounts.active ?? 0;
    const completed = jobCounts.completed ?? 0;
    const failed = jobCounts.failed ?? 0;
    const delayed = jobCounts.delayed ?? 0;
    const paused = jobCounts.paused ?? 0;

    // Calculate health score (0-100)
    const totalProcessedOrActive = completed + active + failed; // Base for failure rate calculation
    const failureRate = totalProcessedOrActive > 0 ? (failed / totalProcessedOrActive) * 100 : 0;
    const healthScore = Math.max(0, Math.min(100, Math.round(100 - failureRate)));

    // Get recent throughput (jobs per minute) - Requires Job type for finishedOn
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // Get completed jobs within the last minute
    // Note: getJobs can be potentially slow on very large queues.
    // Consider alternative monitoring if performance becomes an issue.
    const recentCompletedJobs: Job[] = await queue.getJobs(['completed'], 0, -1, true); // Fetch completed ascending
    const throughputPerMinute = recentCompletedJobs.filter(job => job.finishedOn && job.finishedOn >= oneMinuteAgo).length;


    return {
      counts: {
        waiting: waiting,
        active: active,
        completed: completed,
        failed: failed,
        delayed: delayed,
        paused: paused,
        total: waiting + active + completed + failed + delayed + paused
      },
      health: {
        score: healthScore,
        status: healthScore > 90 ? 'healthy' : healthScore > 70 ? 'warning' : 'critical'
      },
      performance: {
        throughputPerMinute
      }
    };
  } catch (error) {
    logger.error(`Error getting stats for queue ${queueName}:`, error);
    throw error;
  }
};

/**
 * Get failed jobs with pagination
 */
export const getFailedJobs = async (filters: {
  page: number;
  limit: number;
  queue: string;
}) => {
  try {
    const { page, limit, queue: queueFilter } = filters; // Rename queue to avoid conflict
    const skip = (page - 1) * limit;

    // If queue is 'all', get failed jobs from all queues
    if (queueFilter === 'all') {
        // Fetch results from all queues concurrently
        const [recipeFailedJobs, imageFailedJobs, chatFailedJobs] = await Promise.all([
            getQueueFailedJobs('recipe', 0, -1), // Fetch all failed initially for sorting
            getQueueFailedJobs('image', 0, -1),
            getQueueFailedJobs('chat', 0, -1)
        ]);

        // Combine and sort by failed time (most recent first)
        const allJobs: FormattedJob[] = [
            ...recipeFailedJobs.jobs.map(job => ({ ...job, queue: 'recipe' })),
            ...imageFailedJobs.jobs.map(job => ({ ...job, queue: 'image' })),
            ...chatFailedJobs.jobs.map(job => ({ ...job, queue: 'chat' }))
        ].sort((a, b) => (b.failedAt || 0) - (a.failedAt || 0)); // Use failedAt for sorting

        // Get total counts
        const totalFailed =
            recipeFailedJobs.pagination.total +  // <-- FIX: Access total via pagination
            imageFailedJobs.pagination.total +   // <-- FIX: Access total via pagination
            chatFailedJobs.pagination.total;     // <-- FIX: Access total via pagination

        // Paginate the combined & sorted result *after* combining
        const paginatedJobs = allJobs.slice(skip, skip + limit);

        return {
            jobs: paginatedJobs,
            pagination: {
                total: totalFailed,
                page,
                limit,
                pages: Math.ceil(totalFailed / limit)
            }
        };
    } else {
      // Get failed jobs for a specific queue with pagination applied directly
      const queue = queueMap[queueFilter];
      if (!queue) {
          throw new Error(`Queue not found: ${queueFilter}`);
      }
       // Get failed job count for the specific queue
      const { failed } = await queue.getJobCounts();
      const totalFailed = failed ?? 0;

      // Get failed jobs for the specific page
      const failedJobs = await queue.getFailed(skip, skip + limit - 1);

      const formattedJobs = formatJobs(failedJobs); // Use helper

      return {
          jobs: formattedJobs,
          pagination: {
              total: totalFailed,
              page,
              limit,
              pages: Math.ceil(totalFailed / limit)
          }
      };
    }
  } catch (error) {
    logger.error('Error getting failed jobs:', error);
    throw error;
  }
};

/**
 * Helper to get and format failed jobs for a specific queue.
 * Fetches a specific range if skip/limit are positive, otherwise fetches all.
 */
const getQueueFailedJobs = async (queueName: string, skip: number, limit: number): Promise<{ jobs: FormattedJob[], pagination: { total: number, page: number, limit: number, pages: number } }> => {
    try {
        const queue = queueMap[queueName];
        if (!queue) {
            throw new Error(`Queue not found: ${queueName}`);
        }

        const { failed } = await queue.getJobCounts();
        const totalFailed = failed ?? 0;

        // Determine range: fetch all if limit is negative (for combining later)
        const start = skip < 0 ? 0 : skip;
        const end = limit < 0 ? -1 : skip + limit - 1;

        const failedJobs = await queue.getFailed(start, end);
        const formattedJobs = formatJobs(failedJobs); // Use helper

        // Calculate pagination info based on requested skip/limit
        const currentPage = limit <= 0 ? 1 : Math.floor(skip / limit) + 1;
        const pages = limit <= 0 ? 1 : Math.ceil(totalFailed / limit);

        return {
            jobs: formattedJobs,
            pagination: {
                total: totalFailed,
                page: currentPage,
                limit: limit <= 0 ? totalFailed : limit, // Adjust limit if fetching all
                pages: pages
            }
        };
    } catch (error) {
        logger.error(`Error getting failed jobs for queue ${queueName}:`, error);
        // Re-throw or return an empty structure
        throw error;
        // return { jobs: [], pagination: { total: 0, page: 1, limit: limit > 0 ? limit: 0, pages: 0 } };
    }
};

// Helper function to format BullMQ jobs
const formatJobs = (jobs: Job[]): FormattedJob[] => {
    return jobs.map(job => ({
        id: job.id || '', // Ensure ID is always a string
        name: job.name,
        data: job.data, // Be mindful of potentially large data payloads
        failedReason: job.failedReason || undefined, // Default to undefined
        stacktrace: job.stacktrace || undefined, // Default to undefined
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp, // When the job was created
        finishedOn: job.finishedOn, // When the job finished (completed or failed)
        processedOn: job.processedOn, // When the job started processing
        failedAt: job.finishedOn // Assuming finishedOn is the failure time for failed jobs
    }));
}

/**
 * Retry a failed job
 */
export const retryJob = async (queueName: string, jobId: string) => {
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

    logger.info(`Job ${jobId} in queue ${queueName} retried successfully`);
    return { success: true };
  } catch (error: any) { // Catch specific error types if needed
    logger.error(`Error retrying job ${jobId} in queue ${queueName}:`, error);
    // Rethrow or return error details
    throw error;
    // return { success: false, message: error.message };
  }
};

/**
 * Cancel a waiting or delayed job, or mark an active job for cancellation
 */
export const cancelJob = async (queueName: string, jobId: string) => {
  try {
    const queue = queueMap[queueName];

    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const state = await job.getState();

    // For active jobs, update data to mark as cancelled (worker needs to check this flag)
    if (state === 'active') {
      // Add or update a 'cancelled' flag in the job data
      const currentData = job.data || {};
      await job.updateData({
        ...currentData,
        cancelled: true, // Worker should check for this flag
        cancelledAt: Date.now() // Optional: add timestamp
      });

      logger.info(`Active job ${jobId} in queue ${queueName} marked as cancelled. Worker must handle the flag.`);
      // Note: This doesn't stop the *current* execution, the worker needs logic for it.
      return { success: true, message: 'Job marked as cancelled (worker must check flag)' };
    }

    // For waiting or delayed jobs, remove them directly
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      logger.info(`Job ${jobId} in queue ${queueName} removed successfully (was ${state})`);
      return { success: true, message: `Job removed from ${state} state` };
    }

    // For completed or failed jobs, cancellation doesn't apply
    throw new Error(`Cannot cancel job in state: ${state}`);
  } catch (error: any) {
    logger.error(`Error cancelling job ${jobId} in queue ${queueName}:`, error);
    throw error;
    // return { success: false, message: error.message };
  }
};

/**
 * Get job performance metrics aggregated or for a specific queue
 */
export const getJobPerformanceMetrics = async (queueNameFilter: string, period: string) => {
  try {
    // Determine period boundaries
    const now = Date.now();
    let startTime = now - 24 * 60 * 60 * 1000; // Default to 24 hours
    const periodMatch = period.match(/^(\d+)([dh])$/); // Match hours or days

    if (periodMatch) {
        const value = parseInt(periodMatch[1]);
        const unit = periodMatch[2];
        if (unit === 'h') startTime = now - value * 60 * 60 * 1000;
        else if (unit === 'd') startTime = now - value * 24 * 60 * 60 * 1000;
    } else {
        logger.warn(`Invalid period format '${period}' for performance metrics. Defaulting to 24h.`);
    }

    // Process specific queue or all queues
    if (queueNameFilter === 'all') {
        const [recipeMetrics, imageMetrics, chatMetrics] = await Promise.all([
            getQueuePerformanceMetrics('recipe', startTime, now),
            getQueuePerformanceMetrics('image', startTime, now),
            getQueuePerformanceMetrics('chat', startTime, now)
        ]);

        // Optionally aggregate or return separately
        return {
            recipe: recipeMetrics,
            image: imageMetrics,
            chat: chatMetrics
            // Add aggregated metrics if needed
        };
    } else {
        if (!queueMap[queueNameFilter]) {
            throw new Error(`Queue not found: ${queueNameFilter}`);
        }
        return await getQueuePerformanceMetrics(queueNameFilter, startTime, now);
    }
  } catch (error) {
    logger.error(`Error getting job performance metrics for ${queueNameFilter}:`, error);
    throw error;
  }
};

/**
 * Helper to get performance metrics for a specific queue
 */
const getQueuePerformanceMetrics = async (queueName: string, startTime: number, endTime: number) => {
  try {
    const queue = queueMap[queueName];
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    // Get completed jobs in period - fetch necessary fields
    // Fetching all jobs and then filtering can be inefficient for long periods/large queues.
    // Consider if BullMQ Pro/Enterprise features or alternative sampling methods are needed for scale.
    const completedJobs: Job[] = await queue.getJobs(['completed'], 0, -1, true); // Fetch all completed, ascending order
    const failedJobs: Job[] = await queue.getJobs(['failed'], 0, -1, true); // Fetch all failed, ascending order

    // Filter jobs within the specified time period based on when they finished
    const completedInPeriod = completedJobs.filter(job => job.finishedOn && job.finishedOn >= startTime && job.finishedOn <= endTime);
    const failedInPeriod = failedJobs.filter(job => job.finishedOn && job.finishedOn >= startTime && job.finishedOn <= endTime);

    // Calculate metrics from filtered jobs
    let totalProcessingTimeMs = 0;
    let processingTimeCount = 0;
    let totalWaitingTimeMs = 0;
    let waitingTimeCount = 0;

    completedInPeriod.forEach(job => {
      // Processing time: time between start processing and finish
      if (job.processedOn && job.finishedOn) {
        totalProcessingTimeMs += (job.finishedOn - job.processedOn);
        processingTimeCount++;
      }
      // Waiting time: time between creation and start processing
      if (job.timestamp && job.processedOn) {
        totalWaitingTimeMs += (job.processedOn - job.timestamp);
        waitingTimeCount++;
      }
    });

    // Compute averages safely
    const avgProcessingTimeMs = processingTimeCount > 0 ? Math.round(totalProcessingTimeMs / processingTimeCount) : 0;
    const avgWaitingTimeMs = waitingTimeCount > 0 ? Math.round(totalWaitingTimeMs / waitingTimeCount) : 0;

    // Calculate success rate
    const totalFinishedInPeriod = completedInPeriod.length + failedInPeriod.length;
    const successRate = totalFinishedInPeriod > 0 ? (completedInPeriod.length / totalFinishedInPeriod) * 100 : 100;

    // Calculate throughput (jobs per hour)
    const periodHours = (endTime - startTime) / (1000 * 60 * 60); // Use milliseconds for division
    const throughputPerHour = periodHours > 0 ? completedInPeriod.length / periodHours : 0;

    return {
      completed: completedInPeriod.length,
      failed: failedInPeriod.length,
      total: totalFinishedInPeriod,
      successRate: parseFloat(successRate.toFixed(2)),
      avgProcessingTimeMs: avgProcessingTimeMs,
      avgWaitingTimeMs: avgWaitingTimeMs,
      throughputPerHour: parseFloat(throughputPerHour.toFixed(2))
    };
  } catch (error) {
    logger.error(`Error getting performance metrics for queue ${queueName}:`, error);
    // Return a default structure on error
    return {
        completed: 0, failed: 0, total: 0, successRate: 0,
        avgProcessingTimeMs: 0, avgWaitingTimeMs: 0, throughputPerHour: 0
    };
  }
};