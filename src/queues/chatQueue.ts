//C:\Users\mukas\Downloads\delisio\delisio\src\queues\chatQueue.ts

import { Queue, Worker, Job } from 'bullmq';
import { redisClient } from '../config/redis';
import { generateChatResponse } from '../services/gptService';
import { logger } from '../utils/logger';
import { AiChatResponse } from '../schemas/chat.schema'; // Import our trusted type

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

// This now directly uses our trusted AiChatResponse type for consistency
export type ChatJobResult = AiChatResponse;

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
    logger.info(`[ChatWorker_JobProcessing] Job ${job.id} ENTERED. Attempts: ${job.attemptsMade}/${job.opts.attempts}.`);
    const { message, messageHistory } = job.data;
    const startTime = Date.now();

    try {
      await job.updateProgress(10);

      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: Calling generateChatResponse...`);
      
      // The worker's core logic is now one simple, type-safe line.
      // All complex parsing and validation is handled by the gptService.
      const validatedResponse = await generateChatResponse(message, messageHistory);

      await job.updateProgress(100);
      const endTime = Date.now();
      logger.info(`[ChatWorker_JobProcessing] Job ${job.id}: COMPLETED LOGIC. Total Duration: ${endTime - startTime}ms`);

      // We can trust validatedResponse completely because gptService guarantees its structure.
      return validatedResponse;

    } catch (error) { 
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[ChatWorker_JobProcessing] Job ${job.id}: CRITICAL UNEXPECTED error during processing. Total Duration: ${endTime - startTime}ms`, {
        error: errorMessage, 
        stack: error instanceof Error ? error.stack : undefined, 
        jobData: job.data
      });

      // Even in a catastrophic failure, we return a valid object that conforms to our schema.
      return {
        reply: `I'm sorry, an unexpected internal error occurred while processing your message. Our team has been notified.`,
        suggestions: [],
        error: `UNEXPECTED_WORKER_ERROR: ${errorMessage}`,
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