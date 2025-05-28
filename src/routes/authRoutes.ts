// src/routes/authRoutes.ts
import express from 'express';
import { authenticate } from '../middleware/authMiddleware';
import {
  signUp as signUpService,
  signIn as signInService,
  signOut as signOutService,
  getCurrentUserWithPreferences,
  updatePreferences, // This is the service function
  resetPassword
} from '../services/authService'; // Assuming this path is correct

// Import the correctly named interface from authService.ts
import { ClientUserPreferencesPayload } from '../services/authService'; 

import {
  validateRequest,
  registerSchema,
  loginSchema,
  userPreferencesSchema // This schema should also align with ClientUserPreferencesPayload
} from '../utils/validationUtils';
import { AppError } from '../middleware/errorMiddleware';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/auth/signup
 */
router.post('/signup', validateRequest(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    const user = await signUpService(email, password, name);
    res.status(201).json({ user });
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
 */
router.put('/preferences', authenticate, validateRequest(userPreferencesSchema), async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
        return next(new AppError('Authentication error: User ID not found in request.', 401));
    }

    // Use the correctly imported ClientUserPreferencesPayload
    const preferencesPayload: ClientUserPreferencesPayload = req.body;

    logger.info(`Controller /api/auth/preferences: Updating preferences for user ${userId}`, preferencesPayload);

    const updatedDbPreferences = await updatePreferences(userId, preferencesPayload);
    
    res.status(200).json({ preferences: updatedDbPreferences });

  } catch (error) {
    logger.error(`Controller /api/auth/preferences: Error updating preferences for user ${req.user?.id}:`, error);
    if (error instanceof AppError) {
        return next(error);
    }
    const pgError = error as { code?: string, message?: string };
    if (pgError.code && pgError.message) {
        return next(new AppError(`Database error updating preferences: ${pgError.message}`, 500));
    }
    next(new AppError('Failed to update preferences due to an unexpected error.', 500));
  }
});

export default router;