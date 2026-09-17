import { db, isFirebaseConfigured } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc,
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { createNotification } from './notificationService';

const MOCK_SESSIONS_KEY = 'study_buddy_mock_sessions';

function getMockSessions() {
  try {
    const data = localStorage.getItem(MOCK_SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveMockSessions(sessions) {
  try {
    localStorage.setItem(MOCK_SESSIONS_KEY, JSON.stringify(sessions));
    window.dispatchEvent(new Event('study_sessions_updated'));
  } catch (err) {
    console.error("Failed to save mock sessions", err);
  }
}

/**
 * Validate a Google Meet URL
 */
export function validateGoogleMeetUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  try {
    const parsed = new URL(trimmed);
    const validProtocol = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    const validHost = parsed.hostname.toLowerCase().includes('meet.google.com') || parsed.hostname.toLowerCase().includes('google.com');
    const hasPath = parsed.pathname && parsed.pathname.length > 1;
    return validProtocol && validHost && hasPath;
  } catch {
    return false;
  }
}

/**
 * Subscribe to all sessions where user is either learner or helper
 */
export function subscribeToUserSessions(userId, callback) {
  if (!userId) return () => {};

  if (isFirebaseConfigured && db) {
    let learnerSessions = [];
    let helperSessions = [];

    const mergeAndEmit = () => {
      const map = new Map();
      [...learnerSessions, ...helperSessions].forEach(sess => {
        map.set(sess.id, sess);
      });
      const combined = Array.from(map.values());
      combined.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(combined);
    };

    // Query 1: learnerId == userId
    const qLearner = query(
      collection(db, "sessions"),
      where("learnerId", "==", userId)
    );

    const unsubLearner = onSnapshot(qLearner, (snapshot) => {
      learnerSessions = [];
      snapshot.forEach(docSnap => {
        learnerSessions.push({ id: docSnap.id, ...docSnap.data() });
      });
      mergeAndEmit();
    }, (err) => console.error("Learner sessions error:", err));

    // Query 2: helperId == userId
    const qHelper = query(
      collection(db, "sessions"),
      where("helperId", "==", userId)
    );

    const unsubHelper = onSnapshot(qHelper, (snapshot) => {
      helperSessions = [];
      snapshot.forEach(docSnap => {
        helperSessions.push({ id: docSnap.id, ...docSnap.data() });
      });
      mergeAndEmit();
    }, (err) => console.error("Helper sessions error:", err));

    return () => {
      unsubLearner();
      unsubHelper();
    };
  } else {
    // Demo Mode
    const handler = () => {
      const sessions = getMockSessions();
      const userSess = sessions.filter(s => s.learnerId === userId || s.helperId === userId);
      userSess.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      callback(userSess);
    };
    handler();
    window.addEventListener('study_sessions_updated', handler);
    return () => window.removeEventListener('study_sessions_updated', handler);
  }
}

/**
 * Mark session as completed (Tutor/Helper Direct Action)
 */
export async function completeSession(sessionId, sessionData, currentUserId) {
  if (!sessionId) throw new Error("Invalid session ID");

  // Authorization check: Only the tutor/helper can directly mark a session as completed!
  if (sessionData && currentUserId && sessionData.helperId !== currentUserId) {
    throw new Error("Only the tutor/helper can directly mark a session as completed.");
  }

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, "sessions", sessionId);
    await updateDoc(docRef, {
      status: 'completed',
      updatedAt: serverTimestamp()
    });
  } else {
    const sessions = getMockSessions();
    const sess = sessions.find(s => s.id === sessionId);
    if (sess) {
      sess.status = 'completed';
      sess.updatedAt = new Date().toISOString();
      saveMockSessions(sessions);
    }
  }

  // Trigger Notification for the other participant
  if (sessionData && currentUserId) {
    const isLearner = sessionData.learnerId === currentUserId;
    const recipientId = isLearner ? sessionData.helperId : sessionData.learnerId;
    const senderName = isLearner ? (sessionData.learnerName || 'Learner') : (sessionData.helperName || 'Helper');

    createNotification({
      recipientId,
      senderId: currentUserId,
      senderName,
      type: 'session_completed',
      title: 'Session Completed ✅',
      message: `Your ${sessionData.subject || 'study'} session with ${senderName} was marked completed.`,
      relatedSessionId: sessionId
    });
  }

  return true;
}

