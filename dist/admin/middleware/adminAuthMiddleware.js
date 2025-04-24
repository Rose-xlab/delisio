"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = exports.authenticateAdmin = void 0;
const authService_1 = require("../../services/authService");
const errorMiddleware_1 = require("../../middleware/errorMiddleware");
const logger_1 = require("../../utils/logger");
const supabase_1 = require("../../config/supabase");
/**
 * Checks if user has admin role in Supabase
 */
const authenticateAdmin = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorMiddleware_1.AppError('Access denied. No token provided.', 401);
        }
        // Extract token
        const token = authHeader.split(' ')[1];
        // Verify token using existing auth service
        const user = await (0, authService_1.verifyToken)(token);
        if (!user) {
            throw new errorMiddleware_1.AppError('Invalid token.', 401);
        }
        // Check if user has admin role in Supabase
        const { data, error } = await supabase_1.supabase
            .from('admin_users')
            .select('role, created_at')
            .eq('user_id', user.id)
            .single();
        if (error || !data) {
            logger_1.logger.warn(`User ${user.id} attempted to access admin without permissions`);
            throw new errorMiddleware_1.AppError('Access denied. Admin privileges required.', 403);
        }
        // Set admin user in request object
        req.adminUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: data.role,
            createdAt: new Date(data.created_at)
        };
        next();
    }
    catch (error) {
        if (error instanceof errorMiddleware_1.AppError) {
            next(error);
        }
        else {
            logger_1.logger.error('Admin authentication error:', error);
            next(new errorMiddleware_1.AppError('Authentication failed.', 401));
        }
    }
};
exports.authenticateAdmin = authenticateAdmin;
/**
 * Additional middleware to check for super admin privileges
 */
const requireSuperAdmin = (req, res, next) => {
    if (!req.adminUser) {
        next(new errorMiddleware_1.AppError('Authentication required.', 401));
        return;
    }
    if (req.adminUser.role !== 'super_admin') {
        logger_1.logger.warn(`Admin ${req.adminUser.id} attempted to access super admin route`);
        next(new errorMiddleware_1.AppError('Super admin privileges required.', 403));
        return;
    }
    next();
};
exports.requireSuperAdmin = requireSuperAdmin;
//# sourceMappingURL=adminAuthMiddleware.js.map