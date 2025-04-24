// routes/authRoutes.ts
import express from 'express';
import * as authController from '../controllers/authController';
import { authenticateAdmin } from '../middleware/adminAuthMiddleware';

const router = express.Router();

// Public routes
router.post('/signin', authController.signIn);

// Protected routes (require authentication)
router.post('/signout', authenticateAdmin, authController.signOut);
router.get('/verify', authenticateAdmin, authController.verifyToken);

export default router;