// src/routes/authRoutes.ts
import express from 'express';
import { authenticate } from '../middleware/authMiddleware';
import {
  signUp as signUpService,
  signIn as signInService,
  signOut as signOutService,
  getCurrentUserWithPreferences,
  updatePreferences,
  resetPassword,
  deleteUserAccount
} from '../services/authService'; 

import { ClientUserPreferencesPayload } from '../services/authService'; 
import { PostgrestError } from '@supabase/supabase-js'; // <-- ADD THIS IMPORT

import {
  validateRequest,
  registerSchema,
  loginSchema,
  userPreferencesSchema 
} from '../utils/validationUtils';
import { AppError } from '../middleware/errorMiddleware'; // Assuming AppError is correctly defined here
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/auth/signup
 */
router.post('/signup', validateRequest(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const user = await signUpService(email, password, name);
    res.status(201).json({ 
        message: "User registered successfully. Please check your email for confirmation if required.",
        userId: user.id 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/signin
 */
router.post('/signin', validateRequest(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user: authUser, session } = await signInService(email, password);
    
    const fullUserProfile = await getCurrentUserWithPreferences(authUser.id);
    
    if (!fullUserProfile) {
        logger.error(`SignIn: User ${authUser.id} signed in but full profile not found.`);
        return next(new AppError('Signed in, but could not retrieve user profile.', 404));
    }

    res.status(200).json({
      user: fullUserProfile,
      session 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/signout
 */
router.post('/signout', authenticate, async (req, res, next) => {
  try {
    await signOutService(); 
    res.status(200).json({ message: 'Successfully signed out' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/me
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    if (!req.user?.id) {
        return next(new AppError('Authentication error: User ID not found in request.', 401));
    }
    const userProfile = await getCurrentUserWithPreferences(req.user.id);
    if (!userProfile) {
        return next(new AppError('User profile not found.', 404));
    }
    res.status(200).json({ user: userProfile });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/reset-password
 */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') { 
      return next(new AppError('Please provide a valid email address.', 400));
    }
    await resetPassword(email);
    res.status(200).json({ message: 'If an account exists for this email, a password reset link has been sent.' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/auth/preferences
 */
router.put('/preferences', authenticate, validateRequest(userPreferencesSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
        return next(new AppError('Authentication error: User ID not found in request.', 401));
    }

    const preferencesPayload: ClientUserPreferencesPayload = req.body;

    logger.info(`Controller /api/auth/preferences: Updating preferences for user ${userId}`, preferencesPayload);

    const updatedDbPreferences = await updatePreferences(userId, preferencesPayload);
    
    res.status(200).json({ preferences: updatedDbPreferences });

  } catch (error) {
    logger.error(`Controller /api/auth/preferences: Error updating preferences for user ${req.user?.id}:`, error);
    if (error instanceof AppError) {
        return next(error);
    }
    // Check for PostgrestError specifically
    // Line 144 where the error was reported:
    const pgError = error as PostgrestError; 
    if (pgError && pgError.message && typeof pgError.code === 'string') { // Added typeof check for pgError.code
        // Attempt to parse pgError.code as a number for HTTP status, default to 500
        const statusCode = parseInt(pgError.code, 10);
        return next(new AppError(`Database error updating preferences: ${pgError.message}`, !isNaN(statusCode) ? statusCode : 500));
    }
    next(new AppError('Failed to update preferences due to an unexpected error.', 500));
  }
});

/**
 * @route   DELETE /api/auth/me/delete
 */
router.delete('/me/delete', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id; 
    if (!userId) {
      return next(new AppError('Authentication error: User ID not found.', 401));
    }

    logger.info(`AuthRoutes: Received request to delete account for user ID: ${userId}`);
    await deleteUserAccount(userId);

    res.status(204).send(); 
    logger.info(`AuthRoutes: Account successfully processed for deletion for user ID: ${userId}`);

  } catch (error) {
    logger.error(`AuthRoutes: Failed to delete account for user ${req.user?.id}:`, error);
    if (error instanceof AppError) {
      return next(error); 
    }
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during account deletion.';
    next(new AppError(errorMessage, 500));
  }
});


export default router;