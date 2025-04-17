"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authService_1 = require("../services/authService");
const authMiddleware_1 = require("../middleware/authMiddleware");
const supabaseService_1 = require("../services/supabaseService");
const validationUtils_1 = require("../utils/validationUtils");
const errorMiddleware_1 = require("../middleware/errorMiddleware");
const router = express_1.default.Router();
/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', (0, validationUtils_1.validateRequest)(validationUtils_1.registerSchema), async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        const user = await (0, authService_1.signUp)(email, password, name);
        res.status(201).json({ user });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/auth/signin
 * @desc    Sign in existing user
 * @access  Public
 */
router.post('/signin', (0, validationUtils_1.validateRequest)(validationUtils_1.loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const { user, session } = await (0, authService_1.signIn)(email, password);
        // Get user preferences if available
        const preferences = await (0, supabaseService_1.getUserPreferences)(user.id);
        if (preferences) {
            user.preferences = preferences;
        }
        res.status(200).json({
            user,
            session
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/auth/signout
 * @desc    Sign out current user
 * @access  Private
 */
router.post('/signout', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        await (0, authService_1.signOut)();
        res.status(200).json({ message: 'Successfully signed out' });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authMiddleware_1.authenticate, async (req, res, next) => {
    try {
        // User is already set in req.user by authenticate middleware
        const preferences = await (0, supabaseService_1.getUserPreferences)(req.user.id);
        const user = {
            ...req.user,
            preferences: preferences || undefined
        };
        res.status(200).json({ user });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   POST /api/auth/reset-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/reset-password', async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) {
            throw new errorMiddleware_1.AppError('Please provide email', 400);
        }
        await (0, authService_1.resetPassword)(email);
        res.status(200).json({ message: 'Password reset email sent' });
    }
    catch (error) {
        next(error);
    }
});
/**
 * @route   PUT /api/auth/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', authMiddleware_1.authenticate, (0, validationUtils_1.validateRequest)(validationUtils_1.userPreferencesSchema), async (req, res, next) => {
    try {
        const { dietaryRestrictions, favoriteCuisines, allergies, cookingSkill } = req.body;
        const preferences = {
            dietaryRestrictions: dietaryRestrictions || [],
            favoriteCuisines: favoriteCuisines || [],
            allergies: allergies || [],
            cookingSkill: cookingSkill || 'beginner'
        };
        const updatedPreferences = await (0, supabaseService_1.saveUserPreferences)(req.user.id, preferences);
        res.status(200).json({ preferences: updatedPreferences });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map