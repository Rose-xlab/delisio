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
exports.resetUserLimits = exports.updateUserSubscription = exports.getUserDetails = exports.getUsers = void 0;
const errorMiddleware_1 = require("../../middleware/errorMiddleware");
const logger_1 = require("../../utils/logger");
const userService = __importStar(require("../services/userService"));
/**
 * Get paginated list of users with filters
 */
const getUsers = async (req, res, next) => {
    try {
        const filters = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            search: req.query.search || '',
            tier: req.query.tier || '',
            sortBy: req.query.sortBy || 'created_at',
            sortDir: req.query.sortDir || 'desc'
        };
        const users = await userService.getUsersList(filters);
        res.status(200).json(users);
    }
    catch (error) {
        logger_1.logger.error('Error getting users list:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch users', 500));
    }
};
exports.getUsers = getUsers;
/**
 * Get detailed information about a specific user
 */
const getUserDetails = async (req, res, next) => {
    try {
        const userId = req.params.id;
        if (!userId) {
            throw new errorMiddleware_1.AppError('User ID is required', 400);
        }
        const userDetails = await userService.getUserDetails(userId);
        if (!userDetails) {
            throw new errorMiddleware_1.AppError('User not found', 404);
        }
        res.status(200).json(userDetails);
    }
    catch (error) {
        logger_1.logger.error(`Error getting user details for ID ${req.params.id}:`, error);
        if (error instanceof errorMiddleware_1.AppError) {
            next(error);
        }
        else {
            next(new errorMiddleware_1.AppError('Failed to fetch user details', 500));
        }
    }
};
exports.getUserDetails = getUserDetails;
/**
 * Update a user's subscription
 */
const updateUserSubscription = async (req, res, next) => {
    try {
        const userId = req.params.id;
        const { tier } = req.body;
        if (!userId || !tier) {
            throw new errorMiddleware_1.AppError('User ID and subscription tier are required', 400);
        }
        // Validate tier
        if (!['free', 'basic', 'premium'].includes(tier)) {
            throw new errorMiddleware_1.AppError('Invalid subscription tier', 400);
        }
        await userService.updateSubscription(userId, tier);
        res.status(200).json({
            success: true,
            message: `User subscription updated to ${tier}`
        });
    }
    catch (error) {
        logger_1.logger.error(`Error updating subscription for user ${req.params.id}:`, error);
        if (error instanceof errorMiddleware_1.AppError) {
            next(error);
        }
        else {
            next(new errorMiddleware_1.AppError('Failed to update user subscription', 500));
        }
    }
};
exports.updateUserSubscription = updateUserSubscription;
/**
 * Reset a user's usage limits
 */
const resetUserLimits = async (req, res, next) => {
    try {
        const userId = req.params.id;
        if (!userId) {
            throw new errorMiddleware_1.AppError('User ID is required', 400);
        }
        await userService.resetUsageLimits(userId);
        res.status(200).json({
            success: true,
            message: 'User usage limits reset successfully'
        });
    }
    catch (error) {
        logger_1.logger.error(`Error resetting limits for user ${req.params.id}:`, error);
        if (error instanceof errorMiddleware_1.AppError) {
            next(error);
        }
        else {
            next(new errorMiddleware_1.AppError('Failed to reset user limits', 500));
        }
    }
};
exports.resetUserLimits = resetUserLimits;
//# sourceMappingURL=userController.js.map