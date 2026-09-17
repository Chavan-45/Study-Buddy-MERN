import { db, isFirebaseConfigured } from '../firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { createNotification } from './notificationService';

const MOCK_REQUESTS_KEY = 'study_buddy_mock_requests';
const MOCK_SESSIONS_KEY = 'study_buddy_mock_sessions';

function getMockRequests() {
  try {
    const data = localStorage.getItem(MOCK_REQUESTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveMockRequests(requests) {
  try {
    localStorage.setItem(MOCK_REQUESTS_KEY, JSON.stringify(requests));
    window.dispatchEvent(new Event('study_requests_updated'));
  } catch (err) {
    console.error("Failed to save mock requests", err);
  }
}

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
 * Check if a pending request already exists between requester and helper for the same subject & day
 */
export async function checkExistingRequest(requesterId, helperId, subject, day) {
  if (!requesterId || !helperId || !subject) return null;

  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, "studyRequests"),
        where("requesterId", "==", requesterId),
        where("helperId", "==", helperId),
        where("status", "==", "pending")
      );
      const snapshot = await getDocs(q);
      let match = null;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (
          data.subject.trim().toLowerCase() === subject.trim().toLowerCase() &&
          (!day || data.day.trim().toLowerCase() === day.trim().toLowerCase())
        ) {
          match = { id: docSnap.id, ...data };
        }
      });
      return match;
    } catch (err) {
      console.error("Error checking existing request:", err);
      return null;
    }
  } else {
    // Demo mode
    const requests = getMockRequests();
    return requests.find(r => 
      r.requesterId === requesterId &&
      r.helperId === helperId &&
      r.status === 'pending' &&
      r.subject.toLowerCase() === subject.toLowerCase() &&
      (!day || r.day.toLowerCase() === day.toLowerCase())
    ) || null;
  }
}

/**
 * Send a new study request
 */
export async function sendStudyRequest(requestData) {
  const existing = await checkExistingRequest(
    requestData.requesterId,
    requestData.helperId,
    requestData.subject,
    requestData.day
  );

  if (existing) {
    const err = new Error("Request already sent.");
    err.code = "request-already-sent";
    throw err;
  }

  const payload = {
    ...requestData,
    status: 'pending',
    createdAt: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString(),
    updatedAt: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString()
  };

  let newReq = null;
  if (isFirebaseConfigured && db) {
    const docRef = await addDoc(collection(db, "studyRequests"), payload);
    newReq = { id: docRef.id, ...payload };
  } else {
    // Demo Mode
    const requests = getMockRequests();
    newReq = { id: 'req-' + Date.now(), ...payload };
    requests.push(newReq);
    saveMockRequests(requests);
  }

  // Trigger Notification for Helper
  createNotification({
    recipientId: requestData.helperId,
    senderId: requestData.requesterId,
    senderName: requestData.requesterName,
    type: 'study_request',
    title: 'New Study Request 📩',
    message: `${requestData.requesterName} sent you a study request for ${requestData.subject}.`,
    relatedRequestId: newReq.id
  });

  return newReq;
}

/**
 * Real-time listener for incoming requests (where helperId == currentUserId)
 */
export function subscribeToIncomingRequests(helperId, callback) {
  if (!helperId) return () => {};

  if (isFirebaseConfigured && db) {
    const q = query(
      collection(db, "studyRequests"),
      where("helperId", "==", helperId)
    );
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort newest first
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(list);
    }, (error) => {
      console.error("Incoming requests snapshot error:", error);
    });
  } else {
    // Demo mode
    const handler = () => {
      const requests = getMockRequests();
      const filtered = requests.filter(r => r.helperId === helperId);
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      callback(filtered);
    };
    handler();
    window.addEventListener('study_requests_updated', handler);
    return () => window.removeEventListener('study_requests_updated', handler);
  }
}

/**
 * Real-time listener for sent requests (where requesterId == currentUserId)
 */
export function subscribeToSentRequests(requesterId, callback) {
  if (!requesterId) return () => {};

  if (isFirebaseConfigured && db) {
    const q = query(
      collection(db, "studyRequests"),
      where("requesterId", "==", requesterId)
    );
    return onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      callback(list);
    }, (error) => {
      console.error("Sent requests snapshot error:", error);
    });
  } else {
    const handler = () => {
      const requests = getMockRequests();
      const filtered = requests.filter(r => r.requesterId === requesterId);
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      callback(filtered);
    };
    handler();
    window.addEventListener('study_requests_updated', handler);
    return () => window.removeEventListener('study_requests_updated', handler);
  }
}

