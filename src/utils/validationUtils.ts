//Users\mukas\Downloads\delisio\delisio\src\utils\validationUtils.ts

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
      abortEarly: false,
      stripUnknown: true,
      errors: {
        wrap: {
          label: ''
        }
      }
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      
      return res.status(400).json({
        error: {
          message: `Validation error: ${errorMessage}`,
          status: 400,
          details: error.details
        }
      });
    }

    next();
  };
};

// Recipe validation schema - removed imageStyle field
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

// Updated chat message validation schema with conversation_id and message_history
export const chatMessageSchema = Joi.object({
  message: Joi.string().required().min(1).max(500)
    .messages({
      'string.empty': 'Message cannot be empty',
      'string.min': 'Message must be at least 1 character long',
      'string.max': 'Message cannot exceed 500 characters',
      'any.required': 'Message is required'
    }),
  conversation_id: Joi.string().optional(),
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

// User preferences validation schema
export const userPreferencesSchema = Joi.object({
  dietaryRestrictions: Joi.array().items(Joi.string()).optional(),
  favoriteCuisines: Joi.array().items(Joi.string()).optional(),
  allergies: Joi.array().items(Joi.string()).optional(),
  cookingSkill: Joi.string().valid('beginner', 'intermediate', 'advanced').optional()
    .messages({
      'any.only': 'Cooking skill must be beginner, intermediate, or advanced'
    })
});