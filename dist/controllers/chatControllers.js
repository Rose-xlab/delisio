"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatQueueStatus = exports.handleChatMessage = void 0;
const uuid_1 = require("uuid");
const supabase_1 = require("../config/supabase");
const chatQueue_1 = __importDefault(require("../queues/chatQueue")); // Assuming this import is correct
const errorMiddleware_1 = require("../middleware/errorMiddleware");
const logger_1 = require("../utils/logger");
/**
 * Handles incoming chat messages, queues them for processing,
 * and waits for the response within a timeout period.
 */
const handleChatMessage = async (req, res, next) => {
    try {
        const { conversation_id, message, message_history } = req.body;
        const userId = req.user?.id; // Use optional chaining
        const messageId = (0, uuid_1.v4)();
        // Check if conversation_id is provided (moved validation here for clarity)
        if (!conversation_id) {
            throw new errorMiddleware_1.AppError('Missing conversation_id in request', 400);
        }
        const conversationId = conversation_id; // Assign after check
        logger_1.logger.info(`Chat message received`, { conversationId });
        if (userId) {
            try {
                await supabase_1.supabase.from('messages').insert({
                    id: messageId, conversation_id: conversationId, user_id: userId, role: 'user', content: message
                });
                logger_1.logger.info(`User message saved`, { messageId, conversationId });
            }
            catch (dbError) {
                const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
                logger_1.logger.error(`Error saving user message: ${errorMsg}`, { conversationId });
                // Optionally decide if this DB error should halt processing
                // throw new AppError('Failed to save user message', 500);
            }
        }
        else {
            logger_1.logger.info(`Anonymous user message received, not saving to DB`, { conversationId });
        }
        // Add job to chat queue
        const job = await chatQueue_1.default.add('process-message', // Correct job name literal matching NameType
        {
            message, conversationId, messageHistory: message_history, userId
        }, 
        // --- FIX APPLIED IN ORIGINAL CODE ---
        // Assert options object as 'any' to bypass incorrect type check for 'timeout'
        {
            timeout: 30000, // This SHOULD be valid in JobsOptions
            removeOnComplete: 500,
            removeOnFail: 1000,
            attempts: 2
        } // Add 'as any' assertion here
        );
        logger_1.logger.info(`Chat message job added`, { jobId: job.id, conversationId });
        // Poll for job completion
        const startTime = Date.now();
        const timeoutMs = 25000; // Reduced timeout for polling loop itself
        while (Date.now() - startTime < timeoutMs) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms between polls
            const currentJob = await chatQueue_1.default.getJob(job.id); // Use non-null assertion, job ID should exist
            if (!currentJob) {
                logger_1.logger.warn(`Job not found polling, might be removed or completed`, { jobId: job.id });
                // Consider if we should break or continue polling briefly
                continue; // Continue polling for a short duration in case of race condition
            }
            const state = await currentJob.getState();
            logger_1.logger.debug(`Polling chat job: State=${state}`, { jobId: job.id }); // Debug log for state
            if (state === 'completed') {
                const result = await currentJob.returnvalue; // Use assertion
                if (result?.error) {
                    // Log handled error from worker, but don't throw here unless critical
                    logger_1.logger.warn(`Chat job completed with handled error: ${result.error}`, { jobId: job.id });
                }
                // --- UPDATED CHECK ---
                // Check if the result object exists and if the 'reply' property is specifically a string.
                // This allows empty strings "" as valid replies, preventing the previous error.
                if (result && typeof result.reply === 'string') {
                    // --- END OF UPDATE ---
                    if (userId) {
                        try {
                            // Save assistant response (only if user is logged in?) - Review this logic
                            // Assuming AI response should be saved regardless of user login for history?
                            await supabase_1.supabase.from('messages').insert({
                                id: (0, uuid_1.v4)(), conversation_id: conversationId, user_id: null, role: 'assistant',
                                content: result.reply,
                                metadata: { suggestions: result.suggestions ?? [] } // Ensure metadata is saved correctly
                            });
                            // Update conversation timestamp only if user is logged in
                            await supabase_1.supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
                            logger_1.logger.info(`Assistant response saved and conversation updated`, { conversationId });
                        }
                        catch (dbError) {
                            const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
                            logger_1.logger.error(`Error saving assistant message or updating conversation: ${errorMsg}`, { conversationId });
                            // Decide if this should cause a 500 response or just be logged
                        }
                    }
                    else {
                        logger_1.logger.info(`Assistant response generated for anonymous user, not saving to DB`, { conversationId });
                    }
                    logger_1.logger.info(`Chat job completed, response sent`, { jobId: job.id });
                    return res.status(200).json({
                        reply: result.reply,
                        suggestions: result.suggestions ?? [] // Ensure suggestions are handled correctly
                    });
                }
                else {
                    // This block is now only reached if result is null/undefined or result.reply is not a string
                    logger_1.logger.error(`Chat job completed but 'reply' is missing or invalid type`, { jobId: job.id, resultReplyType: typeof result?.reply });
                    throw new Error('Chat completed but no valid reply was generated.'); // Updated error message slightly
                }
            }
            else if (state === 'failed') {
                const reason = currentJob.failedReason || 'Unknown reason';
                logger_1.logger.error(`Chat job failed: ${reason}`, { jobId: job.id });
                // Propagate a more specific error message if possible
                throw new errorMiddleware_1.AppError(`Chat message processing failed: ${reason}`, 500); // Use AppError for status code
            }
            // Continue polling if state is active, waiting, delayed, etc.
        }
        // Timeout reached for polling loop
        logger_1.logger.warn(`Chat job polling timed out after ${timeoutMs}ms`, { jobId: job.id });
        // Optional: Check job status one last time after timeout
        const timedOutJob = await chatQueue_1.default.getJob(job.id);
        if (timedOutJob) {
            const finalState = await timedOutJob.getState();
            if (finalState === 'completed') {
                const finalResult = await timedOutJob.returnvalue;
                if (finalResult && typeof finalResult.reply === 'string') {
                    logger_1.logger.info(`Returning result from job completed just after polling timeout`, { jobId: job.id });
                    // Note: DB saving logic might be missed here if it depends on userId from req
                    return res.status(200).json({
                        reply: finalResult.reply,
                        suggestions: finalResult.suggestions ?? []
                    });
                }
                else {
                    logger_1.logger.error(`Job completed post-timeout but missing valid reply`, { jobId: job.id });
                }
            }
            else {
                logger_1.logger.warn(`Job found post-timeout, final state: ${finalState}`, { jobId: job.id });
                // Optionally try to remove/fail the job if it's stuck
                // try { await timedOutJob.moveToFailed({ message: 'Processing timed out' }, true); } catch(moveError) { logger.error('Failed to move timed out job to failed state', { jobId: job.id, moveError });}
            }
        }
        // If timeout reached and job didn't complete successfully just after, return timeout error
        throw new errorMiddleware_1.AppError('Chat message processing timed out', 408); // 408 Request Timeout
    }
    catch (error) {
        // Centralized error handling
        const isAppError = error instanceof errorMiddleware_1.AppError;
        const statusCode = isAppError ? error.statusCode : 500;
        // Use the specific error message from AppError or the generic one from Error
        const errorMsg = error instanceof Error ? error.message : 'Unknown error processing chat';
        // Log the categorized error
        logger_1.logger.error(`Error in handleChatMessage: ${errorMsg}`, { statusCode, isAppError });
        // Ensure response is sent only once
        if (!res.headersSent) {
            return res.status(statusCode).json({
                // Use a user-friendly reply for client
                reply: "I'm sorry, I encountered an issue. Please try again.",
                // Provide the actual error message in the error field (for debugging/logging on client if needed)
                error: errorMsg,
                suggestions: null // Ensure suggestions field is present even on error
            });
        }
        else {
            // If headers already sent, pass to Express default error handler
            next(error);
        }
    }
};
exports.handleChatMessage = handleChatMessage;
/**
 * Gets status of the chat queue
 */
const getChatQueueStatus = async (_req, res, next) => {
    try {
        if (!chatQueue_1.default) {
            throw new errorMiddleware_1.AppError('Chat queue not initialized', 500);
        }
        const jobCounts = await chatQueue_1.default.getJobCounts('waiting', 'active', 'delayed', 'paused', 'completed', 'failed');
        res.status(200).json({ isQueueActive: true, counts: jobCounts });
    }
    catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error(`Error getting chat queue status: ${errorMsg}`);
        // Pass AppError to central error handler
        next(new errorMiddleware_1.AppError(`Failed get chat queue status: ${errorMsg}`, 500));
    }
};
exports.getChatQueueStatus = getChatQueueStatus;
//# sourceMappingURL=chatControllers.js.map