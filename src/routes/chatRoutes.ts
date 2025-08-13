// src/routes/chatRoutes.ts
import express from 'express';
import { handleChatMessage, getChatQueueStatus } from '../controllers/chatControllers';
import { validateRequest, chatMessageSchema } from '../utils/validationUtils';
import { optionalAuthenticate, authenticate } from '../middleware/authMiddleware';
import { sanitizeChatInput } from '../middleware/sanitizeMiddleware';
import { AppError } from '../middleware/errorMiddleware';

const router = express.Router();

router.get('/queue-status', authenticate, async (req, res, next) => {
  try {
    await getChatQueueStatus(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.post('/', 
  sanitizeChatInput, // Add sanitization BEFORE validation
  validateRequest(chatMessageSchema), 
  optionalAuthenticate, 
  async (req, res, next) => {
    try {
      await handleChatMessage(req, res, next);
    } catch (error) {
      next(error);
    }
  }
);

export default router;