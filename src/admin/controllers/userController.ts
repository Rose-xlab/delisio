import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorMiddleware';
import { logger } from '../../utils/logger';
import * as userService from '../services/userService';

/**
 * Get paginated list of users with filters
 */
export const getUsers = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      search: req.query.search as string || '',
      tier: req.query.tier as string || '',
      sortBy: req.query.sortBy as string || 'created_at',
      sortDir: req.query.sortDir as 'asc' | 'desc' || 'desc'
    };
    
    const users = await userService.getUsersList(filters);
    res.status(200).json(users);
  } catch (error) {
    logger.error('Error getting users list:', error);
    next(new AppError('Failed to fetch users', 500));
  }
};

/**
 * Get detailed information about a specific user
 */
export const getUserDetails = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.params.id;
    
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
    
    const userDetails = await userService.getUserDetails(userId);
    
    if (!userDetails) {
      throw new AppError('User not found', 404);
    }
    
    res.status(200).json(userDetails);
  } catch (error) {
    logger.error(`Error getting user details for ID ${req.params.id}:`, error);
    
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to fetch user details', 500));
    }
  }
};

/**
 * Update a user's subscription
 */
export const updateUserSubscription = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.params.id;
    const { tier } = req.body;
    
    if (!userId || !tier) {
      throw new AppError('User ID and subscription tier are required', 400);
    }
    
    // Validate tier
    if (!['free', 'basic', 'premium'].includes(tier)) {
      throw new AppError('Invalid subscription tier', 400);
    }
    
    await userService.updateSubscription(userId, tier);
    
    res.status(200).json({
      success: true,
      message: `User subscription updated to ${tier}`
    });
  } catch (error) {
    logger.error(`Error updating subscription for user ${req.params.id}:`, error);
    
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to update user subscription', 500));
    }
  }
};

/**
 * Reset a user's usage limits
 */
export const resetUserLimits = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.params.id;
    
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
    
    await userService.resetUsageLimits(userId);
    
    res.status(200).json({
      success: true,
      message: 'User usage limits reset successfully'
    });
  } catch (error) {
    logger.error(`Error resetting limits for user ${req.params.id}:`, error);
    
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to reset user limits', 500));
    }
  }
};