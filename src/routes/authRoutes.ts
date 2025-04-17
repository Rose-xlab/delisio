import express from 'express';
import { 
  signUp, 
  signIn, 
  signOut, 
  getCurrentUser,
  resetPassword
} from '../services/authService';
import { authenticate } from '../middleware/authMiddleware';
import {
  saveUserPreferences,
  getUserPreferences
} from '../services/supabaseService';
import { 
  validateRequest, 
  registerSchema, 
  loginSchema, 
  userPreferencesSchema 
} from '../utils/validationUtils';
import { AppError } from '../middleware/errorMiddleware';

const router = express.Router();

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', validateRequest(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    
    const user = await signUp(email, password, name);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/signin
 * @desc    Sign in existing user
 * @access  Public
 */
router.post('/signin', validateRequest(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    const { user, session } = await signIn(email, password);
    
    // Get user preferences if available
    const preferences = await getUserPreferences(user.id);
    if (preferences) {
      user.preferences = preferences;
    }
    
    res.status(200).json({
      user,
      session
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/signout
 * @desc    Sign out current user
 * @access  Private
 */
router.post('/signout', authenticate, async (req, res, next) => {
  try {
    await signOut();
    res.status(200).json({ message: 'Successfully signed out' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    // User is already set in req.user by authenticate middleware
    const preferences = await getUserPreferences(req.user.id);
    
    const user = {
      ...req.user,
      preferences: preferences || undefined
    };
    
    res.status(200).json({ user });
  } catch (error) {
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
      throw new AppError('Please provide email', 400);
    }
    
    await resetPassword(email);
    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/auth/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', authenticate, validateRequest(userPreferencesSchema), async (req, res, next) => {
  try {
    const { dietaryRestrictions, favoriteCuisines, allergies, cookingSkill } = req.body;
    
    const preferences = {
      dietaryRestrictions: dietaryRestrictions || [],
      favoriteCuisines: favoriteCuisines || [],
      allergies: allergies || [],
      cookingSkill: cookingSkill || 'beginner'
    };
    
    const updatedPreferences = await saveUserPreferences(req.user.id, preferences);
    res.status(200).json({ preferences: updatedPreferences });
  } catch (error) {
    next(error);
  }
});

export default router;