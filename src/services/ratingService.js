import apiClient from './apiClient';

/**
 * Checks if the user has already rated a specific session
 */
export async function hasUserRatedSession(sessionId, reviewerId) {
  if (!sessionId) return { rated: false };

  try {
    const response = await apiClient.get(`/reviews/session/${sessionId}`);
    return {
      rated: Boolean(response.rated),
      review: response.review || null,
    };
  } catch (err) {
    console.error('Error checking review status from backend:', err);
    return { rated: false };
  }
}

/**
 * Submits a rating and review for a completed study session
 * STRICT RULE: Only the learner can rate the helper
 */
export async function submitRating({
  sessionId,
  reviewerId,
  reviewerName,
  reviewedUserId,
  reviewedUserName,
  rating,
  comment = '',
}) {
  if (!sessionId) {
    throw new Error('Missing required session information.');
  }

  const numericRating = Number(rating);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new Error('Please select a valid rating between 1 and 5 stars.');
  }

  const payload = {
    sessionId,
    rating: numericRating,
    comment: (comment || '').trim().substring(0, 300),
  };

  const response = await apiClient.post('/reviews', payload);

  window.dispatchEvent(new Event('study_reviews_updated'));

  const rev = response.review || {};
  return {
    reviewDocId: rev.id || rev._id,
    averageRating: response.aggregates?.averageRating,
    ratingCount: response.aggregates?.ratingCount,
  };
}

/**
 * Fetches recent reviews for a user
 */
export async function getUserReviews(userId, maxCount = 10) {
  if (!userId) return [];

  try {
    const response = await apiClient.get(`/reviews/user/${userId}?limit=${maxCount}`);
    const reviews = response.reviews || [];
    return reviews.map((r) => ({
      id: r.id || r._id,
      ...r,
    }));
  } catch (err) {
    console.error('Error fetching user reviews from backend:', err);
    return [];
  }
}
