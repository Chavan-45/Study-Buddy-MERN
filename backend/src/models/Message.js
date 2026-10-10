import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: [true, 'Chat ID is required'],
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'Session ID is required'],
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
      index: true,
    },
    senderName: {
      type: String,
      required: [true, 'Sender name is required'],
      trim: true,
    },
    text: {
      type: String,
      required: [true, 'Message text is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field `id` mapping to `_id` string
messageSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Chronological sorting index for session chat history retrieval
messageSchema.index({ sessionId: 1, createdAt: 1 });

messageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = this._id.toHexString();
  delete obj.__v;
  return obj;
};

const Message = mongoose.model('Message', messageSchema);
export default Message;
