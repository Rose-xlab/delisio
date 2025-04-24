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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPerformanceMetrics = exports.cancelJob = exports.retryJob = exports.getFailedJobs = exports.getQueueStatus = void 0;
const errorMiddleware_1 = require("../../middleware/errorMiddleware");
const logger_1 = require("../../utils/logger");
const jobService = __importStar(require("../services/jobService"));
/**
 * Get status of all queues
 */
const getQueueStatus = async (req, res, next) => {
    try {
        const queues = await jobService.getAllQueueStats();
        res.status(200).json(queues);
    }
    catch (error) {
        logger_1.logger.error('Error getting queue status:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch queue status', 500));
    }
};
exports.getQueueStatus = getQueueStatus;
/**
 * Get failed jobs with pagination
 */
const getFailedJobs = async (req, res, next) => {
    try {
        const filters = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            queue: req.query.queue || 'all'
        };
        const failedJobs = await jobService.getFailedJobs(filters);
        res.status(200).json(failedJobs);
    }
    catch (error) {
        logger_1.logger.error('Error getting failed jobs:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch failed jobs', 500));
    }
};
exports.getFailedJobs = getFailedJobs;
/**
 * Retry a failed job
 */
const retryJob = async (req, res, next) => {
    try {
        const jobId = req.params.id;
        const { queue } = req.body;
        if (!jobId || !queue) {
            throw new errorMiddleware_1.AppError('Job ID and queue name are required', 400);
        }
        const result = await jobService.retryJob(queue, jobId);
        res.status(200).json({
            success: true,
            message: `Job ${jobId} in queue ${queue} retried successfully`,
            result
        });
    }
    catch (error) {
        logger_1.logger.error(`Error retrying job ${req.params.id}:`, error);
        if (error instanceof errorMiddleware_1.AppError) {
            next(error);
        }
        else {
            next(new errorMiddleware_1.AppError('Failed to retry job', 500));
        }
    }
};
exports.retryJob = retryJob;
/**
 * Cancel a job
 */
const cancelJob = async (req, res, next) => {
    try {
        const jobId = req.params.id;
        const { queue } = req.body;
        if (!jobId || !queue) {
            throw new errorMiddleware_1.AppError('Job ID and queue name are required', 400);
        }
        const result = await jobService.cancelJob(queue, jobId);
        res.status(200).json({
            success: true,
            message: `Job ${jobId} in queue ${queue} cancelled successfully`,
            result
        });
    }
    catch (error) {
        logger_1.logger.error(`Error cancelling job ${req.params.id}:`, error);
        if (error instanceof errorMiddleware_1.AppError) {
            next(error);
        }
        else {
            next(new errorMiddleware_1.AppError('Failed to cancel job', 500));
        }
    }
};
exports.cancelJob = cancelJob;
/**
 * Get performance metrics for jobs
 */
const getPerformanceMetrics = async (req, res, next) => {
    try {
        const queue = req.query.queue || 'all';
        const period = req.query.period || '24h';
        const metrics = await jobService.getJobPerformanceMetrics(queue, period);
        res.status(200).json(metrics);
    }
    catch (error) {
        logger_1.logger.error('Error getting job performance metrics:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch job performance metrics', 500));
    }
};
exports.getPerformanceMetrics = getPerformanceMetrics;
//# sourceMappingURL=jobController.js.map