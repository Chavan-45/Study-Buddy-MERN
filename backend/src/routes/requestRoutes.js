import express from 'express';
import {
  createStudyRequest,
  getIncomingRequests,
  getSentRequests,
  acceptStudyRequest,
  rejectStudyRequest,
  cancelStudyRequest,
} from '../controllers/requestController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All study request routes require authentication
router.use(protect);

router.post('/', createStudyRequest);
router.get('/incoming', getIncomingRequests);
router.get('/sent', getSentRequests);
router.put('/:id/accept', acceptStudyRequest);
router.put('/:id/reject', rejectStudyRequest);
router.put('/:id/cancel', cancelStudyRequest);

export default router;
