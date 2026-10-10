import mongoose from 'mongoose';

const sessionActionRequestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['completion', 'cancellation'],
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudyRequest',
      default: null,
      sparse: true,
      unique: true,
    },
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Learner ID is required'],
      index: true,
    },
    learnerName: {
      type: String,
      required: [true, 'Learner name is required'],
      trim: true,
    },
    learnerPhone: {
      type: String,
      default: '',
    },
    learnerEmail: {
      type: String,
      default: '',
    },
    helperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Helper ID is required'],
      index: true,
    },
    helperName: {
      type: String,
      required: [true, 'Helper name is required'],
      trim: true,
    },
    helperPhone: {
      type: String,
      default: '',
    },
    helperEmail: {
      type: String,
      default: '',
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
    },
    requiredLevel: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Intermediate',
    },
    day: {
      type: String,
      required: [true, 'Day is required'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
    },
    mode: {
      type: String,
      enum: ['Online', 'Offline', 'Both'],
      default: 'Both',
    },
    location: {
      type: String,
      default: 'College Library',
      trim: true,
    },
    matchPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      enum: ['upcoming', 'completed', 'cancelled'],
      default: 'upcoming',
      index: true,
    },
    meetingPoint: {
      type: String,
      default: '',
      trim: true,
      maxlength: 150,
    },
    meetingPointUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    meetingPointUpdatedAt: {
      type: Date,
      default: null,
    },
    meetingUrl: {
      type: String,
      default: '',
      trim: true,
    },
    onlineSessionStatus: {
      type: String,
      enum: ['idle', 'live', 'ended'],
      default: 'idle',
    },
    meetingStartedAt: {
      type: Date,
      default: null,
    },
    meetingStartedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    meetingEndedAt: {
      type: Date,
      default: null,
    },
    sessionActionRequest: {
      type: sessionActionRequestSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field `id` mapping to `_id` string for frontend compatibility
sessionSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Compound indexes for fetching upcoming, completed, and cancelled sessions efficiently
sessionSchema.index({ learnerId: 1, status: 1 });
sessionSchema.index({ helperId: 1, status: 1 });

sessionSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = this._id.toHexString();
  delete obj.__v;
  return obj;
};

const Session = mongoose.model('Session', sessionSchema);
export default Session;
