// src/controllers/chatControllers.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase';
import chatQueue from '../queues/chatQueue';
import { AppError } from '../middleware/errorMiddleware';
import { logger } from '../utils/logger';
import { ChatJobResult } from '../queues/chatQueue';
import {
  getUserSubscription,
  getAiChatUsageCount,
  trackAiChatReplyGeneration,
} from '../services/subscriptionService';
import { SUBSCRIPTION_FEATURE_LIMITS, SubscriptionTier } from '../models/Subscription';
// import { JobsOptions } from 'bullmq'; // No longer explicitly used due to 'as any'

// Import TablesInsert for explicit Supabase insert typing
import { Database } from './../types/supabase'; // Adjust path if your supabase.ts is elsewhere
type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export const handleChatMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversation_id, message, message_history } = req.body;
    const userId = req.user?.id;
    const clientAssignedMessageId = uuidv4(); // For user message

    if (!conversation_id) {
      return next(new AppError('Missing conversation_id in request', 400));
    }
    const conversationId: string = conversation_id; // Ensure conversationId is typed as string
    logger.info(`Chat message received for conversation ${conversationId}`, { userId: userId || 'anonymous' });

    // ---- AI REPLY LIMIT CHECK FOR LOGGED-IN USERS ----
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
            error: "AI_REPLY_LIMIT_REACHED",
            suggestions: [],
          });
        }
      }
    }
    // ---- END AI REPLY LIMIT CHECK ----

    // Save user message (only if user is logged in)
    if (userId) {
      try {
        // Ensure `message` from req.body is not undefined here.
        // If `message` could be undefined, provide a fallback or ensure it's required in req.body validation.
        if (typeof message !== 'string' || message.trim() === '') {
            // Handle case where message content is empty or not a string
            // This might not be the cause of the TS error but is good practice
            logger.warn(`User message content is empty for conversation ${conversationId}. Not saving.`);
            // Depending on desired behavior, you might throw an error or skip saving.
        } else {
            const userMessagePayload: MessageInsert = { // Explicitly type the payload
              id: clientAssignedMessageId,
              conversation_id: conversationId,
              user_id: userId,
              role: 'user',
              content: message, // from req.body; ensure it's a string
              // metadata: null, // Explicitly set if no metadata for user messages
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

    // Add job to the chat queue
    const job = await chatQueue.add(
      'process-message',
      { message, conversationId, messageHistory: message_history || [], userId },
      { // Reverting to 'as any' for jobOptions to bypass the specific TS error with 'timeout'
        // This assumes 'timeout' is functionally correct in your BullMQ version.
        // Ideally, investigate the JobsOptions type in your BullMQ version.
        timeout: 30000,
        removeOnComplete: 500,
        removeOnFail: 1000,
        attempts: 2,
        jobId: uuidv4()
      } as any // Reverted to 'as any' for this options block
    );
    logger.info(`Chat message job ${job.id} added to queue for conversation ${conversationId}`);

    // Polling logic
    const startTime = Date.now();
    const pollingTimeoutMs = 25000;

    while (Date.now() - startTime < pollingTimeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const currentJob = await chatQueue.getJob(job.id!);
      if (!currentJob) {
        logger.warn(`Job ${job.id} not found during polling for conv ${conversationId}.`);
        if (Date.now() - startTime > 3000) {
             logger.error(`Job ${job.id} (conv ${conversationId}) persistently not found. Assuming lost.`);
             throw new AppError('Chat processing job disappeared unexpectedly.', 500, "I'm sorry, there was a technical hiccup. Please try again.");
        }
        continue;
      }

      const state = await currentJob.getState();
      logger.debug(`Polling chat job ${job.id}: State=${state} for conversation ${conversationId}`);

      if (state === 'completed') {
        const result = currentJob.returnvalue as ChatJobResult;
        if (result && typeof result.reply === 'string') {
          if (result.error) {
            logger.warn(`Chat job ${job.id} (conv ${conversationId}) completed with reply but also technical error: ${result.error}`);
          } else {
            logger.info(`Chat job ${job.id} completed successfully for conversation ${conversationId}.`);
          }

          if (userId) {
            const subscription = await getUserSubscription(userId);
            if (subscription?.tier === 'free') {
              await trackAiChatReplyGeneration(userId);
            }
          }

          if (userId) {
            try {
              const assistantMessagePayload: MessageInsert = { // Explicitly type the payload
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
          } else {
            logger.info(`Assistant response for anonymous conversation ${conversationId}, not saving AI message to DB.`);
          }
          
          return res.status(200).json({
            reply: result.reply,
            suggestions: result.suggestions ?? [],
          });
        } else {
          const workerTechError = result?.error || 'Chat worker returned invalid result structure.';
          logger.error(`Chat job ${job.id} (conv ${conversationId}) completed but 'reply' is missing/invalid. TechError: ${workerTechError}`, { result });
          throw new AppError(workerTechError, 500, result?.reply || "I'm sorry, I couldn't formulate that response properly.");
        }
      } else if (state === 'failed') {
        const reason = currentJob.failedReason || 'Unknown reason for job failure.';
        logger.error(`Chat job ${job.id} (conv ${conversationId}) failed: ${reason}`);
        const failedJobResult = currentJob.returnvalue as ChatJobResult | undefined;
        const userFacingReplyForFailedJob = failedJobResult?.reply || "I'm sorry, message processing failed. Please try again.";
        const technicalErrorForFailedJob = failedJobResult?.error || reason;
        throw new AppError(technicalErrorForFailedJob, 500, userFacingReplyForFailedJob);
      }
    }

    logger.warn(`Chat job ${job.id} polling timed out for conversation ${conversationId} after ${pollingTimeoutMs}ms.`);
    throw new AppError('Chat message processing timed out.', 408, "I'm sorry, your request took too long. Please try again.");

  } catch (error) {
    const isAppError = error instanceof AppError;
    const statusCode = isAppError ? error.statusCode : 500;
    const technicalErrorMsg = error instanceof Error ? error.message : 'Unknown error processing chat';
    const userFacingReply = (isAppError && error.userFacingReply)
        ? error.userFacingReply
        : "I'm sorry, an unexpected issue occurred. Please try again later.";

    logger.error(`Error in handleChatMessage controller: ${technicalErrorMsg}`, {
      statusCode,
      isAppError,
      originalError: error,
      requestBody: req.body,
      userId: req.user?.id
    });

    if (!res.headersSent) {
      return res.status(statusCode).json({
        reply: userFacingReply,
        error: technicalErrorMsg,
        suggestions: [],
      });
    } else {
      logger.error('Headers already sent in handleChatMessage, cannot send error response to client. Passing to next.', { technicalErrorMsg });
      next(error);
    }
  }
};

export const getChatQueueStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!chatQueue) {
      throw new AppError('Chat queue is not available.', 500);
    }
    const jobCounts = await chatQueue.getJobCounts('waiting', 'active', 'delayed', 'paused', 'completed', 'failed');
    res.status(200).json({ isQueueActive: true, counts: jobCounts });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error getting chat queue status: ${errorMsg}`);
    next(new AppError(`Failed to get chat queue status: ${errorMsg}`, error instanceof AppError ? error.statusCode : 500));
  }
};