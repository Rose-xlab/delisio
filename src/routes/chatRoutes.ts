import express from 'express';
import { handleChatMessage } from '../controllers/chatControllers';
import { validateRequest, chatMessageSchema } from '../utils/validationUtils';
import { AppError } from '../middleware/errorMiddleware';

const router = express.Router();

/**
 * @route   POST /api/chat
 * @desc    Handle chat messages and return AI response
 * @access  Public
 */
router.post('/', validateRequest(chatMessageSchema), async (req, res, next) => {
  try {
    const { conversation_id, message, message_history } = req.body;
    
    const response = await handleChatMessage(message, conversation_id, message_history);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export default router;