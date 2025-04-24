// src/routes/subscriptionRoutes.ts
import express from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { 
  getSubscriptionDetails,
  createCheckoutSessionController,
  createCustomerPortalSessionController,
  cancelSubscriptionController
} from '../controllers/subscriptionControllers';

const router = express.Router();

/**
 * @route   GET /api/subscriptions/status
 * @desc    Get current subscription status
 * @access  Private
 */
router.get('/status', authenticate, async (req, res, next) => {
  try {
    await getSubscriptionDetails(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/subscriptions/checkout
 * @desc    Create checkout session for new subscription
 * @access  Private
 */
router.post('/checkout', authenticate, async (req, res, next) => {
  try {
    await createCheckoutSessionController(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/subscriptions/portal
 * @desc    Create customer portal session for managing subscription
 * @access  Private
 */
router.post('/portal', authenticate, async (req, res, next) => {
  try {
    await createCustomerPortalSessionController(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/subscriptions/cancel
 * @desc    Cancel subscription
 * @access  Private
 */
router.post('/cancel', authenticate, async (req, res, next) => {
  try {
    await cancelSubscriptionController(req, res, next);
  } catch (error) {
    next(error);
  }
});

export default router;