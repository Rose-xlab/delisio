import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../services/authService';
import { AppError } from '../../middleware/errorMiddleware';
import { logger } from '../../utils/logger';
import { supabase } from '../../config/supabase';

// Interface for admin user
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
  createdAt: Date;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminUser;
    }
  }
}

/**
 * Checks if user has admin role in Supabase
 */
export const authenticateAdmin = async (
  req: Request, 
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', 401);
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    // Verify token using existing auth service
    const user = await verifyToken(token);
    
    if (!user) {
      throw new AppError('Invalid token.', 401);
    }
    
    // Check if user has admin role in Supabase
    const { data, error } = await supabase
      .from('admin_users')
      .select('role, created_at')
      .eq('user_id', user.id)
      .single();
    
    if (error || !data) {
      logger.warn(`User ${user.id} attempted to access admin without permissions`);
      throw new AppError('Access denied. Admin privileges required.', 403);
    }
    
    // Set admin user in request object
    req.adminUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: data.role as 'admin' | 'super_admin',
      createdAt: new Date(data.created_at)
    };
    
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      logger.error('Admin authentication error:', error);
      next(new AppError('Authentication failed.', 401));
    }
  }
};

/**
 * Additional middleware to check for super admin privileges
 */
export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.adminUser) {
    next(new AppError('Authentication required.', 401));
    return;
  }
  
  if (req.adminUser.role !== 'super_admin') {
    logger.warn(`Admin ${req.adminUser.id} attempted to access super admin route`);
    next(new AppError('Super admin privileges required.', 403));
    return;
  }
  
  next();
};