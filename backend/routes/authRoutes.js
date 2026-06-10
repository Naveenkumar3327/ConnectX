import express from 'express';
import {
  registerUser,
  authUser,
  logoutUser,
  refreshAccessToken,
  forgotPassword,
  verifyOTP,
  resetPassword
} from '../controllers/authController.js';
import upload from '../middleware/uploadMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Register user with profile picture upload support
router.post('/signup', upload.single('profilePicture'), authLimiter, registerUser);

// Login
router.post('/login', authLimiter, authUser);

// Logout
router.post('/logout', logoutUser);

// Token refresh
router.post('/refresh-token', refreshAccessToken);

// Forgot/Reset password routes
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/reset-password', authLimiter, resetPassword);

export default router;
