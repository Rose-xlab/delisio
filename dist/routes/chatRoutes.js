"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chatControllers_1 = require("../controllers/chatControllers");
const validationUtils_1 = require("../utils/validationUtils");
const router = express_1.default.Router();
/**
 * @route   POST /api/chat
 * @desc    Handle chat messages and return AI response
 * @access  Public
 */
router.post('/', (0, validationUtils_1.validateRequest)(validationUtils_1.chatMessageSchema), async (req, res, next) => {
    try {
        const { message } = req.body;
        const response = await (0, chatControllers_1.handleChatMessage)(message);
        res.status(200).json(response);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=chatRoutes.js.map