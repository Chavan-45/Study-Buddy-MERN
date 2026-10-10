import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'Session ID is required for chat room'],
      unique: true,
      index: true,
    },
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Learner ID is required'],
      index: true,
    },
    helperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Helper ID is required'],
      index: true,
    },
    participantIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    lastMessage: {
      type: String,
      default: '',
      trim: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field `id` mapping to `_id` string
chatSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

chatSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = this._id.toHexString();
  delete obj.__v;
  return obj;
};

const Chat = mongoose.model('Chat', chatSchema);
export default Chat;
