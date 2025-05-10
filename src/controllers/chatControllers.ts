import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabase';
import chatQueue from '../queues/chatQueue';
import { AppError } from '../middleware/errorMiddleware'; // Assuming AppError is here
import { logger } from '../utils/logger';
import { ChatJobResult } from '../queues/chatQueue'; // Import the actual Result Type

/**
 * Handles incoming chat messages, queues them for processing,
 * and waits for the response within a timeout period.
 */
export const handleChatMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { conversation_id, message, message_history } = req.body;
    const userId = req.user?.id; // Use optional chaining
    const messageId = uuidv4();

    if (!conversation_id) {
      throw new AppError('Missing conversation_id in request', 400);
    }
    const conversationId: string = conversation_id;

    logger.info(`Chat message received`, { conversationId, userId });

    if (userId) {
      try {
        await supabase.from('messages').insert({
          id: messageId, conversation_id: conversationId, user_id: userId, role: 'user', content: message
        });
        logger.info(`User message saved`, { messageId, conversationId });
      } catch (dbError) {
        const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
        logger.error(`Error saving user message: ${errorMsg}`, { conversationId });
        // Not halting processing for this error, AI response is prioritized.
      }
    } else {
      logger.info(`Anonymous user message received, not saving to DB`, { conversationId });
    }

    const job = await chatQueue.add(
      'process-message',
      { message, conversationId, messageHistory: message_history, userId },
      {
        timeout: 30000, // Job processing timeout in BullMQ
        removeOnComplete: 500,
        removeOnFail: 1000,
        attempts: 2
      } as any // Keep 'as any' if types are problematic, or ensure types align
    );

    logger.info(`Chat message job added`, { jobId: job.id, conversationId });

    // Wait for job completion (using waitUntilFinished is often preferred over polling if QueueEvents is set up)
    // However, sticking to polling as per your original structure for now.
    // If you have QueueEvents set up for chatQueue, consider:
    // const result = await job.waitUntilFinished(chatQueueEvents, timeoutMs); -> this would need chatQueueEvents
    
    const startTime = Date.now();
    const pollingTimeoutMs = 25000; // Controller's own timeout for waiting for the job

    while (Date.now() - startTime < pollingTimeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Poll interval

      const currentJob = await chatQueue.getJob(job.id!);
      if (!currentJob) {
        logger.warn(`Job not found during polling, might have been removed or completed very quickly`, { jobId: job.id });
        // If it's gone, it might have completed and been removed.
        // It's hard to know the status here without QueueEvents or if removeOnComplete is very fast.
        // Let's assume if it's gone, we might miss its state; the timeout will eventually catch it.
        // For a short period, let's try again.
        if (Date.now() - startTime > 5000 && !currentJob) { // e.g. if not found after 5s of polling
            logger.error(`Job ${job.id} persistently not found during polling. Assuming lost or error.`, { conversationId });
            throw new AppError('Chat processing job disappeared unexpectedly.', 500, "I'm sorry, there was a hiccup processing your message. Please try again.");
        }
        continue;
      }

      const state = await currentJob.getState();
      logger.debug(`Polling chat job: State=${state}`, { jobId: job.id });

      if (state === 'completed') {
        const result = currentJob.returnvalue as ChatJobResult; // Use job.returnvalue directly

        // result.reply is the user-facing message (could be success or a user-friendly error message from worker/gptService)
        // result.error is the technical error string, if any, from worker/gptService
        
        if (result && typeof result.reply === 'string') {
          // Successfully got a reply string. It might be an apology if result.error is also set.
          if (result.error) {
            // This means the worker handled an error (e.g., from gptService) and set a technical error message,
            // but still provided a user-facing reply.
            logger.warn(`Chat job ${job.id} completed with a user-facing reply ("${result.reply}") AND a technical error: ${result.error}`, { conversationId });
            // We proceed to send the result.reply to the user. The technical result.error is logged.
            // The client will receive the user-facing reply.
          } else {
            logger.info(`Chat job ${job.id} completed successfully with reply.`, { conversationId });
          }

          // Save assistant message logic (conditionally if user is logged in)
          if (userId) { // Check if it's an authenticated user's conversation
             try {
                await supabase.from('messages').insert({
                    id: uuidv4(),
                    conversation_id: conversationId,
                    user_id: null, // Assistant messages have no user_id
                    role: 'assistant',
                    content: result.reply,
                    metadata: { suggestions: result.suggestions ?? [] }
                });
                await supabase.from('conversations')
                              .update({ updated_at: new Date().toISOString() })
                              .eq('id', conversationId);
                logger.info(`Assistant response saved and conversation updated for user`, { conversationId, userId });
             } catch (dbError) {
                const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
                logger.error(`Error saving assistant message or updating conversation for user: ${errorMsg}`, { conversationId, userId });
                // Non-critical for the response to the user, but good to monitor.
             }
          } else {
             // For anonymous users, we generated a reply but don't save it to their specific records (as they have none)
             // The conversationId here would be ephemeral or managed client-side for anonymous users.
             logger.info(`Assistant response generated for anonymous conversation, not saving to DB`, { conversationId });
          }
          
          return res.status(200).json({
            reply: result.reply,
            suggestions: result.suggestions ?? [] // Ensure suggestions default to empty array if null/undefined for client
          });

        } else {
          // Job completed, but result.reply is NOT a string or result is null.
          // This is the scenario our gptService changes aim to prevent.
          // If we reach here, it implies gptService or the worker failed to produce the standard {reply, error, suggestions} structure.
          const workerTechError = result?.error; // Get technical error from worker if available
          const messageToThrow = workerTechError || 'Chat completed but the worker did not provide a valid reply content.';
          logger.error(`Chat job ${job.id} completed but 'reply' is missing, null, or not a string. Technical error: ${messageToThrow}`, {
            jobId: job.id,
            resultReplyType: typeof result?.reply,
            fullResult: result, // Log the full result for debugging
            conversationId
          });
          throw new AppError(messageToThrow, 500, result?.reply || "I'm sorry, I couldn't formulate a response due to an internal error.");
        }

      } else if (state === 'failed') {
        const reason = currentJob.failedReason || 'Unknown reason for job failure';
        logger.error(`Chat job ${job.id} failed: ${reason}`, { conversationId });
        // The job itself failed after retries in BullMQ.
        // The 'reply' from the job, if any, would be from the last attempt's catch block in the worker.
        // Let's try to get the ChatJobResult from the failed job if it's available (it might be).
        const failedJobResult = currentJob.returnvalue as ChatJobResult | undefined;
        const userFacingReplyForFailedJob = failedJobResult?.reply || "I'm sorry, the message processing failed after several attempts. Please try again.";
        const technicalErrorForFailedJob = failedJobResult?.error || reason;

        throw new AppError(technicalErrorForFailedJob, 500, userFacingReplyForFailedJob);
      }
      // Continue polling if job is in other states like 'active', 'waiting', 'delayed'
    }

    // Polling loop timed out
    logger.warn(`Chat job polling timed out after ${pollingTimeoutMs}ms`, { jobId: job.id, conversationId });

    // Optional: Check job status one last time after timeout
    const timedOutJob = await chatQueue.getJob(job.id!);
    if (timedOutJob) {
      const finalState = await timedOutJob.getState();
      logger.warn(`Job ${job.id} status after polling timeout: ${finalState}`, { conversationId });
      if (finalState === 'completed') {
        const finalResult = timedOutJob.returnvalue as ChatJobResult;
        if (finalResult && typeof finalResult.reply === 'string') {
          logger.info(`Returning result from job ${job.id} completed just after polling timeout`, { conversationId });
          // DB saving logic for assistant message could be added here too if necessary
          return res.status(200).json({
            reply: finalResult.reply,
            suggestions: finalResult.suggestions ?? []
          });
        } else {
          logger.error(`Job ${job.id} completed post-timeout but missing valid reply`, { conversationId });
        }
      } else if (finalState === 'failed') {
         const reason = timedOutJob.failedReason || 'Unknown reason post-timeout';
         logger.error(`Job ${job.id} found FAILED post-timeout: ${reason}`, { conversationId });
         throw new AppError(`Chat processing failed (found post-timeout): ${reason}`, 500, "I'm sorry, processing your message took too long and failed. Please try again.");
      }
      // If job is still active or waiting, it truly timed out from controller's perspective
    }

    throw new AppError('Chat message processing timed out from controller.', 408, "I'm sorry, your request took too long to process. Please try again.");

  } catch (error) {
    const isAppError = error instanceof AppError;
    const statusCode = isAppError ? error.statusCode : 500;
    const technicalErrorMsg = error instanceof Error ? error.message : 'Unknown error processing chat';
    
    // Determine the user-facing reply
    let userFacingReply = "I'm sorry, I encountered an unexpected issue. Please try again.";
    if (isAppError && error.userFacingReply) {
        userFacingReply = error.userFacingReply;
    } else if (statusCode === 408) {
        userFacingReply = "I'm sorry, your request took too long to process. Please try again.";
    }

    logger.error(`Error in handleChatMessage: ${technicalErrorMsg}`, { statusCode, isAppError, originalError: error });

    if (!res.headersSent) {
      return res.status(statusCode).json({
        reply: userFacingReply,
        error: technicalErrorMsg, // Technical error for logging/debugging on client if needed
        suggestions: null
      });
    } else {
      // If headers already sent, Express default error handler will deal with it.
      // This usually means an error occurred in streaming or after response started.
      logger.error('Headers already sent, cannot send error response to client. Passing to next.', { technicalErrorMsg });
      next(error);
    }
  }
};

/**
 * Gets status of the chat queue
 */
export const getChatQueueStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!chatQueue) { throw new AppError('Chat queue not initialized', 500); }
    const jobCounts = await chatQueue.getJobCounts('waiting', 'active', 'delayed', 'paused', 'completed', 'failed');
    res.status(200).json({ isQueueActive: true, counts: jobCounts });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error getting chat queue status: ${errorMsg}`);
    next(new AppError(`Failed get chat queue status: ${errorMsg}`, 500));
  }
};