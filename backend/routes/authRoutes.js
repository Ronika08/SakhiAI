/**
 * routes/authRoutes.js
 *
 * Route definitions for authentication. Mounted at `/api/auth` by
 * routes/index.js.
 */

import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * POST /api/auth/register
 * Create a new user account.
 */
router.post('/register', register);

/**
 * POST /api/auth/login
 * Authenticate and receive a JWT.
 */
router.post('/login', login);

/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 */
router.get('/me', protect, getMe);

export default router;
