import express from 'express';
import {
  register,
  login,
  getMe,
  sendVerificationEmailHandler,
  verifyEmailHandler,
} from '../controllers/authController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public auth routes
router.post('/register', register);
router.post('/login', login);

// Email verification routes
router.post('/send-verification', optionalAuth, sendVerificationEmailHandler);
router.post('/resend-verification', optionalAuth, sendVerificationEmailHandler);
router.post('/verify-email', verifyEmailHandler);
// Reject GET requests on verification endpoint to prevent automatic link scanners from consuming tokens
router.get('/verify-email', (req, res) => {
  return res.status(405).json({
    success: false,
    message: 'Email verification requires explicit POST confirmation to prevent automated link scanners from consuming tokens.',
  });
});

// Protected routes
router.get('/me', protect, getMe);

export default router;
