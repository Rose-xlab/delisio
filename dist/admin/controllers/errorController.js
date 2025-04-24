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
exports.getUserImpact = exports.getFrequentErrors = exports.getErrorTrends = void 0;
const errorMiddleware_1 = require("../../middleware/errorMiddleware");
const logger_1 = require("../../utils/logger");
const errorService = __importStar(require("../services/errorService"));
/**
 * Get error trends from Sentry
 */
const getErrorTrends = async (req, res, next) => {
    try {
        const period = req.query.period || '7d';
        const trends = await errorService.getSentryErrorTrends(period);
        res.status(200).json(trends);
    }
    catch (error) {
        logger_1.logger.error('Error getting error trends from Sentry:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch error trends', 500));
    }
};
exports.getErrorTrends = getErrorTrends;
/**
 * Get most frequent errors from Sentry
 */
const getFrequentErrors = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const errors = await errorService.getSentryFrequentErrors(limit);
        res.status(200).json(errors);
    }
    catch (error) {
        logger_1.logger.error('Error getting frequent errors from Sentry:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch frequent errors', 500));
    }
};
exports.getFrequentErrors = getFrequentErrors;
/**
 * Get user impact assessment from Sentry
 */
const getUserImpact = async (req, res, next) => {
    try {
        const impact = await errorService.getSentryUserImpact();
        res.status(200).json(impact);
    }
    catch (error) {
        logger_1.logger.error('Error getting user impact from Sentry:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch user impact assessment', 500));
    }
};
exports.getUserImpact = getUserImpact;
//# sourceMappingURL=errorController.js.map