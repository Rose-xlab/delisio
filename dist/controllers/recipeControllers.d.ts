import { Request, Response, NextFunction } from 'express';
/**
 * Generates a complete recipe including optional time fields and permanent image URLs.
 * Uses the queuing system.
 */
export declare const generateRecipe: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Cancels a recipe generation job (handles both queued and non-queued)
 */
export declare const cancelRecipeGeneration: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Gets the status of a recipe generation job (handles both queued and non-queued)
 */
export declare const getRecipeStatus: (req: Request, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
/**
 * Checks if a queue processing system is active for recipe generation
 */
export declare const getQueueStatus: (_req: Request, res: Response, next: NextFunction) => Promise<void>;
