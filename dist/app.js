"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const recipeRoutes_1 = __importDefault(require("./routes/recipeRoutes"));
const chatRoutes_1 = __importDefault(require("./routes/chatRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const authMiddleware_1 = require("./middleware/authMiddleware");
const errorMiddleware_1 = require("./middleware/errorMiddleware");
const logger_1 = require("./utils/logger");
const rateLimiter_1 = require("./middleware/rateLimiter");
// Load environment variables
dotenv_1.default.config();
// Initialize Express app
const app = (0, express_1.default)();
// Middleware
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
// Mount routes
app.use('/api/recipes', recipeRoutes_1.default);
app.use('/api/chat', chatRoutes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Cooking-Assistant API is running' });
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
// Global error handling middleware
// NOTE: This should be the LAST middleware added
app.use(errorMiddleware_1.errorHandler);
// Export the configured app instance
exports.default = app;
//# sourceMappingURL=app.js.map