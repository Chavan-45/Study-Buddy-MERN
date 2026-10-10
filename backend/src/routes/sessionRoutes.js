import express from 'express';
import {
  getMySessions,
  getSessionById,
  updateMeetingPoint,
  saveMeetingLink,
  startOnlineSession,
  endOnlineSession,
  completeSession,
  cancelSession,
  requestSessionAction,
  respondToSessionActionRequest,
} from '../controllers/sessionController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All session routes require authentication
router.use(protect);

router.get('/', getMySessions);
router.get('/:id', getSessionById);
router.put('/:id/meeting-point', updateMeetingPoint);
router.put('/:id/meeting-link', saveMeetingLink);
router.put('/:id/start-online', startOnlineSession);
router.put('/:id/end-online', endOnlineSession);
router.put('/:id/complete', completeSession);
router.put('/:id/cancel', cancelSession);
router.post('/:id/action-request', requestSessionAction);
router.put('/:id/action-respond', respondToSessionActionRequest);

export default router;
