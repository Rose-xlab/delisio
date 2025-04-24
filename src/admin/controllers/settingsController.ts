import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorMiddleware';
import { logger } from '../../utils/logger';
import * as settingsService from '../services/settingsService';

/**
 * Get system settings
 */
export const getSettings = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const settings = await settingsService.getSystemSettings();
    res.status(200).json(settings);
  } catch (error) {
    logger.error('Error getting system settings:', error);
    next(new AppError('Failed to fetch system settings', 500));
  }
};

/**
 * Update system settings
 */
export const updateSettings = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const settings = req.body;
    
    if (!settings) {
      throw new AppError('Settings data is required', 400);
    }
    
    await settingsService.updateSystemSettings(settings);
    
    res.status(200).json({
      success: true,
      message: 'System settings updated successfully'
    });
  } catch (error) {
    logger.error('Error updating system settings:', error);
    
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to update system settings', 500));
    }
  }
};