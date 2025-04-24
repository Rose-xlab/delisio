import * as Sentry from '@sentry/node';
// Removed: import * as Tracing from '@sentry/tracing'; - Deprecated
import express from 'express';

export const initSentry = (app: express.Application) => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      // Updated: Use Express integration directly from @sentry/node
      new Sentry.Integrations.Express({ app }),
    ],
    tracesSampleRate: 0.5,
    environment: process.env.NODE_ENV,
    release: 'delisio@1.0.0', // Keep your versioning strategy
  });

  // Add Sentry request handler and tracing
  // These MUST be added early in the middleware chain in app.ts via this function call
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
};

export const addSentryErrorHandler = (app: express.Application) => {
  // Add Sentry error handler before your own error handler
  // This MUST be added after all routes/controllers and before other error handlers in app.ts
  app.use(Sentry.Handlers.errorHandler());
};

export const captureException = (error: Error, context?: Record<string, any>) => {
  Sentry.withScope(scope => {
    if (context) {
      if (context.tags) {
        Object.entries(context.tags).forEach(([key, value]) => {
          scope.setTag(key, String(value));
        });
      }

      if (context.user) {
        scope.setUser(context.user);
      }

      if (context.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
    }

    Sentry.captureException(error);
  });
};

// For worker processes
export const initWorkerSentry = (workerName: string) => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: 'delisio@1.0.0', // Keep your versioning strategy
    tracesSampleRate: 0.3,
  });

  // Configure the scope *after* init to set global tags for this worker instance
  Sentry.configureScope(scope => {
    scope.setTag('worker', workerName);
  });

  return Sentry;
};