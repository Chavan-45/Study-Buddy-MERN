import mongoose from 'mongoose';
import StudyRequest from '../models/StudyRequest.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { createNotificationHelper } from '../utils/notificationUtils.js';

const ALLOWED_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const ALLOWED_MODES = ['Online', 'Offline', 'Both'];

/**
 * @desc    Create a new study request
 * @route   POST /api/requests
 * @access  Private
 */
export async function createStudyRequest(req, res, next) {
  try {
    const requester = req.user;
    const {
      helperId,
      subject,
      requiredLevel,
      day,
      startTime,
      endTime,
      mode,
      location,
      matchPercentage,
      note,
    } = req.body;

    // 1. Validate helper ID
    if (!helperId || !mongoose.Types.ObjectId.isValid(helperId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid helper ID is required.',
      });
    }

    // 2. Prevent self-requests
    if (requester._id.toString() === helperId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a study request to yourself.',
      });
    }

    // 3. Verify helper exists
    const helper = await User.findById(helperId);
    if (!helper) {
      return res.status(404).json({
        success: false,
        message: 'The requested study buddy does not exist.',
      });
    }

    // 4. Validate required study fields
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required.',
      });
    }

    if (!day || !String(day).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Day is required.',
      });
    }

    if (!startTime || !String(startTime).trim() || !endTime || !String(endTime).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Both startTime and endTime are required.',
      });
    }

    const cleanSubject = String(subject).trim();
    const cleanDay = String(day).trim();
    const cleanStartTime = String(startTime).trim();
    const cleanEndTime = String(endTime).trim();

    const selectedMode = mode && ALLOWED_MODES.includes(mode) ? mode : 'Both';
    const selectedLevel = requiredLevel && ALLOWED_LEVELS.includes(requiredLevel)
      ? requiredLevel
      : 'Intermediate';

    // 5. Prevent duplicate pending requests for same participants, subject, and day
    const existingPending = await StudyRequest.findOne({
      requesterId: requester._id,
      helperId: helper._id,
      subject: new RegExp(`^${cleanSubject}$`, 'i'),
      day: new RegExp(`^${cleanDay}$`, 'i'),
      status: 'pending',
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending study request with this student for this subject and day.',
      });
    }

    // 6. Create study request
    const studyRequest = await StudyRequest.create({
      requesterId: requester._id,
      requesterName: requester.name,
      requesterEmail: requester.email,
      requesterPhone: requester.phone || '',
      helperId: helper._id,
      helperName: helper.name,
      helperEmail: helper.email,
      helperPhone: helper.phone || '',
      subject: cleanSubject,
      requiredLevel: selectedLevel,
      day: cleanDay,
      startTime: cleanStartTime,
      endTime: cleanEndTime,
      mode: selectedMode,
      location: String(location || helper.location || 'College Library').trim(),
      matchPercentage: Number(matchPercentage) || 0,
      note: String(note || '').trim().slice(0, 300),
      status: 'pending',
    });

    // 7. Dispatch trusted server notification for the helper
    await createNotificationHelper({
      recipientId: helper._id,
      senderId: requester._id,
      senderName: requester.name,
      type: 'study_request',
      title: 'New Study Request 📩',
      message: `${requester.name} sent you a study request for ${cleanSubject}.`,
      relatedRequestId: studyRequest._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Study request sent successfully.',
      request: studyRequest.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get incoming study requests for the authenticated user
 * @route   GET /api/requests/incoming
 * @access  Private
 */
export async function getIncomingRequests(req, res, next) {
  try {
    const filter = { helperId: req.user._id };

    if (req.query.status) {
      const statuses = req.query.status.split(',').map((s) => s.trim().toLowerCase());
      filter.status = { $in: statuses };
    }

    const requests = await StudyRequest.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests: requests.map((r) => r.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get sent study requests created by the authenticated user
 * @route   GET /api/requests/sent
 * @access  Private
 */
export async function getSentRequests(req, res, next) {
  try {
    const filter = { requesterId: req.user._id };

    if (req.query.status) {
      const statuses = req.query.status.split(',').map((s) => s.trim().toLowerCase());
      filter.status = { $in: statuses };
    }

    const requests = await StudyRequest.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      requests: requests.map((r) => r.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Accept a pending study request and automatically create a session
 * @route   PUT /api/requests/:id/accept
 * @access  Private
 */
export async function acceptStudyRequest(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID.',
      });
    }

    const request = await StudyRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Study request not found.',
      });
    }

    // Only intended recipient/helper can accept
    if (request.helperId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the intended recipient can accept this study request.',
      });
    }

    // Idempotency: if already accepted, return existing session without duplication
    if (request.status === 'accepted') {
      const existingSession = await Session.findOne({ requestId: request._id });
      return res.status(200).json({
        success: true,
        message: 'Request already accepted.',
        request: request.toJSON(),
        session: existingSession ? existingSession.toJSON() : null,
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept a request that is already ${request.status}.`,
      });
    }

    // Update request status to accepted
    request.status = 'accepted';
    await request.save();

    // Check if session was somehow created, or create exactly one session
    let session = await Session.findOne({ requestId: request._id });

    if (!session) {
      session = await Session.create({
        requestId: request._id,
        learnerId: request.requesterId,
        learnerName: request.requesterName,
        learnerEmail: request.requesterEmail,
        learnerPhone: request.requesterPhone,
        helperId: request.helperId,
        helperName: request.helperName,
        helperEmail: request.helperEmail,
        helperPhone: request.helperPhone,
        subject: request.subject,
        requiredLevel: request.requiredLevel || 'Intermediate',
        day: request.day,
        startTime: request.startTime,
        endTime: request.endTime,
        mode: request.mode,
        location: request.location,
        matchPercentage: request.matchPercentage,
        status: 'upcoming',
      });
    }

    // Dispatch trusted notification for the original requester
    await createNotificationHelper({
      recipientId: request.requesterId,
      senderId: req.user._id,
      senderName: req.user.name,
      type: 'request_accepted',
      title: 'Request Accepted 🎉',
      message: `${req.user.name} accepted your ${request.subject} study request.`,
      relatedRequestId: request._id,
      relatedSessionId: session._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Study request accepted and session scheduled.',
      request: request.toJSON(),
      session: session.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Reject a pending study request
 * @route   PUT /api/requests/:id/reject
 * @access  Private
 */
export async function rejectStudyRequest(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID.',
      });
    }

    const request = await StudyRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Study request not found.',
      });
    }

    // Only intended recipient/helper can reject
    if (request.helperId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the intended recipient can reject this study request.',
      });
    }

    if (request.status === 'rejected') {
      return res.status(200).json({
        success: true,
        message: 'Study request already rejected.',
        request: request.toJSON(),
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject a request that is already ${request.status}.`,
      });
    }

    request.status = 'rejected';
    await request.save();

    await createNotificationHelper({
      recipientId: request.requesterId,
      senderId: req.user._id,
      senderName: req.user.name,
      type: 'request_rejected',
      title: 'Request Declined',
      message: `${req.user.name} declined your ${request.subject} study request.`,
      relatedRequestId: request._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Study request rejected.',
      request: request.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Cancel a pending study request (Requester only)
 * @route   PUT /api/requests/:id/cancel
 * @access  Private
 */
export async function cancelStudyRequest(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request ID.',
      });
    }

    const request = await StudyRequest.findById(id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Study request not found.',
      });
    }

    // Only the original requester can cancel
    if (request.requesterId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the requesting student can cancel this study request.',
      });
    }

    if (request.status === 'cancelled') {
      return res.status(200).json({
        success: true,
        message: 'Study request already cancelled.',
        request: request.toJSON(),
      });
    }

    if (request.status === 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a request that has already been accepted. Please manage the scheduled session instead.',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a request that is already ${request.status}.`,
      });
    }

    request.status = 'cancelled';
    await request.save();

    await createNotificationHelper({
      recipientId: request.helperId,
      senderId: req.user._id,
      senderName: req.user.name,
      type: 'request_declined',
      title: 'Request Cancelled',
      message: `${req.user.name} cancelled the ${request.subject} study request.`,
      relatedRequestId: request._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Study request cancelled.',
      request: request.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}
