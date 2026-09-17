import { db, isFirebaseConfigured } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  runTransaction, 
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';

const MOCK_REVIEWS_KEY = 'study_buddy_mock_reviews';

function getMockReviews() {
  try {
    const data = localStorage.getItem(MOCK_REVIEWS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveMockReviews(reviews) {
  try {
    localStorage.setItem(MOCK_REVIEWS_KEY, JSON.stringify(reviews));
    window.dispatchEvent(new Event('study_reviews_updated'));
  } catch (err) {
    console.error("Failed to save mock reviews", err);
  }
}

/**
 * Checks if the user has already rated a specific session.
 */
export async function hasUserRatedSession(sessionId, reviewerId) {
  if (!sessionId || !reviewerId) return { rated: false };

  if (isFirebaseConfigured && db) {
    try {
      const reviewRef = doc(db, 'reviews', `${sessionId}_${reviewerId}`);
      const snap = await getDoc(reviewRef);
      if (snap.exists()) {
        return { rated: true, review: snap.data() };
      }
      return { rated: false };
    } catch (err) {
      console.error("Error checking review status:", err);
      return { rated: false };
    }
  } else {
    // Demo Mode
    const reviews = getMockReviews();
    const existing = reviews.find(r => r.sessionId === sessionId && r.reviewerId === reviewerId);
    return existing ? { rated: true, review: existing } : { rated: false };
  }
}

/**
 * Submits a rating and review for a completed study session.
 * STRICT RULE: Only the learner can rate the helper.
 */
export async function submitRating({
  sessionId,
  reviewerId,
  reviewerName,
  reviewedUserId,
  reviewedUserName,
  rating,
  comment = ''
}) {
  if (!sessionId || !reviewerId) {
    throw new Error("Missing required session or user information.");
  }

  const numericRating = Number(rating);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new Error("Please select a valid rating between 1 and 5 stars.");
  }

  const reviewDocId = `${sessionId}_${reviewerId}`;

  if (isFirebaseConfigured && db) {
    const reviewRef = doc(db, 'reviews', reviewDocId);
    const sessionRef = doc(db, 'sessions', sessionId);

    return await runTransaction(db, async (transaction) => {
      // 1. Check if session exists and is completed
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists()) {
        throw new Error("Study session not found.");
      }

      const sessionData = sessionSnap.data();
      if (sessionData.status !== 'completed') {
        throw new Error("Ratings are only allowed for completed sessions.");
      }

      // 2. Strict learner validation: ONLY the learner can rate
      const isLearner = sessionData.learnerId === reviewerId || sessionData.requesterId === reviewerId;
      if (!isLearner) {
        throw new Error("Only the learner can rate this Study Buddy.");
      }

      // The recipient MUST be the helper
      const targetUserId = sessionData.helperId || reviewedUserId;
      if (!targetUserId) {
        throw new Error("Target helper information missing.");
      }

      const reviewedUserRef = doc(db, 'users', targetUserId);

      // 3. Check duplicate review
      const existingReviewSnap = await transaction.get(reviewRef);
      if (existingReviewSnap.exists()) {
        throw new Error("You have already rated this Study Buddy.");
      }

      // 4. Read target helper user profile
      const userSnap = await transaction.get(reviewedUserRef);
      let oldTotal = 0;
      let oldCount = 0;

      if (userSnap.exists()) {
        const uData = userSnap.data();
        oldTotal = Number(uData.ratingTotal || 0);
        oldCount = Number(uData.ratingCount || 0);
      }

      const newTotal = oldTotal + numericRating;
      const newCount = oldCount + 1;
      const newAverage = Number((newTotal / newCount).toFixed(2));

      // 5. Create review document
      const reviewData = {
        sessionId,
        reviewerId,
        reviewerName: reviewerName || 'Learner',
        reviewedUserId: targetUserId,
        reviewedUserName: reviewedUserName || sessionData.helperName || 'Helper',
        rating: numericRating,
        comment: (comment || '').trim().substring(0, 300),
        createdAt: serverTimestamp()
      };

      transaction.set(reviewRef, reviewData);

      // 6. Update helper user document rating metrics safely
      transaction.set(reviewedUserRef, {
        ratingTotal: newTotal,
        ratingCount: newCount,
        averageRating: newAverage
      }, { merge: true });

      return { reviewDocId, averageRating: newAverage, ratingCount: newCount };
    });
  } else {
    // Demo Mode
    const reviews = getMockReviews();
    if (reviews.some(r => r.sessionId === sessionId && r.reviewerId === reviewerId)) {
      throw new Error("You have already rated this Study Buddy.");
    }

    const reviewData = {
      id: reviewDocId,
      sessionId,
      reviewerId,
      reviewerName: reviewerName || 'Learner',
      reviewedUserId,
      reviewedUserName: reviewedUserName || 'Helper',
      rating: numericRating,
      comment: (comment || '').trim().substring(0, 300),
      createdAt: new Date().toISOString()
    };

    reviews.push(reviewData);
    saveMockReviews(reviews);

    return { reviewDocId, averageRating: numericRating, ratingCount: 1 };
  }
}

/**
 * Fetches recent reviews for a user.
 */
export async function getUserReviews(userId, maxCount = 10) {
  if (!userId) return [];
  if (isFirebaseConfigured && db) {
    try {
      const q = query(
        collection(db, 'reviews'),
        where('reviewedUserId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(maxCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.error("Error fetching user reviews:", err);
      return [];
    }
  } else {
    const reviews = getMockReviews();
    return reviews.filter(r => r.reviewedUserId === userId);
  }
}
