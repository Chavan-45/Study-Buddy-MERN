import express from 'express';
import {
  submitReview,
  getUserReviews,
  getSessionReview,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Publicly readable reviews for a user profile
router.get('/user/:id', getUserReviews);

// Protected routes
router.post('/', protect, submitReview);
router.get('/session/:sessionId', protect, getSessionReview);

export default router;
