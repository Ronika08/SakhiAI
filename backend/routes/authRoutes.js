/**
 * routes/authRoutes.js
 *
 * Authentication routes. Mounted at `/api/auth`.
 * Public: register, login, refresh, logout (refresh-token based),
 *         forgot-password, reset-password
 * Protected: me (get/update), change-password
 */

import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateMe,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/authController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { authLimiter, passwordResetLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', optionalAuth, logout);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);

router.get('/me', protect, getMe);
router.patch('/me', protect, updateMe);
router.post('/change-password', authLimiter, protect, changePassword);

export default router;
