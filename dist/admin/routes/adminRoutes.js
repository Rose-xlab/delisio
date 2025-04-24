"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminAuthMiddleware_1 = require("../middleware/adminAuthMiddleware");
const dashboardController = __importStar(require("../controllers/dashboardController"));
const userController = __importStar(require("../controllers/userController"));
const jobController = __importStar(require("../controllers/jobController"));
const subscriptionController = __importStar(require("../controllers/subscriptionController"));
const errorController = __importStar(require("../controllers/errorController"));
const settingsController = __importStar(require("../controllers/settingsController"));
const router = express_1.default.Router();
// Protect all admin routes
router.use(adminAuthMiddleware_1.authenticateAdmin);
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
router.put('/settings', adminAuthMiddleware_1.requireSuperAdmin, settingsController.updateSettings);
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map