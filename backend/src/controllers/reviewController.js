import mongoose from 'mongoose';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import { createNotificationHelper } from '../utils/notificationUtils.js';

/**
 * Recalculate and update the aggregate ratings for a helper user safely
 */
async function updateHelperRatingAggregates(userId) {
  const stats = await Review.aggregate([
    { $match: { reviewedUserId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$reviewedUserId',
        ratingTotal: { $sum: '$rating' },
        ratingCount: { $sum: 1 },
        averageRating: { $avg: '$rating' },
      },
    },
  ]);

  if (stats && stats.length > 0) {
    const ratingTotal = Number(stats[0].ratingTotal) || 0;
    const ratingCount = Number(stats[0].ratingCount) || 0;
    const averageRating = Number(Number(stats[0].averageRating).toFixed(2)) || 0;

    await User.findByIdAndUpdate(userId, {
      ratingTotal,
      ratingCount,
      averageRating,
    });

    return { ratingTotal, ratingCount, averageRating };
  } else {
    await User.findByIdAndUpdate(userId, {
      ratingTotal: 0,
      ratingCount: 0,
      averageRating: 0,
    });

    return { ratingTotal: 0, ratingCount: 0, averageRating: 0 };
  }
}

/**
 * @desc    Submit a rating and review for a completed study session (Learner only)
 * @route   POST /api/reviews
 * @access  Private
 */
export async function submitReview(req, res, next) {
  try {
    const reviewerId = req.user._id;
    const reviewerName = req.user.name || 'Learner';
    const { sessionId, rating, comment } = req.body;

    // 1. Validate session ID
    if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid session ID is required.',
      });
    }

    // 2. Validate rating range
    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid numeric rating between 1 and 5.',
      });
    }

    // 3. Validate comment length if provided
    const cleanComment = (comment || '').trim();
    if (cleanComment.length > 300) {
      return res.status(400).json({
        success: false,
        message: 'Review comment cannot exceed 300 characters.',
      });
    }

    // 4. Verify session exists
    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    // 5. Verify session is completed
    if (session.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Reviews can only be submitted for completed sessions.',
      });
    }

    // 6. Strict learner rule: ONLY the learner can review the helper
    const isLearner = session.learnerId.toString() === reviewerId.toString();
    if (!isLearner) {
      return res.status(403).json({
        success: false,
        message: 'Only the learner of this session can submit a review.',
      });
    }

    // 7. Verify review recipient is the session helper
    const reviewedUserId = session.helperId;
    const helperUser = await User.findById(reviewedUserId);
    if (!helperUser) {
      return res.status(404).json({
        success: false,
        message: 'Reviewed tutor/helper was not found.',
      });
    }

    // 8. Prevent duplicate reviews (application layer check)
    const existingReview = await Review.findOne({
      sessionId: session._id,
      reviewerId,
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted a review for this session.',
      });
    }

    // 9. Create the review record in Atlas
    const newReview = await Review.create({
      sessionId: session._id,
      reviewerId,
      reviewerName,
      reviewedUserId,
      reviewedUserName: helperUser.name || session.helperName,
      rating: numericRating,
      comment: cleanComment,
    });

    // 10. Recalculate aggregates reliably using aggregation pipeline
    const aggregates = await updateHelperRatingAggregates(reviewedUserId);

    // 11. Optionally notify the helper about receiving a review
    await createNotificationHelper({
      recipientId: reviewedUserId,
      senderId: reviewerId,
      senderName: reviewerName,
      type: 'general',
      title: 'New Review Received ⭐',
      message: `${reviewerName} gave you a ${numericRating}-star review for ${session.subject}.`,
      relatedSessionId: session._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Review submitted successfully.',
      review: newReview.toJSON(),
      aggregates,
    });
  } catch (error) {
    // Handle duplicate key error gracefully if caught by MongoDB unique index
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted a review for this session.',
      });
    }
    next(error);
  }
}

/**
 * @desc    Get all reviews received by a user (public helper profile reviews)
 * @route   GET /api/reviews/user/:id
 * @access  Public or Protected
 */
export async function getUserReviews(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID.',
      });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const reviews = await Review.find({ reviewedUserId: id })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: reviews.length,
      userRating: {
        averageRating: targetUser.averageRating || 0,
        ratingCount: targetUser.ratingCount || 0,
        ratingTotal: targetUser.ratingTotal || 0,
      },
      reviews: reviews.map((r) => r.toJSON()),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Check if authenticated learner has rated a session
 * @route   GET /api/reviews/session/:sessionId
 * @access  Private
 */
export async function getSessionReview(req, res, next) {
  try {
    const { sessionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid session ID.',
      });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found.',
      });
    }

    // Check if current user is participant
    const isLearner = session.learnerId.toString() === req.user._id.toString();
    const isHelper = session.helperId.toString() === req.user._id.toString();

    if (!isLearner && !isHelper) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to check reviews for this session.',
      });
    }

    const review = await Review.findOne({
      sessionId,
      reviewerId: req.user._id,
    });

    return res.status(200).json({
      success: true,
      rated: Boolean(review),
      review: review ? review.toJSON() : null,
    });
  } catch (error) {
    next(error);
  }
}
