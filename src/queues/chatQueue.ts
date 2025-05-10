//C:\Users\mukas\Downloads\delisio\delisio\src\queues\chatQueue.ts

import { Queue, Worker, Job, JobProgress} from 'bullmq';
import { redisClient } from '../config/redis';
import { generateChatResponse } from '../services/gptService';
import { logger } from '../utils/logger';
// Import Sentry if you intend to use it directly in worker event handlers
// import * as Sentry from '@sentry/node'; // Or your custom Sentry wrapper

// Interface for chat message history item
interface MessageHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

// Interface for chat job data
export interface ChatJobData {
  message: string;
  conversationId: string;
  messageHistory?: MessageHistoryItem[];
  userId?: string;
}

// Interface for chat job result
// This is what the worker's processor function MUST return.
export interface ChatJobResult {
  reply: string;          // User-facing reply, even if it's an apology/error message
  suggestions?: string[] | null;
  error?: string;         // Technical error message/code for logging or backend use
}

// Connection options - optimized for cloud Redis
const CONNECTION_OPTIONS = {
  connection: redisClient,
  prefix: 'delisio_chat_', // Ensure this matches any worker prefix if set separately
};

// Create chat message queue
export const chatQueue = new Queue<ChatJobData, ChatJobResult, 'process-message'>(
  'chat-messages', // This is the Queue's name
  {
    ...CONNECTION_OPTIONS,
    defaultJobOptions: {
      removeOnComplete: 100, // Number of jobs to keep
      removeOnFail: 500,    // Number of jobs to keep
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000, // Start with 2 seconds for backoff
      },
    }
  }
);

// Create a worker to process chat messages
const chatWorker = new Worker<ChatJobData, ChatJobResult, 'process-message'>(
  'chat-messages', // Must match the Queue's name
  async (job: Job<ChatJobData, ChatJobResult, 'process-message'>): Promise<ChatJobResult> => {
    logger.info(`[ChatWorker_JobProcessing] Job ${job.id} ENTERED. Attempts: ${job.attemptsMade}/${job.opts.attempts}. Data:`, { conversationId: job.data.conversationId, messageLength: job.data.message.length });
    const { message, conversationId, messageHistory } = job.data;
    const startTime = Date.now();

    try {
      await job.updateProgress(10); // Indicate start of processing

      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: Calling generateChatResponse...`);
      const callStartTime = Date.now();
      // generateChatResponse is expected to ALWAYS return a JSON string.
      // If generateChatResponse itself has an error (e.g., OpenAI API down),
      // it should catch it and return a JSON string like:
      // JSON.stringify({ reply: "Sorry, AI service unavailable", error: "AI_SERVICE_DOWN", suggestions: null })
      const chatJsonResponseString = await generateChatResponse(message, messageHistory);
      const callEndTime = Date.now();
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: generateChatResponse returned. Duration: ${callEndTime - callStartTime}ms`);

      // --- CRUCIAL LOGGING LINE ---
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: RAW chatJsonResponseString received:`, { rawResponse: chatJsonResponseString });
      // --- END CRUCIAL LOGGING LINE ---

      await job.updateProgress(80); // Indicate response received, starting parse

      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: Parsing response...`);
      let responseData: Partial<ChatJobResult>; // Use Partial as we are constructing it

      try {
        responseData = JSON.parse(chatJsonResponseString);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        logger.error(`[ChatWorker_JobProcessing] Job ${job.id}: Failed to parse JSON response from gptService. This is unexpected if gptService guarantees JSON string.`, {
          error: errorMessage,
          rawResponse: chatJsonResponseString,
          stack: parseError instanceof Error ? parseError.stack : undefined
        });
        // Return a structured error that conforms to ChatJobResult
        return {
          reply: "I'm sorry, I received an unreadable response from the AI. Please try again later.",
          error: `FATAL_PARSE_ERROR_IN_WORKER: ${errorMessage}`, // Technical error
          suggestions: null,
        };
      }
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: Response parsed successfully.`);

      // Validate the structure of responseData (which should be what gptService returned)
      if (typeof responseData.reply !== 'string') {
        logger.error(`[ChatWorker_JobProcessing] Job ${job.id}: Invalid chat response format from gptService. 'reply' is missing or not a string.`, { responseData });
        // Even if reply is missing, gptService might have put an error message in responseData.error
        // The user-facing reply should still be an apology.
        return {
          reply: responseData.reply || "I'm sorry, the AI's response was not in the expected format. Please try again later.",
          error: responseData.error || 'INVALID_REPLY_FIELD_FROM_GPTSERVICE', // Technical error
          suggestions: (Array.isArray(responseData.suggestions) ? responseData.suggestions : null),
        };
      }

      // If responseData.error is already set by gptService, it will be passed through.
      // This means gptService handled an error and created a user-facing reply + technical error.
      if (responseData.error) {
        logger.warn(`[ChatWorker_JobProcessing] Job ${job.id}: gptService returned a response with a technical error field: '${responseData.error}'. User will see: "${responseData.reply}"`);
      }

      await job.updateProgress(100); // Indicate processing complete
      const endTime = Date.now();
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: COMPLETED SUCCESSFULLY. Total Duration: ${endTime - startTime}ms`);

      return {
        reply: responseData.reply, // This is the user-facing reply
        suggestions: Array.isArray(responseData.suggestions) ? responseData.suggestions : null,
        error: responseData.error, // Pass through technical error from gptService, if any
      };

    } catch (error) {
      // This catch block is for truly unexpected errors within this worker's try block,
      // NOT for errors handled and returned as JSON by gptService.
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[ChatWorker_JobProcessing] Job ${job.id}: CRITICAL UNEXPECTED error during processing. Total Duration: ${endTime - startTime}ms`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        jobData: job.data
      });
      // This will cause the job to fail in BullMQ if not caught, or be returned if caught by BullMQ's own mechanisms.
      // We must return ChatJobResult structure.
      return {
        reply: `I'm sorry, an unexpected internal error occurred while processing your message. Please try again.`,
        error: `UNEXPECTED_WORKER_ERROR: ${errorMessage}`, // Technical error
        suggestions: null,
      };
    }
  },
  { // Worker Options
    connection: redisClient,
    prefix: CONNECTION_OPTIONS.prefix,
    concurrency: process.env.CHAT_WORKER_CONCURRENCY ? parseInt(process.env.CHAT_WORKER_CONCURRENCY, 10) : 3,
    stalledInterval: 30000, // How often to check for stalled jobs
    lockDuration: 60000,    // Max time a job can be locked (must be longer than expected job processing time)
    lockRenewTime: 30000,   // Renew lock halfway through duration
  }
);

