"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userPreferencesSchema = exports.loginSchema = exports.registerSchema = exports.chatMessageSchema = exports.recipeSchema = exports.validateRequest = void 0;
const joi_1 = __importDefault(require("joi"));
/**
 * Generic validation middleware factory
 * @param schema Joi schema for validation
 * @returns Express middleware function
 */
const validateRequest = (schema) => {
    return (req, res, next) => {
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
exports.validateRequest = validateRequest;
// Recipe validation schema
exports.recipeSchema = joi_1.default.object({
    query: joi_1.default.string().required().min(2).max(200)
        .messages({
        'string.empty': 'Recipe query cannot be empty',
        'string.min': 'Recipe query must be at least 2 characters long',
        'string.max': 'Recipe query cannot exceed 200 characters',
        'any.required': 'Recipe query is required'
    }),
    save: joi_1.default.boolean().optional()
});
// Chat message validation schema
exports.chatMessageSchema = joi_1.default.object({
    message: joi_1.default.string().required().min(1).max(500)
        .messages({
        'string.empty': 'Message cannot be empty',
        'string.min': 'Message must be at least 1 character long',
        'string.max': 'Message cannot exceed 500 characters',
        'any.required': 'Message is required'
    })
});
// User registration validation schema
exports.registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required()
        .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
    }),
    password: joi_1.default.string().min(6).required()
        .messages({
        'string.min': 'Password must be at least 6 characters long',
        'any.required': 'Password is required'
    }),
    name: joi_1.default.string().min(2).max(50).required()
        .messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters',
        'any.required': 'Name is required'
    })
});
// User login validation schema
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required()
        .messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
    }),
    password: joi_1.default.string().required()
        .messages({
        'any.required': 'Password is required'
    })
});
// User preferences validation schema
exports.userPreferencesSchema = joi_1.default.object({
    dietaryRestrictions: joi_1.default.array().items(joi_1.default.string()).optional(),
    favoriteCuisines: joi_1.default.array().items(joi_1.default.string()).optional(),
    allergies: joi_1.default.array().items(joi_1.default.string()).optional(),
    cookingSkill: joi_1.default.string().valid('beginner', 'intermediate', 'advanced').optional()
        .messages({
        'any.only': 'Cooking skill must be beginner, intermediate, or advanced'
    })
});
//# sourceMappingURL=validationUtils.js.map