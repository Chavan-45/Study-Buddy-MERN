import apiClient from './apiClient';

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
 * Fetch a single session's details by ID
 */
export async function getSessionById(sessionId) {
  if (!sessionId) return null;
  try {
    const response = await apiClient.get(`/sessions/${sessionId}`);
    const sess = response.session || response;
    return {
      id: sess.id || sess._id,
      ...sess,
    };
  } catch (error) {
    console.error('Error fetching session by ID:', error);
    throw error;
  }
}

/**
 * Polling adapter for user's study sessions (learner or helper)
 */
export function subscribeToUserSessions(userId, callback) {
  if (!userId) return () => {};

  let active = true;
  let isFetching = false;

  const fetchSessions = async () => {
    if (!active || isFetching) return;
    isFetching = true;
    try {
      const response = await apiClient.get('/sessions');
      if (active && response?.sessions) {
        const list = response.sessions.map((s) => ({
          id: s.id || s._id,
          ...s,
        }));
        callback(list);
      }
    } catch (err) {
      console.error('Error polling study sessions:', err);
    } finally {
      isFetching = false;
    }
  };

  fetchSessions();

  // Poll every 6 seconds
  const intervalId = setInterval(fetchSessions, 6000);

  // Immediate refresh on local mutations
  const handleUpdate = () => {
    fetchSessions();
  };
  window.addEventListener('study_sessions_updated', handleUpdate);

  return () => {
    active = false;
    clearInterval(intervalId);
    window.removeEventListener('study_sessions_updated', handleUpdate);
  };
}

/**
 * Direct completion of a session (Helper only)
 */
export async function completeSession(sessionId, sessionData, currentUserId) {
  if (!sessionId) throw new Error('Invalid session ID');

  const response = await apiClient.put(`/sessions/${sessionId}/complete`, {});

  window.dispatchEvent(new Event('study_sessions_updated'));

  return response;
}

/**
 * Direct cancellation of a session (Helper only)
 */
export async function cancelSession(sessionId, sessionData, currentUserId) {
  if (!sessionId) throw new Error('Invalid session ID');

  const response = await apiClient.put(`/sessions/${sessionId}/cancel`, {});

  window.dispatchEvent(new Event('study_sessions_updated'));

  return response;
}

/**
 * Update session meeting point
 */
export async function updateSessionMeetingPoint(sessionId, meetingPoint, userId, sessionData) {
  if (!sessionId) throw new Error('Invalid session ID');
  const trimmed = (meetingPoint || '').trim();
  if (!trimmed) throw new Error('Please enter a meeting point.');
  if (trimmed.length > 150) throw new Error('Meeting point cannot exceed 150 characters.');

  const response = await apiClient.put(`/sessions/${sessionId}/meeting-point`, {
    meetingPoint: trimmed,
  });

  window.dispatchEvent(new Event('study_sessions_updated'));

  return response;
}

/**
 * Save or update Google Meet link (Tutor/Helper only)
 */
export async function updateSessionMeetingLink(sessionId, meetingUrl, currentUserId, sessionData) {
  if (!sessionId) throw new Error('Invalid session ID.');

  const cleanUrl = (meetingUrl || '').trim();
  if (!validateGoogleMeetUrl(cleanUrl)) {
    throw new Error('Please enter a valid Google Meet link (e.g. https://meet.google.com/abc-defg-hij).');
  }

  const response = await apiClient.put(`/sessions/${sessionId}/meeting-link`, {
    meetingUrl: cleanUrl,
  });

  window.dispatchEvent(new Event('study_sessions_updated'));

  return response;
}

/**
 * Start Online Google Meet Session (Helper Only)
 */
export async function startOnlineSession(sessionId, meetingUrl, currentUserId, sessionData) {
  if (!sessionId) throw new Error('Invalid session ID.');

  const cleanUrl = (meetingUrl || '').trim();
  if (!validateGoogleMeetUrl(cleanUrl)) {
    throw new Error('Please enter a valid Google Meet link (e.g. https://meet.google.com/abc-defg-hij).');
  }

  const response = await apiClient.put(`/sessions/${sessionId}/start-online`, {
    meetingUrl: cleanUrl,
  });

  window.dispatchEvent(new Event('study_sessions_updated'));

  return response;
}

/**
 * End Online Google Meet Session (Helper Only)
 */
export async function endOnlineSession(sessionId, currentUserId, sessionData) {
  if (!sessionId) throw new Error('Invalid session ID.');

  const response = await apiClient.put(`/sessions/${sessionId}/end-online`, {});

  window.dispatchEvent(new Event('study_sessions_updated'));

  return response;
}

/**
 * Learner Requests Session Completion or Cancellation
 */
export async function requestSessionAction(sessionId, actionType, currentUserId, sessionData) {
  if (!sessionId) throw new Error('Invalid session ID.');
  if (actionType !== 'completion' && actionType !== 'cancellation') {
    throw new Error("actionType must be either 'completion' or 'cancellation'.");
  }

  const response = await apiClient.post(`/sessions/${sessionId}/action-request`, {
    actionType,
  });

  window.dispatchEvent(new Event('study_sessions_updated'));

  return response;
}

/**
 * Tutor/Helper Approves or Rejects Learner Session Action Request
 */
export async function respondToSessionActionRequest(sessionId, isApproved, currentUserId, sessionData) {
  if (!sessionId) throw new Error('Invalid session ID.');

  const response = await apiClient.put(`/sessions/${sessionId}/action-respond`, {
    isApproved: Boolean(isApproved),
  });

  window.dispatchEvent(new Event('study_sessions_updated'));

  return response;
}
