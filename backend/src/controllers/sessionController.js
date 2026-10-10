import mongoose from 'mongoose';
import Session from '../models/Session.js';
import { createNotificationHelper } from '../utils/notificationUtils.js';

/**
 * Validate a Google Meet URL
 */
export function validateGoogleMeetUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  try {
    const parsed = new URL(trimmed);
    const validProtocol = parsed.protocol === 'https:';
    const host = parsed.hostname.toLowerCase();
    const validHost = host === 'meet.google.com' || host.endsWith('.meet.google.com');
    const path = parsed.pathname ? parsed.pathname.replace(/^\/+/, '') : '';
    const hasPath = path.length >= 3;
    return Boolean(validProtocol && validHost && hasPath);
  } catch {
    return false;
  }
}

/**
 * @desc    Get all study sessions for authenticated user (as learner or helper)
 * @route   GET /api/sessions
 * @access  Private
 */
export async function getMySessions(req, res, next) {
  try {
    const currentUserId = req.user._id;
    const filter = {
      $or: [{ learnerId: currentUserId }, { helperId: currentUserId }],
    };

    if (req.query.status) {
      const allowed = ['upcoming', 'completed', 'cancelled'];
      const statusParam = req.query.status.trim().toLowerCase();
      if (allowed.includes(statusParam)) {
        filter.status = statusParam;
      }
    }

    const sessions = await Session.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions: sessions.map((s) => s.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get session details by ID (Participant only)
 * @route   GET /api/sessions/:id
 * @access  Private
 */
export async function getSessionById(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    // Verify authenticated user is a participant (learner or helper)
    const isLearner = session.learnerId.toString() === req.user._id.toString();
    const isHelper = session.helperId.toString() === req.user._id.toString();

    if (!isLearner && !isHelper) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this study session.',
      });
    }

    return res.status(200).json({
      success: true,
      session: session.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update physical meeting point for a session (Learner or Helper)
 * @route   PUT /api/sessions/:id/meeting-point
 * @access  Private
 */
export async function updateMeetingPoint(req, res, next) {
  try {
    const { id } = req.params;
    const { meetingPoint } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    const isLearner = session.learnerId.toString() === req.user._id.toString();
    const isHelper = session.helperId.toString() === req.user._id.toString();

    if (!isLearner && !isHelper) {
      return res.status(403).json({
        success: false,
        message: 'Only session participants can update the meeting point.',
      });
    }

    const cleanPoint = String(meetingPoint || '').trim();

    if (!cleanPoint) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid meeting point.',
      });
    }

    if (cleanPoint.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Meeting point cannot exceed 150 characters.',
      });
    }

    session.meetingPoint = cleanPoint;
    session.meetingPointUpdatedBy = req.user._id;
    session.meetingPointUpdatedAt = new Date();
    await session.save();

    const otherParticipantId = isLearner ? session.helperId : session.learnerId;
    await createNotificationHelper({
      recipientId: otherParticipantId,
      senderId: req.user._id,
      senderName: req.user.name,
      type: 'meeting_point_updated',
      title: 'Meeting Point Updated 📍',
      message: `${req.user.name} updated the meeting point to: "${cleanPoint}".`,
      relatedSessionId: session._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Meeting point updated successfully.',
      session: session.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Save or update Google Meet link (Tutor/Helper only)
 * @route   PUT /api/sessions/:id/meeting-link
 * @access  Private
 */
export async function saveMeetingLink(req, res, next) {
  try {
    const { id } = req.params;
    const meetingUrl = req.body.meetingUrl || req.body.meetingLink;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    // Participant verification
    const isLearner = session.learnerId.toString() === req.user._id.toString();
    const isHelper = session.helperId.toString() === req.user._id.toString();

    if (!isLearner && !isHelper) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view or modify this study session.',
      });
    }

    // Authorization: Only the tutor/helper can add or update the meeting link
    if (!isHelper) {
      return res.status(403).json({
        success: false,
        message: 'Only the authorized tutor can add or update the Google Meet link.',
      });
    }

    // Verify session mode supports online
    const mode = String(session.mode || '').trim().toLowerCase();
    if (mode !== 'online' && mode !== 'both') {
      return res.status(400).json({
        success: false,
        message: 'This session does not support online meetings.',
      });
    }

    const cleanUrl = String(meetingUrl || '').trim();
    if (!validateGoogleMeetUrl(cleanUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Google Meet link (e.g. https://meet.google.com/abc-defg-hij).',
      });
    }

    session.meetingUrl = cleanUrl;
    session.onlineSessionStatus = 'live';
    session.meetingStartedAt = session.meetingStartedAt || new Date();
    session.meetingStartedBy = session.meetingStartedBy || req.user._id;
    await session.save();

    await createNotificationHelper({
      recipientId: session.learnerId,
      senderId: req.user._id,
      senderName: req.user.name,
      type: 'online_session_started',
      title: 'Google Meet Link Saved 🚀',
      message: `${req.user.name} added the Google Meet link for your ${session.subject} session. Click to join!`,
      relatedSessionId: session._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Meeting link saved successfully.',
      session: session.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Start online Google Meet session (Helper only)
 * @route   PUT /api/sessions/:id/start-online
 * @access  Private
 */
export async function startOnlineSession(req, res, next) {
  try {
    const { id } = req.params;
    const meetingUrl = req.body.meetingUrl || req.body.meetingLink;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    const isLearner = session.learnerId.toString() === req.user._id.toString();
    const isHelper = session.helperId.toString() === req.user._id.toString();

    if (!isLearner && !isHelper) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view or modify this study session.',
      });
    }

    // Authorization: Only the helper may start an online session
    if (!isHelper) {
      return res.status(403).json({
        success: false,
        message: 'Only the tutor/helper can start an online session.',
      });
    }

    // Verify session mode supports online
    const mode = String(session.mode || '').trim().toLowerCase();
    if (mode !== 'online' && mode !== 'both') {
      return res.status(400).json({
        success: false,
        message: 'This session does not support online meetings.',
      });
    }

    const cleanUrl = String(meetingUrl || '').trim();
    if (!validateGoogleMeetUrl(cleanUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid Google Meet link (e.g. https://meet.google.com/abc-defg-hij).',
      });
    }

    session.meetingUrl = cleanUrl;
    session.onlineSessionStatus = 'live';
    session.meetingStartedAt = new Date();
    session.meetingStartedBy = req.user._id;
    await session.save();

    await createNotificationHelper({
      recipientId: session.learnerId,
      senderId: req.user._id,
      senderName: req.user.name,
      type: 'online_session_started',
      title: 'Online Session Started 🚀',
      message: `${req.user.name} started your ${session.subject} online session. Join now!`,
      relatedSessionId: session._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Online session started.',
      session: session.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    End online Google Meet session (Helper only)
 * @route   PUT /api/sessions/:id/end-online
 * @access  Private
 */
export async function endOnlineSession(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    if (session.helperId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the tutor/helper can end an online session.',
      });
    }

    session.onlineSessionStatus = 'ended';
    session.meetingEndedAt = new Date();
    await session.save();

    await createNotificationHelper({
      recipientId: session.learnerId,
      senderId: req.user._id,
      senderName: req.user.name,
      type: 'online_session_ended',
      title: 'Online Session Ended 🏁',
      message: `Your ${session.subject} online session with ${req.user.name} has ended.`,
      relatedSessionId: session._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Online session ended.',
      session: session.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Directly mark session as completed (Helper only)
 * @route   PUT /api/sessions/:id/complete
 * @access  Private
 */
export async function completeSession(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    if (session.helperId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the tutor/helper can directly mark a session as completed.',
      });
    }

    if (session.status === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Session already completed.',
        session: session.toJSON(),
      });
    }

    if (session.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot complete a session that has already been cancelled.',
      });
    }

    session.status = 'completed';
    await session.save();

    await createNotificationHelper({
      recipientId: session.learnerId,
      senderId: req.user._id,
      senderName: req.user.name,
      type: 'session_completed',
      title: 'Session Completed ✅',
      message: `Your ${session.subject} session with ${req.user.name} was marked completed.`,
      relatedSessionId: session._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Study session marked as completed.',
      session: session.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Directly mark session as cancelled (Helper only)
 * @route   PUT /api/sessions/:id/cancel
 * @access  Private
 */
export async function cancelSession(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    if (session.helperId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the tutor/helper can directly cancel a session.',
      });
    }

    if (session.status === 'cancelled') {
      return res.status(200).json({
        success: true,
        message: 'Session already cancelled.',
        session: session.toJSON(),
      });
    }

    if (session.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a session that has already been completed.',
      });
    }

    session.status = 'cancelled';
    await session.save();

    await createNotificationHelper({
      recipientId: session.learnerId,
      senderId: req.user._id,
      senderName: req.user.name,
      type: 'session_cancelled',
      title: 'Session Cancelled ❌',
      message: `${req.user.name} cancelled your ${session.subject} session.`,
      relatedSessionId: session._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Study session cancelled.',
      session: session.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Learner requests session completion or cancellation
 * @route   POST /api/sessions/:id/action-request
 * @access  Private
 */
export async function requestSessionAction(req, res, next) {
  try {
    const { id } = req.params;
    const { actionType } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    // Only the learner can request action
    if (session.learnerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the learner can request session completion or cancellation.',
      });
    }

    if (session.status !== 'upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Action requests can only be sent for upcoming sessions.',
      });
    }

    if (actionType !== 'completion' && actionType !== 'cancellation') {
      return res.status(400).json({
        success: false,
        message: "actionType must be either 'completion' or 'cancellation'.",
      });
    }

    session.sessionActionRequest = {
      type: actionType,
      requestedBy: req.user._id,
      status: 'pending',
      createdAt: new Date(),
      respondedAt: null,
    };

    await session.save();

    const isComp = actionType === 'completion';
    await createNotificationHelper({
      recipientId: session.helperId,
      senderId: req.user._id,
      senderName: req.user.name,
      type: isComp ? 'session_completion_requested' : 'session_cancellation_requested',
      title: isComp ? 'Session Completion Requested ⏳' : 'Session Cancellation Requested ⏳',
      message: `${req.user.name} requested to ${isComp ? 'mark completed' : 'cancel'} your ${session.subject} session.`,
      relatedSessionId: session._id,
    });

    return res.status(200).json({
      success: true,
      message: `Session ${actionType} requested. Waiting for tutor approval.`,
      session: session.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Helper approves or rejects learner's action request
 * @route   PUT /api/sessions/:id/action-respond
 * @access  Private
 */
export async function respondToSessionActionRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    // Only the helper can respond
    if (session.helperId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the tutor/helper can approve or reject action requests.',
      });
    }

    if (
      !session.sessionActionRequest ||
      session.sessionActionRequest.status !== 'pending'
    ) {
      return res.status(400).json({
        success: false,
        message: 'No pending action request found for this session.',
      });
    }

    const actionType = session.sessionActionRequest.type;
    const approved = Boolean(isApproved);

    if (approved) {
      session.status = actionType === 'completion' ? 'completed' : 'cancelled';
      session.sessionActionRequest.status = 'approved';
    } else {
      session.sessionActionRequest.status = 'rejected';
    }

    session.sessionActionRequest.respondedAt = new Date();
    await session.save();

    const isComp = actionType === 'completion';
    if (approved) {
      await createNotificationHelper({
        recipientId: session.learnerId,
        senderId: req.user._id,
        senderName: req.user.name,
        type: isComp ? 'session_completed' : 'session_cancelled',
        title: isComp ? 'Session Completed ✅' : 'Session Cancelled ❌',
        message: isComp
          ? `Your ${session.subject} session was marked completed by ${req.user.name}.`
          : `Your ${session.subject} session cancellation request was approved by ${req.user.name}.`,
        relatedSessionId: session._id,
      });
    } else {
      await createNotificationHelper({
        recipientId: session.learnerId,
        senderId: req.user._id,
        senderName: req.user.name,
        type: 'request_declined',
        title: 'Request Declined ❌',
        message: `Your request to ${isComp ? 'complete' : 'cancel'} the ${session.subject} session was declined by ${req.user.name}.`,
        relatedSessionId: session._id,
      });
    }

    return res.status(200).json({
      success: true,
      message: approved ? `Session ${actionType} approved.` : `Session ${actionType} request declined.`,
      session: session.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}
