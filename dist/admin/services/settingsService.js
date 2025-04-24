"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSystemSettings = exports.getSystemSettings = void 0;
const supabase_1 = require("../../config/supabase");
const logger_1 = require("../../utils/logger");
/**
 * Get system settings
 */
const getSystemSettings = async () => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('system_settings')
            .select('*')
            .single();
        if (error) {
            logger_1.logger.error('Error fetching system settings:', error);
            // Return default settings if not found
            return getDefaultSettings();
        }
        if (!data) {
            // Initialize with default settings if no record exists
            const defaultSettings = getDefaultSettings();
            await initializeSettings(defaultSettings);
            return defaultSettings;
        }
        return data.settings;
    }
    catch (error) {
        logger_1.logger.error('Error in getSystemSettings:', error);
        throw error;
    }
};
exports.getSystemSettings = getSystemSettings;
/**
 * Update system settings
 */
const updateSystemSettings = async (settings) => {
    try {
        // Validate settings
        validateSettings(settings);
        const { data, error } = await supabase_1.supabase
            .from('system_settings')
            .update({
            settings,
            updated_at: new Date().toISOString()
        })
            .eq('id', 1) // Assuming there's only one settings record
            .select();
        if (error) {
            logger_1.logger.error('Error updating system settings:', error);
            throw new Error('Failed to update system settings');
        }
        // If no rows updated, try to insert
        if (!data || data.length === 0) {
            await initializeSettings(settings);
        }
        logger_1.logger.info('System settings updated successfully');
    }
    catch (error) {
        logger_1.logger.error('Error in updateSystemSettings:', error);
        throw error;
    }
};
exports.updateSystemSettings = updateSystemSettings;
/**
 * Initialize settings if they don't exist
 */
const initializeSettings = async (settings) => {
    try {
        const { error } = await supabase_1.supabase
            .from('system_settings')
            .insert({
            id: 1, // Use a known ID for the single settings record
            settings,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        if (error) {
            logger_1.logger.error('Error initializing system settings:', error);
            throw new Error('Failed to initialize system settings');
        }
        logger_1.logger.info('System settings initialized successfully');
    }
    catch (error) {
        logger_1.logger.error('Error in initializeSettings:', error);
        throw error;
    }
};
/**
 * Validate settings object
 */
const validateSettings = (settings) => {
    // Ensure all required properties exist
    if (!settings.ai || !settings.limits || !settings.features || !settings.monitoring) {
        throw new Error('Invalid settings structure: missing required sections');
    }
    // Validate AI settings
    if (!settings.ai.gptModel || !settings.ai.dalleModel) {
        throw new Error('Invalid AI settings: missing model information');
    }
    if (typeof settings.ai.maxTokens !== 'number' || settings.ai.maxTokens <= 0) {
        throw new Error('Invalid AI settings: maxTokens must be a positive number');
    }
    if (typeof settings.ai.temperature !== 'number' || settings.ai.temperature < 0 || settings.ai.temperature > 1) {
        throw new Error('Invalid AI settings: temperature must be between 0 and 1');
    }
    // Validate limits
    if (typeof settings.limits.recipeGenerationsPerMonthFree !== 'number' || settings.limits.recipeGenerationsPerMonthFree < 0) {
        throw new Error('Invalid limits: recipeGenerationsPerMonthFree must be a non-negative number');
    }
    if (typeof settings.limits.recipeGenerationsPerMonthBasic !== 'number' || settings.limits.recipeGenerationsPerMonthBasic < 0) {
        throw new Error('Invalid limits: recipeGenerationsPerMonthBasic must be a non-negative number');
    }
    // Validate features
    if (typeof settings.features.imageGenerationEnabled !== 'boolean') {
        throw new Error('Invalid features: imageGenerationEnabled must be a boolean');
    }
    if (typeof settings.features.chatEnabled !== 'boolean') {
        throw new Error('Invalid features: chatEnabled must be a boolean');
    }
    if (typeof settings.features.subscriptionsEnabled !== 'boolean') {
        throw new Error('Invalid features: subscriptionsEnabled must be a boolean');
    }
    // Validate monitoring
    if (typeof settings.monitoring.sentryEnabled !== 'boolean') {
        throw new Error('Invalid monitoring: sentryEnabled must be a boolean');
    }
    if (!['debug', 'info', 'warn', 'error'].includes(settings.monitoring.errorReportingLevel)) {
        throw new Error('Invalid monitoring: errorReportingLevel must be one of debug, info, warn, error');
    }
};
/**
 * Get default settings
 */
const getDefaultSettings = () => {
    return {
        ai: {
            gptModel: 'gpt-4-turbo',
            dalleModel: 'dall-e-3',
            maxTokens: 4000,
            temperature: 0.7
        },
        limits: {
            recipeGenerationsPerMonthFree: 1,
            recipeGenerationsPerMonthBasic: 5,
            chatMessagesPerDayFree: 10,
            chatMessagesPerDayBasic: 50
        },
        features: {
            imageGenerationEnabled: true,
            chatEnabled: true,
            subscriptionsEnabled: true
        },
        monitoring: {
            sentryEnabled: true,
            errorReportingLevel: 'error'
        }
    };
};
//# sourceMappingURL=settingsService.js.map