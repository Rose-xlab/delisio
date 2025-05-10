import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger'; // Assuming you have a logger utility

/**
 * Custom error class with status code and optional user-facing reply.
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  userFacingReply?: string; // <-- ADDED for a specific user-friendly message

  constructor(message: string, statusCode: number, userFacingReply?: string) { // <-- MODIFIED constructor
    super(message); // This 'message' is the technical error message
    this.statusCode = statusCode;
    this.userFacingReply = userFacingReply; // <-- ASSIGN the user-facing reply
    this.isOperational = true; // All AppErrors are considered operational

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handler for operational errors (AppError instances)
 */
const handleOperationalError = (err: AppError, res: Response) => {
  // Use the userFacingReply if provided, otherwise fallback to a generic message or err.message
  const replyMessage = err.userFacingReply || "I'm sorry, an operational error occurred. Please try again.";
  // The err.message is the technical error detail
  const technicalErrorMessage = err.message;

  res.status(err.statusCode).json({
    reply: replyMessage, // User-facing message
    error: technicalErrorMessage, // Technical error message
    suggestions: null // Maintain consistent structure
  });
};

/**
 * Handler for OpenAI API errors
 */
const handleOpenAIError = (err: any, res: Response) => {
  const statusCode = err.status || 500;
  // err.message from OpenAI is often technical, so we provide a standard user-facing reply
  const userFacingReply = "I'm sorry, there was an issue with the AI service. Please try again.";
  const technicalMessage = err.message || 'Error processing request with AI service';

  logger.error('OpenAI API Error:', { status: statusCode, message: technicalMessage, type: err.type, code: err.code, param: err.param });

  res.status(statusCode).json({
    reply: userFacingReply,
    error: technicalMessage, // Technical OpenAI error
    suggestions: null,
    // Optionally include more specific OpenAI error details if needed by client for some reason
    // openAIErrorDetails: { type: err.type, code: err.code, param: err.param }
  });
};

/**
 * Handler for Supabase errors
 */
const handleSupabaseError = (err: any, res: Response) => {
  let statusCode = 500;
  let userFacingReply = 'I am sorry, a database operation failed. Please try again.'; // General user-facing
  let technicalMessage = 'Database operation failed'; // General technical

  // More specific messages based on Supabase error codes
  if (err.code === 'PGRST301') { // Not found
    statusCode = 404;
    userFacingReply = 'The requested resource was not found.';
    technicalMessage = `Resource not found (Supabase code: ${err.code})`;
  } else if (err.code === 'PGRST204') { // Access denied (often RLS)
    statusCode = 403;
    userFacingReply = 'You do not have permission to access this resource.';
    technicalMessage = `Access denied (Supabase code: ${err.code})`;
  } else if (err.code === '23505') { // Unique constraint violation
    statusCode = 409;
    userFacingReply = 'This item already exists or conflicts with an existing one.';
    technicalMessage = `Conflict / Unique constraint violation (Supabase code: ${err.code})`;
  } else if (err.message && err.message.includes('auth')) { // Generic auth issue
    statusCode = 401;
    userFacingReply = 'Authentication failed. Please check your credentials.';
    technicalMessage = `Authentication failed (Supabase message: ${err.message})`;
  } else if (err.message) {
    technicalMessage = `Supabase Error: ${err.message} (Code: ${err.code || 'N/A'})`;
  }

  logger.error('Supabase Error:', { status: statusCode, message: err.message, code: err.code, details: err.details, hint: err.hint });

  res.status(statusCode).json({
    reply: userFacingReply,
    error: technicalMessage, // Technical Supabase error
    suggestions: null,
    // supabaseErrorCode: err.code // Optionally include code if client needs it
  });
};

/**
 * Handler for validation errors
 */
const handleValidationError = (err: any, res: Response) => {
  // For validation errors, err.message or err.details often contains useful info for the user or developer
  const userFacingReply = 'There was a problem with the data you provided. Please check and try again.';
  const technicalMessage = `Validation error: ${err.details || err.message}`;

  logger.warn('Validation Error:', { message: err.message, details: err.details });

  res.status(400).json({
    reply: userFacingReply,
    error: technicalMessage, // Details of validation
    suggestions: null,
    // validationDetails: err.details // Optionally include details if client can use them
  });
};

/**
 * Handler for unexpected errors in development
 */
const handleDevError = (err: any, res: Response) => {
  // In development, send detailed error
  logger.error('DEVELOPMENT ERROR 💥:', err);

  res.status(err.statusCode || 500).json({
    reply: "An unexpected error occurred (Dev Mode). See 'error' field for details.",
    error: err.message, // Technical message
    suggestions: null,
    stack: err.stack,
    errorType: err.name
  });
};

/**
 * Handler for unexpected errors in production
 */
const handleProdError = (err: any, res: Response) => {
  // In production, send a generic message for unexpected errors
  logger.error('PRODUCTION ERROR 💥:', err); // Log the full error for server-side debugging

  res.status(500).json({
    reply: 'I am sorry, an unexpected internal error occurred. Our team has been notified.',
    error: 'Internal Server Error', // Generic technical message for prod
    suggestions: null
  });
};

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction // Must include next for Express to recognize it as error middleware
) => {
  if (res.headersSent) {
    logger.warn('Error handler called after headers were sent. Passing to default Express handler.', { path: req.path, error: err.message });
    return next(err);
  }

  // Ensure statusCode is set, default to 500
  err.statusCode = err.statusCode || 500;

  // Log the error (using your logger if available, otherwise console.error)
  // The logger in other handlers (handleOpenAIError, etc.) provides more specific context.
  // This is a general catch-all log.
  logger.error(`GlobalErrorHandler caught error on path ${req.path}:`, {
    message: err.message,
    statusCode: err.statusCode,
    name: err.name,
    isOperational: err.isOperational,
    // Avoid logging full stack in production for generic errors here, specific handlers might do it.
    stack: process.env.NODE_ENV === 'development' ? err.stack : 'Stack hidden in prod for generic handler'
  });


  if (err instanceof AppError) { // AppError instances are always operational
    handleOperationalError(err, res);
  } else if (err.name === 'OpenAIError' || err.message?.includes('OpenAI') || err.message?.includes('openai') || err.type?.includes('openai')) {
    // More robust check for OpenAI errors
    handleOpenAIError(err, res);
  } else if (err.name === 'SupabaseError' || err.code?.startsWith('PGRST') || err.code?.startsWith('23') || err.message?.includes('supabase')) {
    // More robust check for Supabase errors
    handleSupabaseError(err, res);
  } else if (err.name === 'ValidationError' || (err.details && Array.isArray(err.details))) {
    handleValidationError(err, res);
  }
  // Add other specific error type checks here if needed
  // else if (err instanceof SomeOtherSpecificError) { handleSomeOtherError(err, res); }
  else {
    // Handle truly unexpected errors based on environment
    if (process.env.NODE_ENV === 'development') {
      handleDevError(err, res);
    } else {
      // For production, if it's not an AppError or other recognized specific error, treat as unexpected.
      handleProdError(err, res);
    }
  }
};
