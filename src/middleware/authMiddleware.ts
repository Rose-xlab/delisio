//src\middleware\authMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';

/**
 * Extend Express Request interface to include user property
 */
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

/**
 * Middleware to check if user is authenticated
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          message: 'Access denied. No token provided.',
          status: 401
        }
      });
      return;
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const user = await verifyToken(token);
    
    if (!user) {
      res.status(401).json({
        error: {
          message: 'Invalid token.',
          status: 401
        }
      });
      return;
    }
    
    // Set user in request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      error: {
        message: 'Authentication failed.',
        status: 401
      }
    });
  }
};

/**
 * Optional authentication middleware
 * Does not reject if no token or invalid token, just doesn't set req.user
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const user = await verifyToken(token);
      
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Just continue if auth fails
    next();
  }
};