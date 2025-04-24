import express from 'express';
import { requireSuperAdmin } from '../middleware/adminAuthMiddleware';
import * as authController from '../controllers/authController';
import * as dashboardController from '../controllers/dashboardController';
import * as userController from '../controllers/userController';
import * as jobController from '../controllers/jobController';
import * as subscriptionController from '../controllers/subscriptionController';
import * as errorController from '../controllers/errorController';
import * as settingsController from '../controllers/settingsController';

const router = express.Router();

// Auth routes (accessible within /admin path)
router.get('/auth/verify', authController.verifyToken);

// Dashboard routes
router.get('/dashboard/stats', dashboardController.getStats);
router.get('/dashboard/trends', dashboardController.getTrends);

// User routes
router.get('/users', userController.getUsers);
router.get('/users/:id', userController.getUserDetails);
router.post('/users/:id/subscription', userController.updateUserSubscription);
router.post('/users/:id/reset-limits', userController.resetUserLimits);

// Job routes
router.get('/jobs/queues', jobController.getQueueStatus);
router.get('/jobs/failed', jobController.getFailedJobs);
router.post('/jobs/:id/retry', jobController.retryJob);
router.post('/jobs/:id/cancel', jobController.cancelJob);
router.get('/jobs/performance', jobController.getPerformanceMetrics);

// Subscription routes
router.get('/subscriptions/tiers', subscriptionController.getTiersOverview);
router.get('/subscriptions/revenue', subscriptionController.getRevenueMetrics);
router.get('/subscriptions/churn', subscriptionController.getChurnAnalysis);
router.get('/subscriptions/conversions', subscriptionController.getConversionRates);

// Error routes (Sentry integration)
router.get('/errors/trends', errorController.getErrorTrends);
router.get('/errors/frequent', errorController.getFrequentErrors);
router.get('/errors/impact', errorController.getUserImpact);

// Settings routes (Super admin only)
router.get('/settings', settingsController.getSettings);
router.put('/settings', requireSuperAdmin, settingsController.updateSettings);

export default router;