import apiClient from './apiClient';

/**
 * Check if a pending request already exists between requester and helper for the same subject & day
 */
export async function checkExistingRequest(requesterId, helperId, subject, day) {
  if (!requesterId || !helperId || !subject) return null;

  try {
    const response = await apiClient.get('/requests/sent?status=pending');
    const sent = response.requests || [];
    const match = sent.find(
      (r) =>
        r.helperId === helperId &&
        r.subject.trim().toLowerCase() === subject.trim().toLowerCase() &&
        (!day || r.day.trim().toLowerCase() === day.trim().toLowerCase())
    );
    return match || null;
  } catch (err) {
    console.error('Error checking existing request:', err);
    return null;
  }
}

/**
 * Send a new study request
 */
export async function sendStudyRequest(requestData) {
  try {
    const payload = {
      helperId: requestData.helperId,
      subject: requestData.subject,
      requiredLevel: requestData.requiredLevel || 'Intermediate',
      day: requestData.day,
      startTime: requestData.startTime,
      endTime: requestData.endTime,
      mode: requestData.mode || 'Both',
      location: requestData.location || 'College Library',
      matchPercentage: Number(requestData.matchPercentage) || 0,
      note: requestData.note || '',
    };

    const response = await apiClient.post('/requests', payload);
    const newReq = response.request || response;

    // Trigger local updates
    window.dispatchEvent(new Event('study_requests_updated'));

    return {
      id: newReq.id || newReq._id,
      ...newReq,
    };
  } catch (error) {
    if (error.status === 409) {
      const err = new Error(
        error.message || 'You already have a pending study request with this student.'
      );
      err.code = 'request-already-sent';
      throw err;
    }
    throw error;
  }
}

/**
 * Polling adapter for incoming requests (where helperId == currentUserId)
 */
export function subscribeToIncomingRequests(helperId, callback) {
  if (!helperId) return () => {};

  let active = true;
  let isFetching = false;

  const fetchIncoming = async () => {
    if (!active || isFetching) return;
    isFetching = true;
    try {
      const response = await apiClient.get('/requests/incoming');
      if (active && response?.requests) {
        const list = response.requests.map((r) => ({
          id: r.id || r._id,
          ...r,
        }));
        callback(list);
      }
    } catch (err) {
      console.error('Error polling incoming requests:', err);
    } finally {
      isFetching = false;
    }
  };

  // Immediate initial load
  fetchIncoming();

  // Poll every 6 seconds
  const intervalId = setInterval(fetchIncoming, 6000);

  // Immediate refresh on local mutations
  const handleUpdate = () => {
    fetchIncoming();
  };
  window.addEventListener('study_requests_updated', handleUpdate);

  return () => {
    active = false;
    clearInterval(intervalId);
    window.removeEventListener('study_requests_updated', handleUpdate);
  };
}

/**
 * Polling adapter for sent requests (where requesterId == currentUserId)
 */
export function subscribeToSentRequests(requesterId, callback) {
  if (!requesterId) return () => {};

  let active = true;
  let isFetching = false;

  const fetchSent = async () => {
    if (!active || isFetching) return;
    isFetching = true;
    try {
      const response = await apiClient.get('/requests/sent');
      if (active && response?.requests) {
        const list = response.requests.map((r) => ({
          id: r.id || r._id,
          ...r,
        }));
        callback(list);
      }
    } catch (err) {
      console.error('Error polling sent requests:', err);
    } finally {
      isFetching = false;
    }
  };

  fetchSent();

  const intervalId = setInterval(fetchSent, 6000);

  const handleUpdate = () => {
    fetchSent();
  };
  window.addEventListener('study_requests_updated', handleUpdate);

  return () => {
    active = false;
    clearInterval(intervalId);
    window.removeEventListener('study_requests_updated', handleUpdate);
  };
}

/**
 * Accept a study request & automatically schedule a session
 */
export async function acceptStudyRequest(requestId, requestData) {
  if (!requestId) throw new Error('Invalid request ID');

  const response = await apiClient.put(`/requests/${requestId}/accept`, {});

  window.dispatchEvent(new Event('study_requests_updated'));
  window.dispatchEvent(new Event('study_sessions_updated'));

  return response;
}

/**
 * Reject a study request
 */
export async function rejectStudyRequest(requestId, requestData) {
  if (!requestId) throw new Error('Invalid request ID');

  const response = await apiClient.put(`/requests/${requestId}/reject`, {});

  window.dispatchEvent(new Event('study_requests_updated'));

  return response;
}

/**
 * Cancel a study request
 */
export async function cancelStudyRequest(requestId) {
  if (!requestId) throw new Error('Invalid request ID');

  const response = await apiClient.put(`/requests/${requestId}/cancel`, {});

  window.dispatchEvent(new Event('study_requests_updated'));

  return response;
}
