"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/chatRoutes.ts
const express_1 = __importDefault(require("express"));
const chatControllers_1 = require("../controllers/chatControllers");
const validationUtils_1 = require("../utils/validationUtils");
const authMiddleware_1 = require("../middleware/authMiddleware");
const errorMiddleware_1 = require("../middleware/errorMiddleware");
const router = express_1.default.Router();
/**
 * @route   GET /api/chat/queue-status
 * @desc    Get status of the chat message processing queue
 * @access  Private - Only authenticated users can check queue status
 */
router.get('/queue-status', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        await (0, chatControllers_1.getChatQueueStatus)(req, res, next);
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/chat
 * @desc    Handle chat messages and return AI response
 * @access  Public
 */
router.post('/', (0, validationUtils_1.validateRequest)(validationUtils_1.chatMessageSchema), authMiddleware_1.optionalAuthenticate, async (req, res, next) => {
    try {
        const { conversation_id, message } = req.body;
        // Validate that conversation_id is provided
        if (!conversation_id) {
            throw new errorMiddleware_1.AppError('conversation_id is required', 400);
        }
        await (0, chatControllers_1.handleChatMessage)(req, res, next);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=chatRoutes.js.map