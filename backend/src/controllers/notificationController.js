import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

/**
 * @desc    Get notifications for the authenticated user
 * @route   GET /api/notifications
 * @access  Private
 */
export async function getMyNotifications(req, res, next) {
  try {
    const filter = { recipientId: req.user._id };

    if (req.query.unreadOnly === 'true') {
      filter.isRead = false;
    }

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 40));

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      recipientId: req.user._id,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      notifications: notifications.map((n) => n.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Mark a single notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
export async function markNotificationAsRead(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID.',
      });
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    // Only recipient can mark their notification read
    if (notification.recipientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this notification.',
      });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
      notification: notification.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Mark all unread notifications as read for authenticated user
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
export async function markAllNotificationsAsRead(req, res, next) {
  try {
    const result = await Notification.updateMany(
      { recipientId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
}
