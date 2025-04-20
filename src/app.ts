import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import recipeRoutes from './routes/recipeRoutes';
import chatRoutes from './routes/chatRoutes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import { optionalAuthenticate } from './middleware/authMiddleware';
import { errorHandler } from './middleware/errorMiddleware';
import { httpLogger } from './utils/logger';
import { rateLimiter } from './middleware/rateLimiter';
import { cancellationRoutes } from './middleware/cancellationMiddleware'; // Add the cancellation middleware

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(express.json({ limit: '1mb' }));  // Limit request size
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// HTTP request logging
app.use(httpLogger);

// Apply optional authentication to all routes
app.use(optionalAuthenticate);

// Apply rate limiting
app.use(rateLimiter);

// Apply cancellation middleware (before mounting routes)
app.use(cancellationRoutes);

// Mount routes
app.use('/api/recipes', recipeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

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
app.use(errorHandler);

// Export the configured app instance
export default app;