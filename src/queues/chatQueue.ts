import { Queue, Worker, Job, JobProgress} from 'bullmq';
import { redisClient } from '../config/redis';
import { generateChatResponse } from '../services/gptService';
import { logger } from '../utils/logger';

interface MessageHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatJobData {
  message: string;
  conversationId: string;
  messageHistory?: MessageHistoryItem[];
  userId?: string;
}

export interface ChatJobResult {
  reply: string;
  suggestions?: string[] | null; 
  error?: string | null;
}

const CONNECTION_OPTIONS = {
  connection: redisClient,
  prefix: 'delisio_chat_',
};

export const chatQueue = new Queue<ChatJobData, ChatJobResult, 'process-message'>(
  'chat-messages',
  {
    ...CONNECTION_OPTIONS,
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 500,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    }
  }
);

const chatWorker = new Worker<ChatJobData, ChatJobResult, 'process-message'>(
  'chat-messages',
  async (job: Job<ChatJobData, ChatJobResult, 'process-message'>): Promise<ChatJobResult> => {
    logger.info(`[ChatWorker_JobProcessing] Job ${job.id} ENTERED. Attempts: ${job.attemptsMade}/${job.opts.attempts}. Data:`, { conversationId: job.data.conversationId, messageLength: job.data.message.length });
    const { message, conversationId, messageHistory } = job.data;
    const startTime = Date.now();

    try {
      await job.updateProgress(10);

      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: Calling generateChatResponse...`);
      const callStartTime = Date.now();
      const chatJsonResponseString = await generateChatResponse(message, messageHistory);
      const callEndTime = Date.now();
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: generateChatResponse returned. Duration: ${callEndTime - callStartTime}ms`);
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: RAW chatJsonResponseString received:`, { rawResponse: chatJsonResponseString });

      await job.updateProgress(80);

      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: Parsing response...`);
      let parsedGptResponse: any;

      try {
        parsedGptResponse = JSON.parse(chatJsonResponseString);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        logger.error(`[ChatWorker_JobProcessing] Job ${job.id}: Failed to parse JSON response from gptService.`, {
          error: errorMessage, rawResponse: chatJsonResponseString, stack: parseError instanceof Error ? parseError.stack : undefined
        });
        return {
          reply: "I'm sorry, I received an unreadable response from the AI. Please try again later.",
          error: `FATAL_PARSE_ERROR_IN_WORKER: ${errorMessage}`,
          suggestions: null,
        };
      }
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: Response from gptService parsed successfully.`);

      let finalReply: string;
      let finalSuggestions: string[] | null = null;
      let finalError: string | null = null;

      if (typeof parsedGptResponse.reply === 'string' && parsedGptResponse.reply.trim() !== '') {
        finalReply = parsedGptResponse.reply;
      } else {
        const originalReplyType = typeof parsedGptResponse.reply;
        logger.error(`[ChatWorker_JobProcessing] Job ${job.id}: 'reply' from gptService is missing, not a string, or empty. Type was: ${originalReplyType}`, { parsedGptResponse });
        finalReply = (originalReplyType === 'undefined' || parsedGptResponse.reply === null)
            ? "I'm sorry, the AI's response was not in the expected format (missing reply). Please try again later."
            : "I'm sorry, the AI provided an empty or invalid reply. Please try rephrasing your message.";
        finalError = parsedGptResponse.error || `INVALID_REPLY_FIELD_TYPE_FROM_GPTSERVICE (was ${originalReplyType})`;
      }

      if (Array.isArray(parsedGptResponse.suggestions)) {
        finalSuggestions = parsedGptResponse.suggestions.filter((s: any) => typeof s === 'string');
        // ***** MODIFIED LINE 101 (approx) *****
        if (finalSuggestions && finalSuggestions.length === 0) { // Check if finalSuggestions is not null before accessing length
          finalSuggestions = null; 
        }
      } else if (parsedGptResponse.suggestions !== null && typeof parsedGptResponse.suggestions !== 'undefined') {
          logger.warn(`[ChatWorker_JobProcessing] Job ${job.id}: 'suggestions' field from gptService was present but not an array. Setting to null.`, { suggestions: parsedGptResponse.suggestions });
          finalSuggestions = null;
      }
      
      if (typeof parsedGptResponse.error === 'string' && parsedGptResponse.error.trim() !== '') {
        if (finalError) { 
            logger.warn(`[ChatWorker_JobProcessing] Job ${job.id}: gptService also had an error: '${parsedGptResponse.error}', but using primary error: '${finalError}'`);
        } else {
            finalError = parsedGptResponse.error;
        }
      }
      
      if (finalError) {
        logger.warn(`[ChatWorker_JobProcessing] Job ${job.id}: A technical error condition was met: '${finalError}'. User will see: "${finalReply}"`);
      }
      
      await job.updateProgress(100);
      const endTime = Date.now();
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: COMPLETED LOGIC. Total Duration: ${endTime - startTime}ms`);

      const resultToSend: ChatJobResult = {
        reply: finalReply,
      };
      if (finalSuggestions !== undefined) {
        resultToSend.suggestions = finalSuggestions;
      }
      if (finalError !== undefined) { // Check against undefined if you want to preserve null as a specific "no error" state
        resultToSend.error = finalError; 
      }
      
      return resultToSend;

    } catch (error) { 
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[ChatWorker_JobProcessing] Job ${job.id}: CRITICAL UNEXPECTED error during processing. Total Duration: ${endTime - startTime}ms`, {
        error: errorMessage, stack: error instanceof Error ? error.stack : undefined, jobData: job.data
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

chatWorker.on('completed', (job: Job<ChatJobData, ChatJobResult, 'process-message'>, result: ChatJobResult) => {
  let loggedResultString = 'Error stringifying result for log';
  try {
    loggedResultString = JSON.stringify(result);
  } catch (e) { /* ignore stringify error for logging */ }

  logger.info(`[ChatWorker_Event:'completed'] Job ${job.id} (attempt ${job.attemptsMade}) raw result object from processor:`, { 
    fullResultString: loggedResultString, 
    originalResultObjectForInspection: result 
  });
  
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