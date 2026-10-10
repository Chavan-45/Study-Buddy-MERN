import Notification from '../models/Notification.js';

/**
 * Reusable server-side helper to create in-app notifications
 * Never throws fatal errors to block primary application workflows
 */
export async function createNotificationHelper({
  recipientId,
  senderId,
  senderName = 'System',
  type = 'general',
  title,
  message = '',
  relatedRequestId = null,
  relatedSessionId = null,
}) {
  if (!recipientId || !title) return null;

  // Never notify self
  if (senderId && recipientId.toString() === senderId.toString()) {
    return null;
  }

  try {
    // Avoid duplicate unread notifications for identical events
    if (relatedRequestId || relatedSessionId) {
      const duplicateFilter = {
        recipientId,
        type,
        isRead: false,
      };
      if (relatedRequestId) duplicateFilter.relatedRequestId = relatedRequestId;
      if (relatedSessionId) duplicateFilter.relatedSessionId = relatedSessionId;

      const existingNotif = await Notification.findOne(duplicateFilter);
      if (existingNotif) {
        return existingNotif;
      }
    }

    const notification = await Notification.create({
      recipientId,
      senderId: senderId || null,
      senderName,
      type,
      title,
      message,
      relatedRequestId,
      relatedSessionId,
      isRead: false,
    });

    return notification;
  } catch (error) {
    console.error('Non-fatal notification creation error:', error.message);
    return null;
  }
}
