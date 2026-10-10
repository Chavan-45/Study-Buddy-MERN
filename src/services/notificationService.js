import apiClient from './apiClient';

/**
 * Safely create a notification.
 * Kept for interface compatibility; backend generates in-app notifications automatically on operations.
 */
export async function createNotification(notifData) {
  // Notifications are handled server-side in MERN backend workflows
  return null;
}

/**
 * Polling adapter for current user's notifications
 * Polls approximately every 6 seconds while listening components are active
 */
export function subscribeToNotifications(recipientId, callback) {
  if (!recipientId) return () => {};

  let active = true;
  let isFetching = false;

  const fetchNotifications = async () => {
    if (!active || isFetching) return;
    isFetching = true;
    try {
      const response = await apiClient.get('/notifications?limit=40');
      if (active && response?.notifications) {
        const list = response.notifications.map((n) => ({
          id: n.id || n._id,
          ...n,
        }));
        callback(list);
      }
    } catch (err) {
      console.error('Error polling notifications:', err);
    } finally {
      isFetching = false;
    }
  };

  fetchNotifications();

  // Poll every 6 seconds
  const intervalId = setInterval(fetchNotifications, 6000);

  const handleUpdate = () => {
    fetchNotifications();
  };
  window.addEventListener('study_notifications_updated', handleUpdate);

  return () => {
    active = false;
    clearInterval(intervalId);
    window.removeEventListener('study_notifications_updated', handleUpdate);
  };
}

/**
 * Mark a single notification as read in MongoDB Atlas
 */
export async function markNotificationAsRead(notificationId) {
  if (!notificationId) return;

  try {
    const response = await apiClient.put(`/notifications/${notificationId}/read`, {});
    window.dispatchEvent(new Event('study_notifications_updated'));
    return response;
  } catch (err) {
    console.error('Error marking notification read:', err);
  }
}

/**
 * Mark all unread notifications as read for current user
 */
export async function markAllNotificationsAsRead(recipientId) {
  try {
    const response = await apiClient.put('/notifications/read-all', {});
    window.dispatchEvent(new Event('study_notifications_updated'));
    return response;
  } catch (err) {
    console.error('Error marking all notifications read:', err);
  }
}
