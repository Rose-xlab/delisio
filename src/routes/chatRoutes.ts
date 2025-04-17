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
    const { message } = req.body;
    
    const response = await handleChatMessage(message);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export default router;