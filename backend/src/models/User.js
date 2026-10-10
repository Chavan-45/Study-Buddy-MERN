import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const canHelpSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, 'Subject is required for Can Help skill'],
      trim: true,
    },
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Intermediate',
    },
  },
  { _id: false }
);

const availabilitySlotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: [true, 'Day is required for availability slot'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required (HH:mm format)'],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'End time is required (HH:mm format)'],
      trim: true,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please enter a valid email address',
      ],
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Do not return password by default in queries
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationTokenHash: {
      type: String,
      select: false,
      default: null,
      index: true,
    },
    verificationTokenExpires: {
      type: Date,
      select: false,
      default: null,
    },
    lastVerificationEmailSentAt: {
      type: Date,
      select: false,
      default: null,
    },
    sharePhoneAfterAcceptance: {
      type: Boolean,
      default: false,
    },
    department: {
      type: String,
      enum: ['CSE', 'ECE', 'EEE', 'IT', 'Civil', 'Mechanical', 'Other'],
      default: 'CSE',
    },
    year: {
      type: String,
      enum: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
      default: '1st Year',
    },
    bio: {
      type: String,
      default: '',
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    canHelp: {
      type: [canHelpSchema],
      default: [],
    },
    availability: {
      type: [availabilitySlotSchema],
      default: [],
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
    profileCompleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    ratingTotal: {
      type: Number,
      default: 0,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field `uid` mapping to `_id` string for seamless frontend compatibility
userSchema.virtual('uid').get(function () {
  return this._id.toHexString();
});

// Pre-save hook to hash password before saving to database
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare user-entered plain password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Safe JSON serialization: remove password hash and internal fields
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.uid = this._id.toHexString();
  obj.displayName = this.name;
  delete obj.password;
  delete obj.verificationTokenHash;
  delete obj.verificationTokenExpires;
  delete obj.lastVerificationEmailSentAt;
  delete obj.__v;
  return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
