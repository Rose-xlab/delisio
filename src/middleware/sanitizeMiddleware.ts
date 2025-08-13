// src/middleware/sanitizeMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Define a type for the incoming, untyped message history items
interface MessageHistoryItem {
  role: any;
  content: any;
}

// Define a type for the message object after it has been sanitized
interface SanitizedMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const sanitizeChatInput = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Sanitize main message
        if (req.body.message !== undefined) {
            const original = req.body.message;
            
            // Convert to string if not already
            let sanitized = String(original);
            
            // Remove null bytes and control characters
            sanitized = sanitized.replace(/\0/g, '');
            sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            
            // Normalize whitespace
            sanitized = sanitized.replace(/\s+/g, ' ').trim();
            
            // If empty after sanitization, provide default
            if (!sanitized) {
                sanitized = "Hi";
            }
            
            req.body.message = sanitized;
            
            if (original !== sanitized) {
                logger.info('Message sanitized', {
                    originalLength: original.length,
                    sanitizedLength: sanitized.length
                });
            }
        }
        
        // Sanitize message history
        if (req.body.message_history && Array.isArray(req.body.message_history)) {
            req.body.message_history = req.body.message_history
                .slice(-10) // Keep only last 10 messages
                .map((msg: MessageHistoryItem): SanitizedMessage => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: String(msg.content || '')
                        .substring(0, 1000)
                        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
                        .trim()
                }))
                .filter((msg: SanitizedMessage) => msg.content);
        }
        
        next();
    } catch (error) {
        logger.error('Error in sanitize middleware:', error);
        next(); // Continue even if sanitization fails
    }
};