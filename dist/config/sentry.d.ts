import * as Sentry from '@sentry/node';
import express from 'express';
export declare const initSentry: (app: express.Application) => void;
export declare const addSentryErrorHandler: (app: express.Application) => void;
export declare const captureException: (error: Error, context?: Record<string, any>) => void;
export declare const initWorkerSentry: (workerName: string) => typeof Sentry;
