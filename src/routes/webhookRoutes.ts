// src/routes/webhookRoutes.ts
import express from 'express';
import { handleRevenueCatWebhook } from '../controllers/webhookControllers';

const router = express.Router();

// Define the route for RevenueCat webhooks
// The path '/revenuecat' is an example; use whatever path you configure in RevenueCat dashboard
router.post('/revenuecat', handleRevenueCatWebhook);

// If you had other webhook routes (e.g., for Stripe, if still needed for other purposes),
// they would also be defined here. But for IAP, we focus on RevenueCat.

export default router;