// src/routes/chatRoutes.ts
import express from 'express';
import { handleChatMessage, getChatQueueStatus } from '../controllers/chatControllers';
import { validateRequest, chatMessageSchema } from '../utils/validationUtils';
import { optionalAuthenticate, authenticate } from '../middleware/authMiddleware';
import { AppError } from '../middleware/errorMiddleware';

const router = express.Router();

/**
 * @route   GET /api/chat/queue-status
 * @desc    Get status of the chat message processing queue
 * @access  Private - Only authenticated users can check queue status
 */
router.get('/queue-status', authenticate, async (req, res, next) => {
  try {
    await getChatQueueStatus(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/chat
 * @desc    Handle chat messages and return AI response
 * @access  Public
 */
router.post('/', validateRequest(chatMessageSchema), optionalAuthenticate, async (req, res, next) => {
  try {
    const { conversation_id, message } = req.body;
    
    // Validate that conversation_id is provided
    if (!conversation_id) {
      throw new AppError('conversation_id is required', 400);
    }
    
    await handleChatMessage(req, res, next);
  } catch (error) {
    next(error);
  }
});

export default router;