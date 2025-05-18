// src/controllers/chatControllers.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase';
import chatQueue from '../queues/chatQueue'; // Your BullMQ instance for chat
import { AppError } from '../middleware/errorMiddleware';
import { logger } from '../utils/logger';
import { ChatJobResult }from '../queues/chatQueue'; // Ensure this type is correctly defined for your job's return value

// Import necessary services and models for subscription and limits
import {
  getUserSubscription,
  getAiChatUsageCount,
  trackAiChatReplyGeneration,
} from '../services/subscriptionService';
import { SUBSCRIPTION_FEATURE_LIMITS, SubscriptionTier } from '../models/Subscription';

export const handleChatMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversation_id, message, message_history } = req.body;
    const userId = req.user?.id; // Attached by your auth middleware
    const clientAssignedMessageId = uuidv4(); // Or use an ID from client if provided

    if (!conversation_id) {
      return next(new AppError('Missing conversation_id in request', 400));
    }
    const conversationId: string = conversation_id;
    logger.info(`Chat message received for conversation ${conversationId}`, { userId: userId || 'anonymous' });

    // ---- AI REPLY LIMIT CHECK FOR LOGGED-IN USERS ----
    if (userId) {
      // Fetch the user's current subscription details (this also creates a 'free' record if none exists)
      const subscription = await getUserSubscription(userId);
      
      if (!subscription) {
        // This should be rare if getUserSubscription correctly creates a free tier.
        logger.error(`Critical: User ${userId} has no subscription record even after attempting fetch/create. Blocking chat reply.`);
        return next(new AppError('Your subscription information could not be retrieved. Please try again later.', 500));
      }

      const userTier = subscription.tier;

      if (userTier === 'free') {
        const limits = SUBSCRIPTION_FEATURE_LIMITS.free; // Get limits for 'free' tier
        const currentPeriodStart = subscription.currentPeriodStart; // Vital for correct usage period

        // Ensure periodStart is valid before querying usage
        if (!currentPeriodStart) {
            logger.error(`User ${userId} (free) has a subscription record but 'currentPeriodStart' is missing. Cannot accurately check AI reply limit.`);
            return next(new AppError('Subscription data is incomplete. Unable to verify chat limits at this time.', 500));
        }
        
        const aiRepliesUsed = await getAiChatUsageCount(userId, currentPeriodStart);
        logger.info(`User ${userId} (free) AI replies used: ${aiRepliesUsed} (Limit: ${limits.aiChatRepliesPerPeriod}) for period starting ${currentPeriodStart.toISOString()}`);

        if (aiRepliesUsed >= limits.aiChatRepliesPerPeriod) {
          logger.warn(`User ${userId} (free) has reached AI reply limit of ${limits.aiChatRepliesPerPeriod}.`);
          return res.status(402).json({ // 402 Payment Required
            reply: `You have reached your limit of ${limits.aiChatRepliesPerPeriod} free AI replies for this period. Please upgrade.`,
            error: "AI_REPLY_LIMIT_REACHED", // Custom error code for client
            suggestions: [], // Maintain consistent response structure
          });
        }
      }
    }
    // ---- END AI REPLY LIMIT CHECK ----

    // Save user message (only if user is logged in)
    if (userId) {
      try {
        await supabase.from('messages').insert({
          id: clientAssignedMessageId,
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: message,
          // metadata: {} // Add if you have metadata for user messages
        });
        logger.info(`User message ${clientAssignedMessageId} saved for conversation ${conversationId}`);
      } catch (dbError) {
        const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
        logger.error(`Error saving user message ${clientAssignedMessageId} for conversation ${conversationId}: ${errorMsg}`);
        // Continue processing for AI reply even if user message save fails for some reason (optional)
      }
    } else {
      logger.info(`Anonymous user message for conversation ${conversationId}, not saving user message to DB.`);
    }

    // Add job to the chat queue
    const job = await chatQueue.add(
      'process-message', // Job name
      { // Job data
        message,
        conversationId,
        messageHistory: message_history || [], // Ensure it's an array
        userId, // Pass userId to the worker (can be null for anonymous)
      },
      { // Job options from your original code
        timeout: 30000,
        removeOnComplete: 500,
        removeOnFail: 1000,
        attempts: 2,
        jobId: uuidv4() // Ensure a unique job ID
      }
    );
    logger.info(`Chat message job ${job.id} added to queue for conversation ${conversationId}`);

    // Polling logic (as provided in your original file, with minor logging improvements)
    const startTime = Date.now();
    const pollingTimeoutMs = 25000;

    while (Date.now() - startTime < pollingTimeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const currentJob = await chatQueue.getJob(job.id!);

      if (!currentJob) {
        logger.warn(`Job ${job.id} not found during polling for conv ${conversationId}. It might have completed/failed and been removed.`);
        // If job disappears quickly, it might be due to fast completion/failure and removeOnComplete/removeOnFail settings.
        // A more robust solution might involve QueueEvents or checking if the job was known to have finished.
        // For now, if it's gone after a short while, assume the worst to avoid client hanging.
        if (Date.now() - startTime > 3000) { // Short grace period
            logger.error(`Job ${job.id} (conv ${conversationId}) persistently not found. Assuming lost or an error.`);
            throw new AppError('Chat processing job disappeared unexpectedly.', 500, "I'm sorry, there was a technical hiccup. Please try sending your message again.");
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

          // ---- TRACK AI REPLY USAGE FOR FREE USER (AFTER successful generation) ----
          if (userId) {
            // Re-fetch subscription to ensure we're using the latest tier info
            // as it might have changed due to a concurrent webhook event (though less likely mid-chat).
            const subscription = await getUserSubscription(userId);
            if (subscription?.tier === 'free') {
              // Only track if the AI successfully provided a reply
              await trackAiChatReplyGeneration(userId);
            }
          }
          // ---- END TRACKING ----

          // Save assistant's message (only if user is logged in)
          if (userId) {
            try {
              await supabase.from('messages').insert({
                id: uuidv4(), // New ID for assistant message
                conversation_id: conversationId,
                user_id: null, // Assistant messages are not tied to a user_id
                role: 'assistant',
                content: result.reply,
                metadata: { suggestions: result.suggestions ?? [] },
              });
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

        } else { // Job completed but result or result.reply is invalid
          const workerTechError = result?.error || 'Chat worker returned invalid result structure.';
          logger.error(`Chat job ${job.id} (conv ${conversationId}) completed but 'reply' is missing/invalid. TechError: ${workerTechError}`, { result });
          throw new AppError(workerTechError, 500, result?.reply || "I'm sorry, I couldn't formulate a response due to an internal error.");
        }
      } else if (state === 'failed') {
        const reason = currentJob.failedReason || 'Unknown reason for job failure.';
        logger.error(`Chat job ${job.id} (conv ${conversationId}) failed: ${reason}`);
        const failedJobResult = currentJob.returnvalue as ChatJobResult | undefined;
        const userFacingReplyForFailedJob = failedJobResult?.reply || "I'm sorry, message processing failed. Please try again.";
        const technicalErrorForFailedJob = failedJobResult?.error || reason;
        throw new AppError(technicalErrorForFailedJob, 500, userFacingReplyForFailedJob);
      }
      // Continue polling for 'active', 'waiting', 'delayed'
    }

    // Polling loop timed out
    logger.warn(`Chat job ${job.id} polling timed out for conversation ${conversationId} after ${pollingTimeoutMs}ms.`);
    // Optionally check job status one last time (as in your original)
    throw new AppError('Chat message processing timed out.', 408, "I'm sorry, your request took too long. Please try again.");

  } catch (error) { // Centralized error handling
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
        error: technicalErrorMsg, // For client-side logging/debugging if needed
        suggestions: [], // Ensure consistent response structure
      });
    } else {
      logger.error('Headers already sent in handleChatMessage, cannot send error response to client. Passing to next.', { technicalErrorMsg });
      next(error); // Pass to Express default error handler
    }
  }
};

/**
 * Gets status of the chat queue itself
 */
export const getChatQueueStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!chatQueue) { // Check if chatQueue is initialized
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