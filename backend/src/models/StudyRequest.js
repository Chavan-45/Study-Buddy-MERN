import mongoose from 'mongoose';

const studyRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester ID is required'],
      index: true,
    },
    requesterName: {
      type: String,
      required: [true, 'Requester name is required'],
      trim: true,
    },
    requesterPhone: {
      type: String,
      default: '',
    },
    requesterEmail: {
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
      index: true,
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
    note: {
      type: String,
      default: '',
      maxlength: 300,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field `id` mapping to `_id` string for frontend compatibility
studyRequestSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Compound index for efficient lookup of active pending requests between two students
studyRequestSchema.index({ requesterId: 1, helperId: 1, status: 1 });

studyRequestSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = this._id.toHexString();
  delete obj.__v;
  return obj;
};

const StudyRequest = mongoose.model('StudyRequest', studyRequestSchema);
export default StudyRequest;
