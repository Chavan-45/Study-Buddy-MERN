import express from 'express';
import {
  getProfile,
  getProfileById,
  updateProfile,
  getPotentialBuddies,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All user routes require valid Bearer JWT authentication
router.use(protect);

router.get('/profile', getProfile);
router.get('/profile/:id', getProfileById);
router.put('/profile', updateProfile);
router.get('/buddies', getPotentialBuddies);

export default router;
