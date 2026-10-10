import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient ID is required'],
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    senderName: {
      type: String,
      default: 'System',
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: [
        'study_request',
        'request_accepted',
        'request_rejected',
        'request_declined',
        'session_completed',
        'session_cancelled',
        'session_completion_requested',
        'session_cancellation_requested',
        'online_session_started',
        'online_session_ended',
        'meeting_point_updated',
        'new_message',
        'general',
      ],
      default: 'general',
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },
    relatedRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyRequest',
      default: null,
    },
    relatedSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field `id` mapping to `_id` string
notificationSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Index to efficiently query and sort notifications for a user by recency
notificationSchema.index({ recipientId: 1, createdAt: -1 });

notificationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = this._id.toHexString();
  delete obj.__v;
  return obj;
};

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
