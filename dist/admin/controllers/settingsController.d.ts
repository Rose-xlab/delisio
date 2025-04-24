import { Request, Response, NextFunction } from 'express';
/**
 * Get system settings
 */
export declare const getSettings: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Update system settings
 */
export declare const updateSettings: (req: Request, res: Response, next: NextFunction) => Promise<void>;
