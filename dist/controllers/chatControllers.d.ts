import { Request, Response, NextFunction } from 'express';
/**
 * Handles incoming chat messages, queues them for processing,
 * and waits for the response within a timeout period.
 */
export declare const handleChatMessage: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Gets status of the chat queue
 */
export declare const getChatQueueStatus: (_req: Request, res: Response, next: NextFunction) => Promise<void>;
