"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const api_1 = require("@bull-board/api");
const bullMQAdapter_1 = require("@bull-board/api/bullMQAdapter");
const express_2 = require("@bull-board/express");
// Import the Sentry configuration
const sentry_1 = require("./config/sentry");
// Import admin routes
const admin_1 = __importDefault(require("./admin"));
const recipeRoutes_1 = __importDefault(require("./routes/recipeRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const subscriptionRoutes_1 = __importDefault(require("./routes/subscriptionRoutes"));
const webhookRoutes_1 = __importDefault(require("./routes/webhookRoutes"));
const recipeQueue_1 = require("./queues/recipeQueue");
const chatQueue_1 = require("./queues/chatQueue");
const imageQueue_1 = require("./queues/imageQueue");
const authMiddleware_1 = require("./middleware/authMiddleware");
const errorMiddleware_1 = require("./middleware/errorMiddleware");
const logger_1 = require("./utils/logger");
const rateLimiter_1 = require("./middleware/rateLimiter");
const cancellationMiddleware_1 = require("./middleware/cancellationMiddleware");
// Load environment variables
dotenv_1.default.config();
// Initialize Express app
const app = (0, express_1.default)();
// Initialize Sentry
(0, sentry_1.initSentry)(app);
// Set up Bull Board for monitoring queues
const serverAdapter = new express_2.ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');
(0, api_1.createBullBoard)({
    queues: [
        // Using @ts-ignore to suppress the type incompatibility error between
        // BullMQAdapter and the expected BaseAdapter structure for this version pair.
        // @ts-ignore
        new bullMQAdapter_1.BullMQAdapter(recipeQueue_1.recipeQueue),
        // @ts-ignore
        new bullMQAdapter_1.BullMQAdapter(chatQueue_1.chatQueue),
        // @ts-ignore
        new bullMQAdapter_1.BullMQAdapter(imageQueue_1.imageQueue)
    ],
    serverAdapter: serverAdapter,
});
// Middleware for Bull Board - protect with authentication in production
if (process.env.NODE_ENV === 'production') {
    app.use('/admin/queues', authMiddleware_1.authenticate, serverAdapter.getRouter());
}
else {
    app.use('/admin/queues', serverAdapter.getRouter());
}
// Regular middleware
app.use(express_1.default.json({ limit: '1mb' })); // Limit request size
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
// HTTP request logging
app.use(logger_1.httpLogger);
// Apply optional authentication to all routes
app.use(authMiddleware_1.optionalAuthenticate);
// Apply rate limiting
app.use(rateLimiter_1.rateLimiter);
// Apply cancellation middleware (before mounting routes)
app.use(cancellationMiddleware_1.cancellationRoutes);
// Mount routes
app.use('/api/recipes', recipeRoutes_1.default);
app.use('/api/chat', chatRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/subscriptions', subscriptionRoutes_1.default);
app.use('/api/webhooks', webhookRoutes_1.default);
// Mount admin routes
app.use('/api/admin', admin_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Cooking-Assistant API is running',
        queues: {
            recipe: recipeQueue_1.recipeQueue.name,
            chat: chatQueue_1.chatQueue.name,
            image: imageQueue_1.imageQueue.name
        }
    });
});
// 404 handler for undefined routes
app.use((req, res, next) => {
    res.status(404).json({
        error: {
            message: 'Resource not found',
            status: 404
        }
    });
});
// Add Sentry error handler before the express error handler
(0, sentry_1.addSentryErrorHandler)(app);
// Global error handling middleware
// NOTE: This should be the LAST middleware added
app.use(errorMiddleware_1.errorHandler);
// Export the configured app instance
exports.default = app;
//# sourceMappingURL=app.js.map