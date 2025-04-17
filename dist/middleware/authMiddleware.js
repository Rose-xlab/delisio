"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthenticate = exports.authenticate = void 0;
const authService_1 = require("../services/authService");
/**
 * Middleware to check if user is authenticated
 */
const authenticate = async (req, res, next) => {
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
        const user = await (0, authService_1.verifyToken)(token);
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
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({
            error: {
                message: 'Authentication failed.',
                status: 401
            }
        });
    }
};
exports.authenticate = authenticate;
/**
 * Optional authentication middleware
 * Does not reject if no token or invalid token, just doesn't set req.user
 */
const optionalAuthenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const user = await (0, authService_1.verifyToken)(token);
            if (user) {
                req.user = user;
            }
        }
        next();
    }
    catch (error) {
        // Just continue if auth fails
        next();
    }
};
exports.optionalAuthenticate = optionalAuthenticate;
//# sourceMappingURL=authMiddleware.js.map