/**
 * Mark session as cancelled (Tutor/Helper Direct Action)
 */
export async function cancelSession(sessionId, sessionData, currentUserId) {
  if (!sessionId) throw new Error("Invalid session ID");

  // Authorization check: Only the tutor/helper can directly cancel a session!
  if (sessionData && currentUserId && sessionData.helperId !== currentUserId) {
    throw new Error("Only the tutor/helper can directly cancel a session.");
  }

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, "sessions", sessionId);
    await updateDoc(docRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp()
    });
  } else {
    const sessions = getMockSessions();
    const sess = sessions.find(s => s.id === sessionId);
    if (sess) {
      sess.status = 'cancelled';
      sess.updatedAt = new Date().toISOString();
      saveMockSessions(sessions);
    }
  }

  // Trigger Notification for the other participant
  if (sessionData && currentUserId) {
    const isLearner = sessionData.learnerId === currentUserId;
    const recipientId = isLearner ? sessionData.helperId : sessionData.learnerId;
    const senderName = isLearner ? (sessionData.learnerName || 'Learner') : (sessionData.helperName || 'Helper');

    createNotification({
      recipientId,
      senderId: currentUserId,
      senderName,
      type: 'session_cancelled',
      title: 'Session Cancelled ❌',
      message: `${senderName} cancelled your ${sessionData.subject || 'study'} session.`,
      relatedSessionId: sessionId
    });
  }

  return true;
}

/**
 * Update exact meeting point for a session
 */
export async function updateSessionMeetingPoint(sessionId, meetingPoint, userId, sessionData) {
  if (!sessionId) throw new Error("Invalid session ID");
  const trimmed = (meetingPoint || '').trim();
  if (!trimmed) throw new Error("Please enter a meeting point.");
  if (trimmed.length > 150) throw new Error("Meeting point cannot exceed 150 characters.");

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, "sessions", sessionId);
    await updateDoc(docRef, {
      meetingPoint: trimmed,
      meetingPointUpdatedBy: userId,
      meetingPointUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    const sessions = getMockSessions();
    const sess = sessions.find(s => s.id === sessionId);
    if (sess) {
      sess.meetingPoint = trimmed;
      sess.meetingPointUpdatedBy = userId;
      sess.meetingPointUpdatedAt = new Date().toISOString();
      sess.updatedAt = new Date().toISOString();
      saveMockSessions(sessions);
    }
  }

  // Trigger Notification for the other participant
  if (sessionData && userId) {
    const isLearner = sessionData.learnerId === userId;
    const recipientId = isLearner ? sessionData.helperId : sessionData.learnerId;
    const senderName = isLearner ? (sessionData.learnerName || 'Learner') : (sessionData.helperName || 'Helper');

    createNotification({
      recipientId,
      senderId: userId,
      senderName,
      type: 'meeting_point_updated',
      title: 'Meeting Point Updated 📍',
      message: `${senderName} updated the meeting point to: "${trimmed}".`,
      relatedSessionId: sessionId
    });
  }

  return true;
}

const normalizeMode = (m) => String(m || '').trim().toLowerCase();

/**
 * Start Online Google Meet Session (Helper Only)
 */
