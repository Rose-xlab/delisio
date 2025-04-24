import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { Json } from '../../types/supabase';

// Define the system settings structure
export interface SystemSettings {
  ai: {
    gptModel: string;
    dalleModel: string;
    maxTokens: number;
    temperature: number;
  };
  limits: {
    recipeGenerationsPerMonthFree: number;
    recipeGenerationsPerMonthBasic: number;
    chatMessagesPerDayFree: number;
    chatMessagesPerDayBasic: number;
  };
  features: {
    imageGenerationEnabled: boolean;
    chatEnabled: boolean;
    subscriptionsEnabled: boolean;
  };
  monitoring: {
    sentryEnabled: boolean;
    errorReportingLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

/**
 * Get system settings
 */
export const getSystemSettings = async (): Promise<SystemSettings> => {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .single();
    
    if (error) {
      logger.error('Error fetching system settings:', error);
      // Return default settings if not found
      return getDefaultSettings();
    }
    
    if (!data) {
      // Initialize with default settings if no record exists
      const defaultSettings = getDefaultSettings();
      await initializeSettings(defaultSettings);
      return defaultSettings;
    }
    
    // Use type assertion to tell TypeScript that we know the structure is correct
    return data.settings as unknown as SystemSettings;
  } catch (error) {
    logger.error('Error in getSystemSettings:', error);
    throw error;
  }
};

/**
 * Update system settings
 */
export const updateSystemSettings = async (settings: SystemSettings): Promise<void> => {
  try {
    // Validate settings
    validateSettings(settings);
    
    const { data, error } = await supabase
      .from('system_settings')
      .update({
        settings: settings as unknown as Json,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1) // Assuming there's only one settings record
      .select();
    
    if (error) {
      logger.error('Error updating system settings:', error);
      throw new Error('Failed to update system settings');
    }
    
    // If no rows updated, try to insert
    if (!data || data.length === 0) {
      await initializeSettings(settings);
    }
    
    logger.info('System settings updated successfully');
  } catch (error) {
    logger.error('Error in updateSystemSettings:', error);
    throw error;
  }
};

/**
 * Initialize settings if they don't exist
 */
const initializeSettings = async (settings: SystemSettings): Promise<void> => {
  try {
    const { error } = await supabase
      .from('system_settings')
      .insert({
        id: 1, // Use a known ID for the single settings record
        settings: settings as unknown as Json,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      logger.error('Error initializing system settings:', error);
      throw new Error('Failed to initialize system settings');
    }
    
    logger.info('System settings initialized successfully');
  } catch (error) {
    logger.error('Error in initializeSettings:', error);
    throw error;
  }
};

/**
 * Validate settings object
 */
const validateSettings = (settings: SystemSettings): void => {
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
const getDefaultSettings = (): SystemSettings => {
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