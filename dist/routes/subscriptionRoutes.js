"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/subscriptionRoutes.ts
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const subscriptionControllers_1 = require("../controllers/subscriptionControllers");
const router = express_1.default.Router();
/**
 * @route   GET /api/subscriptions/status
 * @desc    Get current subscription status
 * @access  Private
 */
router.get('/status', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        await (0, subscriptionControllers_1.getSubscriptionDetails)(req, res, next);
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/subscriptions/checkout
 * @desc    Create checkout session for new subscription
 * @access  Private
 */
router.post('/checkout', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        await (0, subscriptionControllers_1.createCheckoutSessionController)(req, res, next);
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/subscriptions/portal
 * @desc    Create customer portal session for managing subscription
 * @access  Private
 */
router.post('/portal', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        await (0, subscriptionControllers_1.createCustomerPortalSessionController)(req, res, next);
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/subscriptions/cancel
 * @desc    Cancel subscription
 * @access  Private
 */
router.post('/cancel', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        await (0, subscriptionControllers_1.cancelSubscriptionController)(req, res, next);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=subscriptionRoutes.js.map