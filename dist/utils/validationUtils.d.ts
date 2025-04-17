import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
/**
 * Generic validation middleware factory
 * @param schema Joi schema for validation
 * @returns Express middleware function
 */
export declare const validateRequest: (schema: Joi.ObjectSchema) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const recipeSchema: Joi.ObjectSchema<any>;
export declare const chatMessageSchema: Joi.ObjectSchema<any>;
export declare const registerSchema: Joi.ObjectSchema<any>;
export declare const loginSchema: Joi.ObjectSchema<any>;
export declare const userPreferencesSchema: Joi.ObjectSchema<any>;
