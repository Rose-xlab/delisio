import { Request, Response, NextFunction } from 'express';
// Make sure AdminUser type is imported if it's used explicitly, 
// though often the global declaration handles this.
// import { AdminUser } from '../types'; // Adjust path if needed
import { AppError } from '../middleware/errorMiddleware';
import { logger } from '../utils/logger';
import * as authService from '../../services/authService';

/**
 * Sign in handler
 */
export const signIn = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }
    
    const authData = await authService.signIn(email, password);
    
    res.status(200).json(authData);
  } catch (error) {
    logger.error('Sign in error:', error);
    
    if (error instanceof AppError) {
      next(error);
    } else {
      // Ensure a generic but appropriate error for unknown auth issues
      next(new AppError('Authentication failed', 401)); 
    }
  }
};

/**
 * Sign out handler
 */
export const signOut = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Assumption: Based on previous errors, authService.signOut() takes no arguments
    // and identifies the user/session via context (e.g., req.adminUser from middleware).
    await authService.signOut(); 
    
    res.status(200).json({
      success: true,
      message: 'Successfully signed out'
    });
  } catch (error) {
    logger.error('Sign out error:', error);
    next(new AppError('Failed to sign out', 500));
  }
};

/**
 * Verify token handler - simple endpoint to verify token validity
 */
export const verifyToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // This endpoint is protected by the admin auth middleware,
    // which should validate the token and attach user info.
    // The type for req.adminUser should be correctly inferred
    // from the declaration in adminAuthMiddleware.ts or a central types file.
    
    res.status(200).json({
      valid: true,
      // req.adminUser should now correctly have the type 'AdminUser | undefined'
      user: req.adminUser 
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    next(new AppError('Token verification failed', 401));
  }
};

// Removed the redundant 'declare global' block from here, 
// as the property 'adminUser' is already declared (likely in adminAuthMiddleware.ts)
// with the correct type 'AdminUser | undefined'.