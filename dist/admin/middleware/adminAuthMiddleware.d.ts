import { Request, Response, NextFunction } from 'express';
export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'super_admin';
    createdAt: Date;
}
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
export declare const authenticateAdmin: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Additional middleware to check for super admin privileges
 */
export declare const requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => void;
