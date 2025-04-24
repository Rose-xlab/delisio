import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
// Import the Sentry configuration functions
import { initSentry, addSentryErrorHandler } from './config/sentry';
// Import admin routes
import adminRouter from './admin';
import recipeRoutes from './routes/recipeRoutes';
import chatRoutes from './routes/chatRoutes';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import webhookRoutes from './routes/webhookRoutes';
import { recipeQueue } from './queues/recipeQueue';
import { chatQueue } from './queues/chatQueue';
import { imageQueue } from './queues/imageQueue';
import { optionalAuthenticate, authenticate } from './middleware/authMiddleware';
import { errorHandler } from './middleware/errorMiddleware';
import { httpLogger } from './utils/logger';
import { rateLimiter } from './middleware/rateLimiter';
import { cancellationRoutes } from './middleware/cancellationMiddleware';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Initialize Sentry and add request/tracing handlers
// This needs to be called very early
initSentry(app);

// Set up Bull Board for monitoring queues
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    // Using @ts-ignore to suppress the type incompatibility error between
    // BullMQAdapter and the expected BaseAdapter structure for this version pair.
    // @ts-ignore
    new BullMQAdapter(recipeQueue),
    // @ts-ignore
    new BullMQAdapter(chatQueue),
    // @ts-ignore
    new BullMQAdapter(imageQueue)
  ],
  serverAdapter: serverAdapter,
});

// Middleware for Bull Board - protect with authentication in production
if (process.env.NODE_ENV === 'production') {
  app.use('/admin/queues', authenticate, serverAdapter.getRouter());
} else {
  app.use('/admin/queues', serverAdapter.getRouter());
}

// Regular middleware
app.use(express.json({ limit: '1mb' })); // Limit request size
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
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/webhooks', webhookRoutes);
// Mount admin routes
app.use('/api/admin', adminRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Cooking-Assistant API is running',
    queues: {
      recipe: recipeQueue.name,
      chat: chatQueue.name,
      image: imageQueue.name
    }
  });
});

// 404 handler for undefined routes
// This should be after all defined routes
app.use((req, res, next) => {
  res.status(404).json({
    error: {
      message: 'Resource not found',
      status: 404
    }
  });
});

// Add Sentry error handler before the express error handler
// This must be after all controllers and routes, and before other error handlers
addSentryErrorHandler(app);

// Global error handling middleware
// NOTE: This should be the LAST middleware added
app.use(errorHandler);

// Export the configured app instance
export default app;