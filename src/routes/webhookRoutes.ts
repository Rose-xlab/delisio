// src/routes/webhookRoutes.ts
import express from 'express';
import { handleStripeWebhook } from '../controllers/webhookControllers';

const router = express.Router();

/**
 * @route   POST /api/webhooks/stripe
 * @desc    Handle Stripe webhook events
 * @access  Public (but verified with Stripe signature)
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    await handleStripeWebhook(req, res, next);
  } catch (error) {
    // Handle webhook errors directly instead of using next()
    // Stripe expects a quick response, even for errors
    console.error('Webhook error:', error);
    res.status(400).json({ received: false, error: 'Webhook error' });
  }
});

export default router;