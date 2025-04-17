"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
/**
 * Custom error class with status code
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
/**
 * Handler for operational errors
 */
const handleOperationalError = (err, res) => {
    res.status(err.statusCode).json({
        error: {
            message: err.message,
            status: err.statusCode
        }
    });
};
/**
 * Handler for OpenAI API errors
 */
const handleOpenAIError = (err, res) => {
    const statusCode = err.status || 500;
    const message = err.message || 'Error processing request with AI service';
    res.status(statusCode).json({
        error: {
            message,
            status: statusCode,
            type: 'OpenAIError'
        }
    });
};
/**
 * Handler for Supabase errors
 */
const handleSupabaseError = (err, res) => {
    let statusCode = 500;
    let message = 'Database operation failed';
    // Handle specific Supabase error codes
    if (err.code === 'PGRST301') {
        statusCode = 404;
        message = 'Resource not found';
    }
    else if (err.code === 'PGRST204') {
        statusCode = 403;
        message = 'Access denied';
    }
    else if (err.code === '23505') {
        statusCode = 409;
        message = 'Resource already exists';
    }
    else if (err.message && err.message.includes('auth')) {
        statusCode = 401;
        message = 'Authentication failed';
    }
    res.status(statusCode).json({
        error: {
            message,
            status: statusCode,
            type: 'DatabaseError',
            code: err.code
        }
    });
};
/**
 * Handler for validation errors
 */
const handleValidationError = (err, res) => {
    res.status(400).json({
        error: {
            message: 'Validation error',
            status: 400,
            details: err.details || err.message
        }
    });
};
/**
 * Handler for unexpected errors in development
 */
const handleDevError = (err, res) => {
    console.error('ERROR 💥', err);
    res.status(500).json({
        error: {
            message: err.message,
            status: 500,
            stack: err.stack,
            type: err.name
        }
    });
};
/**
 * Handler for unexpected errors in production
 */
const handleProdError = (err, res) => {
    // Don't leak error details in production
    res.status(500).json({
        error: {
            message: 'Something went wrong',
            status: 500
        }
    });
};
/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    // If response is already sent, move to next middleware
    if (res.headersSent) {
        return next(err);
    }
    // Set default status code if not present
    err.statusCode = err.statusCode || 500;
    // Log error for debugging
    console.error(`Error: ${err.message}`, {
        path: req.path,
        method: req.method,
        statusCode: err.statusCode,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    // Handle different types of errors
    if (err.isOperational) {
        // Handle known operational errors
        handleOperationalError(err, res);
    }
    else if (err.name === 'OpenAIError' || (err.message && err.message.includes('openai'))) {
        // Handle OpenAI-specific errors
        handleOpenAIError(err, res);
    }
    else if (err.name === 'SupabaseError' || err.code?.startsWith('PGRST') || err.code?.startsWith('23')) {
        // Handle Supabase-specific errors
        handleSupabaseError(err, res);
    }
    else if (err.name === 'ValidationError' || (err.details && Array.isArray(err.details))) {
        // Handle validation errors
        handleValidationError(err, res);
    }
    else {
        // Handle unexpected errors based on environment
        if (process.env.NODE_ENV === 'development') {
            handleDevError(err, res);
        }
        else {
            handleProdError(err, res);
        }
    }
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorMiddleware.js.map