// --- Worker Event Handlers ---
// These log events related to the worker's lifecycle and job outcomes.

chatWorker.on('completed', (job: Job<ChatJobData, ChatJobResult, 'process-message'>, result: ChatJobResult) => {
  // This event fires when the async processor function returns a value (our ChatJobResult).
  if (result.error) { // Check for the technical error field we defined in ChatJobResult
    logger.warn(`[ChatWorker_Event:'completed'] Job ${job.id} (attempt ${job.attemptsMade}) completed with a handled technical error: '${result.error}'. User saw: "${result.reply}"`);
  } else {
    logger.info(`[ChatWorker_Event:'completed'] Job ${job.id} (attempt ${job.attemptsMade}) completed successfully. User saw: "${result.reply}"`);
  }
});

chatWorker.on('failed', (job: Job<ChatJobData, ChatJobResult, 'process-message'> | undefined, error: Error) => {
  // This event fires if the job processor throws an unhandled exception,
  // or if the job exceeds its `attempts` count, or times out based on `lockDuration`.
  // `job.failedReason` will contain the error message from the last failed attempt.
  // `error` argument is the error from the last attempt.
  if (job) {
    logger.error(`[ChatWorker_Event:'failed'] Job ${job.id} (name: ${job.name}, attemptsMade: ${job.attemptsMade}/${job.opts.attempts}) FAILED. Reason: ${job.failedReason || error.message}`, {
      jobData: job.data,
      stack: job.stacktrace ? job.stacktrace.join('\n') : error.stack, // Prefer job.stacktrace if available
    });
    // Sentry.captureException(error, { extra: { jobId: job.id, jobName: job.name, jobData: job.data, failedReason: job.failedReason, attemptsMade: job.attemptsMade } });
  } else {
    // This case is less common for 'failed' but good to have
    logger.error(`[ChatWorker_Event:'failed'] A job FAILED but job details are unavailable. Error: ${error.message}`, {
      stack: error.stack,
    });
    // Sentry.captureException(error, { extra: { message: "Job details unavailable in 'failed' event" } });
  }
});

chatWorker.on('error', (error: Error) => {
  // This event is for errors on the Worker instance itself (e.g., Redis connection lost after initial connect).
  // It's not tied to a specific job.
  logger.error(`[ChatWorker_Event:'error'] Chat worker instance encountered an error: ${error.message}`, {
    stack: error.stack,
  });
  // Sentry.captureException(error, { extra: { context: "Worker instance error" } });
});

chatWorker.on('ready', () => {
  logger.info('[ChatWorker_Event:\'ready\'] Chat queue worker process connected to Redis and ready to process jobs.');
});

chatWorker.on('closing', (msg: string) => {
  logger.warn(`[ChatWorker_Event:'closing'] Chat worker is closing connection to Redis. Message: ${msg}`);
});

chatWorker.on('closed', () => {
  logger.warn(`[ChatWorker_Event:'closed'] Chat worker has closed its connection to Redis.`);
});

chatWorker.on('drained', () => {
  // This means the queue is empty and all active jobs have completed.
  // It does NOT mean the worker is stopping. It will continue to listen for new jobs.
  logger.info('[ChatWorker_Event:\'drained\'] Chat queue is drained (empty and no active jobs). Worker still listening.');
});

chatWorker.on('stalled', (jobId: string) => {
    logger.warn(`[ChatWorker_Event:'stalled'] Job ${jobId} has been marked as stalled. This might indicate an issue with processing or lock duration.`);
    // A job is stalled if it was 'active' but its lock expired before it completed or failed.
    // This often means lockDuration is too short for how long jobs take.
});

// Named export for the worker instance (used in workers/chat.worker.ts)
export { chatWorker };

// Default export the queue instance (used by API controllers to add jobs)
export default chatQueue;