export async function startOnlineSession(sessionId, meetingUrl, currentUserId, sessionData) {
  if (!sessionId) throw new Error("Invalid session ID.");

  if (sessionData && sessionData.mode) {
    const mode = normalizeMode(sessionData.mode);
    if (mode !== 'online' && mode !== 'both') {
      throw new Error("This session does not support online meetings.");
    }
  }

  const cleanUrl = (meetingUrl || '').trim();
  if (!validateGoogleMeetUrl(cleanUrl)) {
    throw new Error("Please enter a valid Google Meet link.");
  }

  // Authorization check: Only the helper may start the online session!
  if (sessionData && sessionData.helperId !== currentUserId) {
    throw new Error("Only the helper can start this online session.");
  }

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, "sessions", sessionId);
    await updateDoc(docRef, {
      meetingUrl: cleanUrl,
      onlineSessionStatus: 'live',
      meetingStartedAt: serverTimestamp(),
      meetingStartedBy: currentUserId,
      updatedAt: serverTimestamp()
    });
  } else {
    const sessions = getMockSessions();
    const sess = sessions.find(s => s.id === sessionId);
    if (sess) {
      sess.meetingUrl = cleanUrl;
      sess.onlineSessionStatus = 'live';
      sess.meetingStartedAt = new Date().toISOString();
      sess.meetingStartedBy = currentUserId;
      sess.updatedAt = new Date().toISOString();
      saveMockSessions(sessions);
    }
  }

  // Trigger Notification for the learner
  if (sessionData) {
    const recipientId = sessionData.learnerId || sessionData.requesterId;
    const helperName = sessionData.helperName || 'Helper';
    createNotification({
      recipientId,
      senderId: currentUserId,
      senderName: helperName,
      type: 'online_session_started',
      title: 'Online Session Started 🚀',
      message: `${helperName} started your ${sessionData.subject || 'study'} online session. Join now!`,
      relatedSessionId: sessionId
    });
  }

  return true;
}

/**
 * End Online Google Meet Session (Helper Only)
 */
export async function endOnlineSession(sessionId, currentUserId, sessionData) {
  if (!sessionId) throw new Error("Invalid session ID.");

  // Authorization check: Only the helper may end the online session!
  if (sessionData && sessionData.helperId !== currentUserId) {
    throw new Error("Only the helper can end this online session.");
  }

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, "sessions", sessionId);
    await updateDoc(docRef, {
      onlineSessionStatus: 'ended',
      meetingEndedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    const sessions = getMockSessions();
    const sess = sessions.find(s => s.id === sessionId);
    if (sess) {
      sess.onlineSessionStatus = 'ended';
      sess.meetingEndedAt = new Date().toISOString();
      sess.updatedAt = new Date().toISOString();
      saveMockSessions(sessions);
    }
  }

  // Trigger Notification for the learner
  if (sessionData) {
    const recipientId = sessionData.learnerId || sessionData.requesterId;
    const helperName = sessionData.helperName || 'Helper';
    createNotification({
      recipientId,
      senderId: currentUserId,
      senderName: helperName,
      type: 'online_session_ended',
      title: 'Online Session Ended 🏁',
      message: `Your ${sessionData.subject || 'study'} online session with ${helperName} has ended.`,
      relatedSessionId: sessionId
    });
  }

  return true;
}

/**
 * Learner Requests Session Completion or Cancellation
 */
