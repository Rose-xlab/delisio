// src/utils/validationUtils.ts

import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

/**
 * Generic validation middleware factory
 * @param schema Joi schema for validation
 * @returns Express middleware function
 */
export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown keys from the validated data
      errors: {
        wrap: {
          label: '' // Remove quotes around keys in error messages
        }
      }
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      // Consistent error response structure
      return res.status(400).json({
        error: {
          message: `Validation error: ${errorMessage}`,
          status: 400,
          details: error.details.map(detail => ({ // Provide structured details
            message: detail.message,
            path: detail.path,
            type: detail.type,
          }))
        }
      });
    }

    next(); // Proceed to the next middleware/handler if validation passes
  };
};

// Recipe validation schema
export const recipeSchema = Joi.object({
  query: Joi.string().required().min(2).max(200)
    .messages({
      'string.empty': 'Recipe query cannot be empty',
      'string.min': 'Recipe query must be at least 2 characters long',
      'string.max': 'Recipe query cannot exceed 200 characters',
      'any.required': 'Recipe query is required'
    }),
  save: Joi.boolean().optional()
});

// Chat message validation schema
export const chatMessageSchema = Joi.object({
  message: Joi.string().required().min(1).max(500)
    .messages({
      'string.empty': 'Message cannot be empty',
      'string.min': 'Message must be at least 1 character long',
      'string.max': 'Message cannot exceed 500 characters',
      'any.required': 'Message is required'
    }),
  conversation_id: Joi.string().uuid().optional(), // Assuming conversation_id is a UUID
  message_history: Joi.array().items(
    Joi.object({
      role: Joi.string().valid('user', 'assistant').required(),
      content: Joi.string().required()
    })
  ).optional()
});

// User registration validation schema
export const registerSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string().min(6).required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    }),
  name: Joi.string().min(2).max(50).required()
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters',
      'any.required': 'Name is required'
    })
});

// User login validation schema
export const loginSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string().required()
    .messages({
      'any.required': 'Password is required'
    })
});

// User preferences validation schema - UPDATED
export const userPreferencesSchema = Joi.object({
  dietaryRestrictions: Joi.array().items(Joi.string()).optional().default([]),
  favoriteCuisines: Joi.array().items(Joi.string()).optional().default([]),
  allergies: Joi.array().items(Joi.string()).optional().default([]),
  cookingSkill: Joi.string().trim().lowercase().valid('beginner', 'intermediate', 'advanced').optional().default('beginner')
    .messages({
      'any.only': 'Cooking skill must be one of [beginner, intermediate, advanced]'
    }),
  // --- ADDED VALIDATION FOR likedFoodCategoryIds ---
  likedFoodCategoryIds: Joi.array().items(Joi.string().trim()).optional().default([]) 
  // Ensures it's an array of strings, trims whitespace from each ID.
  // It's optional and defaults to an empty array if not provided.
});