/**
 * Logger utility for the application
 * This is a production-ready logging implementation using Winston
 */
import winston from 'winston';
import 'winston-daily-rotate-file';
import express from 'express';
declare const logger: winston.Logger;
declare const httpLogger: (req: express.Request, res: express.Response, next: express.NextFunction) => void;
export { logger, httpLogger };
