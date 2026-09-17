import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Star, X, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { submitRating } from '../services/ratingService';

export default function RatingModal({
  session,
  currentUser,
  onClose,
  onRatingSubmitted
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!session || !currentUser) return null;

  // Strict check: Only the learner can rate the helper
  const isLearner = session.learnerId === currentUser.uid || session.requesterId === currentUser.uid;
  const reviewedUserId = session.helperId;
  const reviewedUserName = session.helperName || 'Study Buddy';
  const reviewerName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Learner';

  const handleCancel = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (isSubmitting) return;

    setError('');
    setSuccess('');

    if (!isLearner) {
      setError("Only the learner can rate this Study Buddy.");
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      setError("Please select a rating before submitting.");
      return;
    }

    if (!reviewedUserId) {
      setError("Could not identify the helper for this study session.");
      return;
    }

    setIsSubmitting(true);

    try {
      await submitRating({
        sessionId: session.id,
        reviewerId: currentUser.uid,
        reviewerName,
        reviewedUserId,
        reviewedUserName,
        rating,
        comment
      });

      setSuccess("Rating submitted successfully ⭐");
      
      if (onRatingSubmitted) {
        onRatingSubmitted(session.id, rating);
      }

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      console.error("Rating submission failed:", err);
      setError(err.message || "Unable to submit rating. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingText = (val) => {
    switch (val) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent';
      default: return '';
    }
  };

  const activeRatingVal = hoverRating || rating;

  const modalJSX = (
    <div 
      className="rating-popup-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div 
        className="rating-popup"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="rating-popup-header">
          <div>
            <h3 className="rating-popup-title">
              Rate Your Study Buddy
            </h3>
            <p className="rating-popup-subtitle">
              How was your session with <strong>{reviewedUserName}</strong>?
            </p>
          </div>
          <button
            type="button"
            className="rating-popup-close-btn"
            onClick={handleCancel}
            aria-label="Close popup"
            disabled={isSubmitting}
            id="btn-close-rating-modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* BODY */}
        <div className="rating-popup-body">
          {error && (
            <div className="alert-banner error">
              <AlertCircle size={16} />
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div className="alert-banner success">
              <CheckCircle2 size={16} />
              <div>{success}</div>
            </div>
          )}

          {/* COMPACT BUDDY IDENTITY SUMMARY */}
          <div className="rating-buddy-summary">
            <div className="candidate-avatar sm" style={{ width: '40px', height: '40px', fontSize: '1rem', flexShrink: 0 }}>
              {reviewedUserName ? reviewedUserName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1c1917' }}>
                {reviewedUserName}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 600 }}>
                Your Study Buddy • {session.subject || 'Subject'}
              </span>
            </div>
          </div>

          <form id="rating-popup-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* STAR RATING SECTION */}
            <div className="rating-stars-container">
              <span className="rating-section-label">
                Your Rating
              </span>

              <div className="rating-stars-row">
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isFilled = activeRatingVal >= starVal;
                  return (
                    <button
                      key={starVal}
                      type="button"
                      className={`rating-star-button ${isFilled ? 'filled' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRating(starVal);
                      }}
                      onMouseEnter={() => setHoverRating(starVal)}
                      onMouseLeave={() => setHoverRating(0)}
                      aria-label={`Rate ${starVal} stars`}
                      disabled={isSubmitting}
                      id={`star-btn-${starVal}`}
                    >
                      <Star 
                        size={32} 
                        fill={isFilled ? '#f59e0b' : 'transparent'} 
                        color={isFilled ? '#f59e0b' : '#d6d3d1'} 
                        strokeWidth={1.75}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="rating-feedback-wrapper">
                {activeRatingVal > 0 ? (
                  <span className="rating-feedback-badge">
                    <strong>{activeRatingVal} out of 5</strong> — {getRatingText(activeRatingVal)}
                  </span>
                ) : (
                  <span className="rating-feedback-placeholder">
                    Click to rate 1 to 5 stars
                  </span>
                )}
              </div>
            </div>

            {/* REVIEW TEXTAREA SECTION */}
            <div className="rating-review-section">
              <div className="rating-review-header">
                <label htmlFor="review-comment" className="rating-review-label">
                  Review (Optional)
                </label>
                <span className="rating-character-count" style={{ color: comment.length > 300 ? '#dc2626' : '#a8a29e' }}>
                  {comment.length} / 300
                </span>
              </div>
              <textarea
                id="review-comment"
                rows={3}
                placeholder="Share your learning experience with this Study Buddy..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={300}
                className="themed-textarea rating-textarea"
                disabled={isSubmitting}
              ></textarea>
            </div>
          </form>
        </div>

        {/* FIXED FOOTER ACTIONS */}
        <div className="rating-popup-footer">
          <button
            type="button"
            className="btn-secondary rating-cancel-button"
            onClick={handleCancel}
            disabled={isSubmitting}
            id="btn-cancel-rating"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="rating-popup-form"
            className="btn-primary rating-submit-button"
            disabled={isSubmitting || rating === 0}
            id="btn-submit-rating"
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span> Submitting...
              </>
            ) : (
              <>
                <Star size={16} fill="#ffffff" /> Submit Rating
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalJSX, document.body);
}
