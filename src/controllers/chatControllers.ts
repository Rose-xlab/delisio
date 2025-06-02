//C:\Users\mukas\Downloads\delisio\delisio\src\controllers\chatControllers.ts

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase';
import chatQueue from '../queues/chatQueue'; // Default import
import { AppError } from '../middleware/errorMiddleware';
import { logger } from '../utils/logger';
import { ChatJobResult, ChatJobData } from '../queues/chatQueue'; // Named imports for interfaces
import {
  getUserSubscription,
  getAiChatUsageCount,
  trackAiChatReplyGeneration,
} from '../services/subscriptionService';
import { SUBSCRIPTION_FEATURE_LIMITS } from '../models/Subscription';

import { Database } from '../types/supabase';
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export const handleChatMessage = async (req: Request, res: Response, next: NextFunction) => {
  const jobIdForContext = uuidv4(); // For consistent job ID if needed before queue add
  try {
    const { conversation_id, message, message_history } = req.body;
    const userId = req.user?.id;
    const clientAssignedMessageId = uuidv4();

    if (!conversation_id) {
      return next(new AppError('Missing conversation_id in request', 400));
    }
    const conversationId: string = conversation_id;
    logger.info(`Chat message received for conversation ${conversationId}`, { userId: userId || 'anonymous', messageLength: message?.length, clientMessageId: clientAssignedMessageId });

    if (userId) {
      const subscription = await getUserSubscription(userId);
      if (!subscription) {
        logger.error(`Critical: User ${userId} has no subscription record. Blocking chat reply.`);
        return next(new AppError('Your subscription information could not be retrieved. Please try again later.', 500));
      }
      const userTier = subscription.tier;
      if (userTier === 'free') {
        const limits = SUBSCRIPTION_FEATURE_LIMITS.free;
        const currentPeriodStart = subscription.currentPeriodStart;
        if (!currentPeriodStart) {
            logger.error(`User ${userId} (free) has subscription but 'currentPeriodStart' is missing. Cannot check AI reply limit.`);
            return next(new AppError('Subscription data is incomplete. Unable to verify chat limits.', 500));
        }
        const aiRepliesUsed = await getAiChatUsageCount(userId, currentPeriodStart);
        logger.info(`User ${userId} (free) AI replies used: ${aiRepliesUsed} / Limit: ${limits.aiChatRepliesPerPeriod} for period starting ${currentPeriodStart.toISOString()}`);
        if (aiRepliesUsed >= limits.aiChatRepliesPerPeriod) {
          logger.warn(`User ${userId} (free) has reached AI reply limit of ${limits.aiChatRepliesPerPeriod}.`);
          return res.status(402).json({
            reply: `You have reached your limit of ${limits.aiChatRepliesPerPeriod} free AI replies for this period. Please upgrade.`,
            error_type: "AI_REPLY_LIMIT_REACHED",
            suggestions: [],
            status_code: 402
          });
        }
      }
    }

    if (userId) {
      try {
        if (typeof message !== 'string' || message.trim() === '') {
            logger.warn(`User message content is empty or not a string for conversation ${conversationId}. Not saving.`);
        } else {
            const userMessagePayload: MessageInsert = {
              id: clientAssignedMessageId,
              conversation_id: conversationId,
              user_id: userId,
              role: 'user',
              content: message,
            };
            await supabase.from('messages').insert(userMessagePayload);
            logger.info(`User message ${clientAssignedMessageId} saved for conversation ${conversationId}`);
        }
      } catch (dbError) {
        const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
        logger.error(`Error saving user message ${clientAssignedMessageId} for conversation ${conversationId}: ${errorMsg}`);
      }
    } else {
      logger.info(`Anonymous user message for conversation ${conversationId}, not saving user message to DB.`);
    }

    const jobData: ChatJobData = {
        message,
        conversationId,
        messageHistory: message_history || [],
        userId
    };

    const job = await chatQueue.add(
      'process-message',
      jobData,
      {
        timeout: 30000,
        removeOnComplete: 500,
        removeOnFail: 1000,
        attempts: 2,
        jobId: jobIdForContext // Use the pre-generated UUID for the job
      } as any
    );
    logger.info(`Chat message job ${job.id} added to queue for conversation ${conversationId}`);

    const startTime = Date.now();
    const pollingTimeoutMs = 25000;

    while (Date.now() - startTime < pollingTimeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const currentJob = await chatQueue.getJob(job.id!);

      if (!currentJob) {
        logger.warn(`Job ${job.id} not found during polling for conv ${conversationId}. It might have been removed or completed very quickly.`);
        // It's possible the job completed and was removed based on retention policies if polling is slow
        // Or it failed and was removed. If we can't find it after a short while, assume an issue.
        if (Date.now() - startTime > 5000) {
            logger.error(`Job ${job.id} (conv ${conversationId}) persistently not found after 5s. Assuming lost or already processed and removed.`);
            throw new AppError('Chat processing status could not be retrieved. The request might have completed or failed.', 500, "I'm sorry, there was a hiccup checking your message status. Please check the chat for a response shortly.");
        }
        continue;
      }

      const state = await currentJob.getState();
      logger.debug(`Polling chat job ${job.id}: State=${state} for conversation ${conversationId}`);

      if (state === 'completed') {
        const jobReturnValue = currentJob.returnvalue;

        // ***** ENHANCED LOGGING *****
        logger.info(
          `[Controller] Job ${job.id} is 'completed'. Raw returnvalue from BullMQ:`,
          {
            // Attempt to stringify, but catch errors if it's not directly stringifiable (e.g. undefined)
            rawReturnValueString: typeof jobReturnValue === 'undefined' ? 'undefined' : JSON.stringify(jobReturnValue, null, 2),
            typeOfRawReturnValue: typeof jobReturnValue,
            isReturnValueNull: jobReturnValue === null,
            isReturnValueUndefined: typeof jobReturnValue === 'undefined',
          }
        );
        // ***** END ENHANCED LOGGING *****

        const result = jobReturnValue as ChatJobResult;

        if (result && typeof result.reply === 'string') {
          if (result.error) {
            logger.warn(`Chat job ${job.id} (conv ${conversationId}) completed with reply but also with a technical error field from worker: '${result.error}'`);
          } else {
            logger.info(`Chat job ${job.id} completed successfully by worker for conversation ${conversationId}.`);
          }

          if (userId) {
            const subscription = await getUserSubscription(userId);
            if (subscription?.tier === 'free' && !result.error) {
              await trackAiChatReplyGeneration(userId);
            }
          }

          if (userId && !result.error) {
            try {
              const assistantMessagePayload: MessageInsert = {
                id: uuidv4(),
                conversation_id: conversationId,
                user_id: null,
                role: 'assistant',
                content: result.reply,
                metadata: { suggestions: result.suggestions ?? [] },
              };
              await supabase.from('messages').insert(assistantMessagePayload);
              await supabase
                .from('conversations')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', conversationId);
              logger.info(`Assistant response saved and conversation ${conversationId} updated for user ${userId}.`);
            } catch (dbError) {
              const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
              logger.error(`Error saving assistant message or updating conversation ${conversationId} for user ${userId}: ${errorMsg}`);
            }
          } else if (!userId && !result.error) {
            logger.info(`Assistant response for anonymous conversation ${conversationId}, not saving AI message to DB.`);
          }
          
          return res.status(200).json({
            reply: result.reply,
            suggestions: result.suggestions ?? [],
          });
        } else { // result.reply is not a string, or result is null/undefined
          const workerTechError = result?.error || 'Chat worker returned invalid result structure (reply missing/invalid).';
          logger.error(`Chat job ${job.id} (conv ${conversationId}) completed but 'reply' is missing/invalid. Actual reply type: ${typeof result?.reply}. TechError from worker: ${result?.error}`, { retrievedResultObjectString: JSON.stringify(result, null, 2) });
          throw new AppError(
            workerTechError,
            500,
            (result && typeof result.reply === 'string' ? result.reply : null) || "I'm sorry, I couldn't formulate that response properly."
          );
        }
      } else if (state === 'failed') {
        const reason = currentJob.failedReason || 'Unknown reason for job failure.';
        logger.error(`Chat job ${job.id} (conv ${conversationId}) failed: ${reason}`);
        const failedJobResult = currentJob.returnvalue as ChatJobResult | undefined;
        const userFacingReplyForFailedJob = failedJobResult?.reply || "I'm sorry, message processing failed after multiple attempts. Please try again.";
        const technicalErrorForFailedJob = failedJobResult?.error || reason;
        throw new AppError(technicalErrorForFailedJob, 500, userFacingReplyForFailedJob);
      }
    }

    logger.warn(`Chat job ${job.id} polling timed out for conversation ${conversationId} after ${pollingTimeoutMs}ms.`);
    throw new AppError('Chat message processing timed out.', 408, "I'm sorry, your request took too long to process. Please try again.");

  } catch (error) {
    const isAppError = error instanceof AppError;
    const statusCode = isAppError ? error.statusCode : 500;
    const technicalErrorMsg = (isAppError ? error.message : (error instanceof Error ? error.message : 'Unknown error processing chat'));
    const userFacingReply = (isAppError && error.userFacingReply)
        ? error.userFacingReply
        : "I'm sorry, an unexpected issue occurred. Please try again later.";

    logger.error(`Error in handleChatMessage controller (Job ID for context: ${jobIdForContext}): ${technicalErrorMsg}`, {
      statusCode,
      isAppError,
      originalErrorObjectString: String(error), // Stringify original error for logging
      requestBody: req.body,
      userId: req.user?.id
    });

    if (!res.headersSent) {
      return res.status(statusCode).json({
        reply: userFacingReply,
        error_type: technicalErrorMsg, 
        suggestions: [],
        status_code: statusCode
      });
    } else {
      logger.error('Headers already sent in handleChatMessage, cannot send error response to client. Passing to Express error handler.', { technicalErrorMsg, jobIdForContext });
      next(error);
    }
  }
};

export const getChatQueueStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!chatQueue) {
      logger.error('Chat queue (chatQueue) is not initialized/available.');
      throw new AppError('Chat queue service is currently unavailable.', 503);
    }
    const jobCounts = await chatQueue.getJobCounts('waiting', 'active', 'delayed', 'paused', 'completed', 'failed');
    res.status(200).json({ isQueueActive: true, counts: jobCounts });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error getting chat queue status: ${errorMsg}`);
    next(error instanceof AppError ? error : new AppError(`Failed to get chat queue status: ${errorMsg}`, 500));
  }
};