export async function requestSessionAction(sessionId, actionType, currentUserId, sessionData) {
  if (!sessionId) throw new Error("Invalid session ID.");
  if (actionType !== 'completion' && actionType !== 'cancellation') {
    throw new Error("Invalid action request type.");
  }

  // Authorization check: Only the learner can send action requests!
  if (sessionData && (sessionData.learnerId !== currentUserId && sessionData.requesterId !== currentUserId)) {
    throw new Error("Only the learner can request session completion or cancellation.");
  }

  if (sessionData && sessionData.status !== 'upcoming') {
    throw new Error("Action requests can only be sent for upcoming sessions.");
  }

  const actionPayload = {
    type: actionType,
    requestedBy: currentUserId,
    status: 'pending',
    createdAt: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, "sessions", sessionId);
    await updateDoc(docRef, {
      sessionActionRequest: actionPayload,
      updatedAt: serverTimestamp()
    });
  } else {
    const sessions = getMockSessions();
    const sess = sessions.find(s => s.id === sessionId);
    if (sess) {
      sess.sessionActionRequest = {
        ...actionPayload,
        createdAt: new Date().toISOString()
      };
      sess.updatedAt = new Date().toISOString();
      saveMockSessions(sessions);
    }
  }

  // Notify Helper/Tutor
  if (sessionData) {
    const recipientId = sessionData.helperId;
    const learnerName = sessionData.learnerName || sessionData.requesterName || 'Learner';
    const isComp = actionType === 'completion';

    createNotification({
      recipientId,
      senderId: currentUserId,
      senderName: learnerName,
      type: isComp ? 'session_completion_requested' : 'session_cancellation_requested',
      title: isComp ? 'Session Completion Requested ⏳' : 'Session Cancellation Requested ⏳',
      message: `${learnerName} requested to ${isComp ? 'mark your' : 'cancel your'} ${sessionData.subject || 'study'} session.`,
      relatedSessionId: sessionId
    });
  }

  return true;
}

/**
 * Tutor/Helper Approves or Rejects Learner Session Action Request
 */
export async function respondToSessionActionRequest(sessionId, isApproved, currentUserId, sessionData) {
  if (!sessionId) throw new Error("Invalid session ID.");

  // Authorization check: Only the helper/tutor can respond to action requests!
  if (sessionData && sessionData.helperId !== currentUserId) {
    throw new Error("Only the tutor/helper can approve or decline action requests.");
  }

  const actionReq = sessionData?.sessionActionRequest;
  if (!actionReq || actionReq.status !== 'pending') {
    throw new Error("No pending action request found for this session.");
  }

  const actionType = actionReq.type; // 'completion' | 'cancellation'
  const newStatus = isApproved ? (actionType === 'completion' ? 'completed' : 'cancelled') : sessionData.status;

  const updatedActionReq = {
    ...actionReq,
    status: isApproved ? 'approved' : 'rejected',
    respondedAt: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    const docRef = doc(db, "sessions", sessionId);
    await updateDoc(docRef, {
      status: newStatus,
      sessionActionRequest: updatedActionReq,
      updatedAt: serverTimestamp()
    });
  } else {
    const sessions = getMockSessions();
    const sess = sessions.find(s => s.id === sessionId);
    if (sess) {
      sess.status = newStatus;
      sess.sessionActionRequest = {
        ...updatedActionReq,
        respondedAt: new Date().toISOString()
      };
      sess.updatedAt = new Date().toISOString();
      saveMockSessions(sessions);
    }
  }

  // Notify Learner
  if (sessionData) {
    const recipientId = sessionData.learnerId || sessionData.requesterId;
    const helperName = sessionData.helperName || 'Tutor';
    const isComp = actionType === 'completion';

    if (isApproved) {
      createNotification({
        recipientId,
        senderId: currentUserId,
        senderName: helperName,
        type: isComp ? 'session_completed' : 'session_cancelled',
        title: isComp ? 'Session Completed ✅' : 'Session Cancelled ❌',
        message: isComp
          ? `Your ${sessionData.subject || 'study'} session was marked completed.`
          : `Your ${sessionData.subject || 'study'} session cancellation request was approved.`,
        relatedSessionId: sessionId
      });
    } else {
      createNotification({
        recipientId,
        senderId: currentUserId,
        senderName: helperName,
        type: 'request_declined',
        title: 'Request Declined ❌',
        message: `Your request to ${isComp ? 'complete' : 'cancel'} the ${sessionData.subject || 'study'} session was declined by ${helperName}.`,
        relatedSessionId: sessionId
      });
    }
  }

  return true;
}
