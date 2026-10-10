import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'Session ID is required'],
      index: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewer ID is required'],
      index: true,
    },
    reviewerName: {
      type: String,
      required: [true, 'Reviewer name is required'],
      trim: true,
    },
    reviewedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reviewed user ID is required'],
      index: true,
    },
    reviewedUserName: {
      type: String,
      required: [true, 'Reviewed user name is required'],
      trim: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating value is required'],
      min: [1, 'Rating must be at least 1 star'],
      max: [5, 'Rating cannot exceed 5 stars'],
    },
    comment: {
      type: String,
      default: '',
      trim: true,
      maxlength: [300, 'Comment cannot exceed 300 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field `id` mapping to `_id` string
reviewSchema.virtual('id').get(function () {
  return this._id.toHexString();
});

// Enforce unique review per session per reviewer (prevents double reviews)
reviewSchema.index({ sessionId: 1, reviewerId: 1 }, { unique: true });

// Index for retrieving a user's received reviews sorted by latest
reviewSchema.index({ reviewedUserId: 1, createdAt: -1 });

reviewSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = this._id.toHexString();
  delete obj.__v;
  return obj;
};

const Review = mongoose.model('Review', reviewSchema);
export default Review;