/**
 * Accept a study request & automatically create a session atomically
 */
export async function acceptStudyRequest(requestId, requestData) {
  if (!requestId) throw new Error("Invalid request ID");

  if (isFirebaseConfigured && db) {
    try {
      await runTransaction(db, async (transaction) => {
        const reqRef = doc(db, "studyRequests", requestId);
        const reqSnap = await transaction.get(reqRef);

        if (!reqSnap.exists()) {
          throw new Error("Request no longer exists.");
        }

        const data = reqSnap.data();
        if (data.status === 'accepted') {
          return; // Already accepted
        }

        // 1. Update request status to accepted
        transaction.update(reqRef, {
          status: 'accepted',
          updatedAt: serverTimestamp()
        });

        // 2. Check duplicate session for this requestId
        const sessionRef = doc(collection(db, "sessions"));
        transaction.set(sessionRef, {
          requestId,
          learnerId: data.requesterId,
          learnerName: data.requesterName,
          helperId: data.helperId,
          helperName: data.helperName,
          subject: data.subject,
          requiredLevel: data.requiredLevel || 'Intermediate',
          day: data.day,
          startTime: data.startTime,
          endTime: data.endTime,
          mode: data.mode,
          location: data.location,
          matchPercentage: data.matchPercentage,
          status: 'upcoming',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });
    } catch (err) {
      console.error("Error accepting study request:", err);
      throw err;
    }
  } else {
    // Demo Mode
    const requests = getMockRequests();
    const req = requests.find(r => r.id === requestId);
    if (req) {
      req.status = 'accepted';
      req.updatedAt = new Date().toISOString();
      saveMockRequests(requests);

      // Create session
      const sessions = getMockSessions();
      if (!sessions.some(s => s.requestId === requestId)) {
        sessions.push({
          id: 'sess-' + Date.now(),
          requestId,
          learnerId: req.requesterId,
          learnerName: req.requesterName,
          helperId: req.helperId,
          helperName: req.helperName,
          subject: req.subject,
          requiredLevel: req.requiredLevel || 'Intermediate',
          day: req.day,
          startTime: req.startTime,
          endTime: req.endTime,
          mode: req.mode,
          location: req.location,
          matchPercentage: req.matchPercentage,
          status: 'upcoming',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        saveMockSessions(sessions);
      }
    }
  }

  // Trigger Notification for Requester
  if (requestData) {
    createNotification({
      recipientId: requestData.requesterId,
      senderId: requestData.helperId,
      senderName: requestData.helperName,
      type: 'request_accepted',
      title: 'Request Accepted 🎉',
      message: `${requestData.helperName} accepted your ${requestData.subject} study request.`,
      relatedRequestId: requestId
    });
  }

  return true;
}

/**
 * Reject a study request
 */
export async function rejectStudyRequest(requestId, requestData) {
  if (!requestId) throw new Error("Invalid request ID");

  if (isFirebaseConfigured && db) {
    const reqRef = doc(db, "studyRequests", requestId);
    await updateDoc(reqRef, {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
  } else {
    const requests = getMockRequests();
    const req = requests.find(r => r.id === requestId);
    if (req) {
      req.status = 'rejected';
      req.updatedAt = new Date().toISOString();
      saveMockRequests(requests);
    }
  }

  // Trigger Notification for Requester
  if (requestData) {
    createNotification({
      recipientId: requestData.requesterId,
      senderId: requestData.helperId,
      senderName: requestData.helperName,
      type: 'request_rejected',
      title: 'Request Declined',
      message: `${requestData.helperName} declined your ${requestData.subject} study request.`,
      relatedRequestId: requestId
    });
  }

  return true;
}

/**
 * Cancel a study request
 */
export async function cancelStudyRequest(requestId) {
  if (!requestId) throw new Error("Invalid request ID");

  if (isFirebaseConfigured && db) {
    const reqRef = doc(db, "studyRequests", requestId);
    await updateDoc(reqRef, {
      status: 'cancelled',
      updatedAt: serverTimestamp()
    });
  } else {
    const requests = getMockRequests();
    const req = requests.find(r => r.id === requestId);
    if (req) {
      req.status = 'cancelled';
      req.updatedAt = new Date().toISOString();
      saveMockRequests(requests);
    }
  }
  return true;
}
