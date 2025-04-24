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
exports.updateSettings = exports.getSettings = void 0;
const errorMiddleware_1 = require("../../middleware/errorMiddleware");
const logger_1 = require("../../utils/logger");
const settingsService = __importStar(require("../services/settingsService"));
/**
 * Get system settings
 */
const getSettings = async (req, res, next) => {
    try {
        const settings = await settingsService.getSystemSettings();
        res.status(200).json(settings);
    }
    catch (error) {
        logger_1.logger.error('Error getting system settings:', error);
        next(new errorMiddleware_1.AppError('Failed to fetch system settings', 500));
    }
};
exports.getSettings = getSettings;
/**
 * Update system settings
 */
const updateSettings = async (req, res, next) => {
    try {
        const settings = req.body;
        if (!settings) {
            throw new errorMiddleware_1.AppError('Settings data is required', 400);
        }
        await settingsService.updateSystemSettings(settings);
        res.status(200).json({
            success: true,
            message: 'System settings updated successfully'
        });
    }
    catch (error) {
        logger_1.logger.error('Error updating system settings:', error);
        if (error instanceof errorMiddleware_1.AppError) {
            next(error);
        }
        else {
            next(new errorMiddleware_1.AppError('Failed to update system settings', 500));
        }
    }
};
exports.updateSettings = updateSettings;
//# sourceMappingURL=settingsController.js.map