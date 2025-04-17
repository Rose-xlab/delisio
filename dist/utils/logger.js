"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogger = exports.logger = void 0;
/**
 * Logger utility for the application
 * This is a production-ready logging implementation using Winston
 */
const winston_1 = __importDefault(require("winston"));
require("winston-daily-rotate-file");
// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Define level based on environment
const level = () => {
    const env = process.env.NODE_ENV || 'development';
    return env === 'development' ? 'debug' : 'info';
};
// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};
// Add colors to winston
winston_1.default.addColors(colors);
// Custom format for console output
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`));
// Custom format for file output (no colors, includes stack traces)
const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
// Create a daily rotate file transport for error logs
const errorRotateFile = new winston_1.default.transports.DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'error',
    format: fileFormat,
});
// Create a daily rotate file transport for all logs
const combinedRotateFile = new winston_1.default.transports.DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: fileFormat,
});
// Define transports
// FIX: Add explicit type annotation to allow different transport types
const transports = [
    // Console transport for development
    new winston_1.default.transports.Console({
        level: level(),
        format: consoleFormat,
    }),
];
// Add file transports in production
// Create logs directory if it doesn't exist (optional, Winston might handle this)
// import fs from 'fs';
// const logDir = 'logs';
// if (!fs.existsSync(logDir)) {
//   fs.mkdirSync(logDir);
// }
if (process.env.NODE_ENV === 'production') {
    transports.push(errorRotateFile);
    transports.push(combinedRotateFile);
}
// Create the logger
const logger = winston_1.default.createLogger({
    level: level(),
    levels,
    transports,
    exitOnError: false, // Recommended: don't exit on handled exceptions
});
exports.logger = logger;
// HTTP request logging middleware
// Use specific Express types if available for better type safety
const httpLogger = (req, res, next) => {
    // Don't log health checks
    if (req.path === '/health') {
        return next();
    }
    const startHrTime = process.hrtime();
    // Log when the request completes
    res.on('finish', () => {
        const elapsedHrTime = process.hrtime(startHrTime);
        const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1000000;
        logger.http(`${req.method} ${req.originalUrl} [${res.statusCode}] ${elapsedTimeInMs.toFixed(3)}ms | IP: ${req.ip} | User-Agent: ${req.get('user-agent')}`);
    });
    next();
};
exports.httpLogger = httpLogger;
//# sourceMappingURL=logger.js.map