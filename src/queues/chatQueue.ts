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
      removeOnFail: 500,     // Number of jobs to keep
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
      const chatJsonResponseString = await generateChatResponse(message, messageHistory);
      const callEndTime = Date.now();
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: generateChatResponse returned. Duration: ${callEndTime - callStartTime}ms`);

      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: RAW chatJsonResponseString received:`, { rawResponse: chatJsonResponseString });

      await job.updateProgress(80); 

      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: Parsing response...`);
      let responseData: Partial<ChatJobResult>;

      try {
        responseData = JSON.parse(chatJsonResponseString);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        logger.error(`[ChatWorker_JobProcessing] Job ${job.id}: Failed to parse JSON response from gptService.`, {
          error: errorMessage,
          rawResponse: chatJsonResponseString,
          stack: parseError instanceof Error ? parseError.stack : undefined
        });
        return {
          reply: "I'm sorry, I received an unreadable response from the AI. Please try again later.",
          error: `FATAL_PARSE_ERROR_IN_WORKER: ${errorMessage}`,
          suggestions: null,
        };
      }
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: Response parsed successfully.`);

      if (typeof responseData.reply !== 'string') {
        const originalReplyType = typeof responseData.reply;
        const originalReplyValue = responseData.reply;
        logger.error(`[ChatWorker_JobProcessing] Job ${job.id}: Invalid chat response format from gptService. 'reply' is missing or not a string. Type was: ${originalReplyType}`, { responseData });
        
        let userFacingReply: string;
        if (originalReplyValue === null || typeof originalReplyValue === 'undefined') {
            userFacingReply = "I'm sorry, the AI's response was not in the expected format (missing reply). Please try again later.";
        } else {
            userFacingReply = `I'm sorry, the AI's reply was not in the expected text format. Please try again. (Received type: ${originalReplyType})`;
        }
        return {
          reply: userFacingReply,
          error: responseData.error || `INVALID_REPLY_FIELD_TYPE_FROM_GPTSERVICE_IN_WORKER (was ${originalReplyType})`,
          suggestions: (Array.isArray(responseData.suggestions) ? responseData.suggestions.filter(s => typeof s === 'string') : null),
        };
      }

      if (responseData.error) {
        logger.warn(`[ChatWorker_JobProcessing] Job ${job.id}: gptService returned a response with a technical error field: '${responseData.error}'. User will see: "${responseData.reply}"`);
      }

      await job.updateProgress(100);
      const endTime = Date.now();
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: COMPLETED SUCCESSFULLY. Total Duration: ${endTime - startTime}ms`);

      // Ensure suggestions are string[] or null
      const finalSuggestions = Array.isArray(responseData.suggestions) 
                             ? responseData.suggestions.filter((s: any) => typeof s === 'string') 
                             : null;
      if (Array.isArray(responseData.suggestions) && finalSuggestions?.length !== responseData.suggestions.length) {
        logger.warn(`[ChatWorker_JobProcessing] Job ${job.id}: Some suggestions were filtered out due to non-string types.`);
      }


      return {
        reply: responseData.reply, // Known to be a string here
        suggestions: finalSuggestions,
        error: responseData.error, 
      };

    } catch (error) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[ChatWorker_JobProcessing] Job ${job.id}: CRITICAL UNEXPECTED error during processing. Total Duration: ${endTime - startTime}ms`, {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        jobData: job.data
      });
      return {
        reply: `I'm sorry, an unexpected internal error occurred while processing your message. Please try again.`,
        error: `UNEXPECTED_WORKER_ERROR: ${errorMessage}`,
        suggestions: null,
      };
    }
  },
  { 
    connection: redisClient,
    prefix: CONNECTION_OPTIONS.prefix,
    concurrency: process.env.CHAT_WORKER_CONCURRENCY ? parseInt(process.env.CHAT_WORKER_CONCURRENCY, 10) : 3,
    stalledInterval: 30000,
    lockDuration: 60000, 
    lockRenewTime: 30000,
  }
);

// --- Worker Event Handlers ---
chatWorker.on('completed', (job: Job<ChatJobData, ChatJobResult, 'process-message'>, result: ChatJobResult) => {
  // ***** ADDED DETAILED LOGGING for the 'completed' event result *****
  logger.info(`[ChatWorker_Event:'completed'] Job ${job.id} (attempt ${job.attemptsMade}) raw result object from processor:`, { fullResult: result });
  // ***** END ADDED LOGGING *****

  if (result.error) {
    logger.warn(`[ChatWorker_Event:'completed'] Job ${job.id} (attempt ${job.attemptsMade}) completed with a handled technical error: '${result.error}'. User saw (from result.reply): "${result.reply}"`);
  } else {
    logger.info(`[ChatWorker_Event:'completed'] Job ${job.id} (attempt ${job.attemptsMade}) completed successfully. User saw (from result.reply): "${result.reply}"`);
  }
});

chatWorker.on('failed', (job: Job<ChatJobData, ChatJobResult, 'process-message'> | undefined, error: Error) => {
  if (job) {
    logger.error(`[ChatWorker_Event:'failed'] Job ${job.id} (name: ${job.name}, attemptsMade: ${job.attemptsMade}/${job.opts.attempts}) FAILED. Reason: ${job.failedReason || error.message}`, {
      jobData: job.data,
      stack: job.stacktrace ? job.stacktrace.join('\n') : error.stack,
    });
  } else {
    logger.error(`[ChatWorker_Event:'failed'] A job FAILED but job details are unavailable. Error: ${error.message}`, {
      stack: error.stack,
    });
  }
});

chatWorker.on('error', (error: Error) => {
  logger.error(`[ChatWorker_Event:'error'] Chat worker instance encountered an error: ${error.message}`, {
    stack: error.stack,
  });
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
  logger.info('[ChatWorker_Event:\'drained\'] Chat queue is drained (empty and no active jobs). Worker still listening.');
});

chatWorker.on('stalled', (jobId: string) => {
    logger.warn(`[ChatWorker_Event:'stalled'] Job ${jobId} has been marked as stalled. This might indicate an issue with processing or lock duration.`);
});

export { chatWorker };
export default chatQueue;