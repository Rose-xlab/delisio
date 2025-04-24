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
exports.getConversionRates = exports.getChurnAnalysis = exports.getRevenueMetrics = exports.getTiersOverview = void 0;
const errorMiddleware_1 = require("../../middleware/errorMiddleware");
const logger_1 = require("../../utils/logger");
const subscriptionService = __importStar(require("../services/subscriptionService"));
/**
 * Get subscription tiers overview
 */
const getTiersOverview = async (req, res, next) => {
    try {
        const tiers = await subscriptionService.getSubscriptionTiersOverview();
        res.status(200).json(tiers);
    }
    catch (error) {
        logger_1.logger.error('Error getting subscription tiers overview:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch subscription tiers data', 500));
    }
};
exports.getTiersOverview = getTiersOverview;
/**
 * Get revenue metrics
 */
const getRevenueMetrics = async (req, res, next) => {
    try {
        const period = req.query.period || '30d';
        const revenue = await subscriptionService.getRevenueMetrics(period);
        res.status(200).json(revenue);
    }
    catch (error) {
        logger_1.logger.error('Error getting revenue metrics:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch revenue metrics', 500));
    }
};
exports.getRevenueMetrics = getRevenueMetrics;
/**
 * Get churn analysis
 */
const getChurnAnalysis = async (req, res, next) => {
    try {
        const period = req.query.period || '90d';
        const churn = await subscriptionService.getChurnAnalysis(period);
        res.status(200).json(churn);
    }
    catch (error) {
        logger_1.logger.error('Error getting churn analysis:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch churn analysis', 500));
    }
};
exports.getChurnAnalysis = getChurnAnalysis;
/**
 * Get tier conversion rates
 */
const getConversionRates = async (req, res, next) => {
    try {
        const conversions = await subscriptionService.getConversionRates();
        res.status(200).json(conversions);
    }
    catch (error) {
        logger_1.logger.error('Error getting conversion rates:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch conversion rates', 500));
    }
};
exports.getConversionRates = getConversionRates;
//# sourceMappingURL=subscriptionController.js.map