"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/webhookRoutes.ts
const express_1 = __importDefault(require("express"));
const webhookControllers_1 = require("../controllers/webhookControllers");
const router = express_1.default.Router();
/**
 * @route   POST /api/webhooks/stripe
 * @desc    Handle Stripe webhook events
 * @access  Public (but verified with Stripe signature)
 */
router.post('/stripe', express_1.default.raw({ type: 'application/json' }), async (req, res, next) => {
    try {
        await (0, webhookControllers_1.handleStripeWebhook)(req, res, next);
    }
    catch (error) {
        // Handle webhook errors directly instead of using next()
        // Stripe expects a quick response, even for errors
        console.error('Webhook error:', error);
        res.status(400).json({ received: false, error: 'Webhook error' });
    }
});
exports.default = router;
//# sourceMappingURL=webhookRoutes.js.map