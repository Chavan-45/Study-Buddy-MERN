import apiClient from './apiClient';

/**
 * Calculates profile completion percentage (excluding 'needHelp')
 */
export function calculateProfileCompletion(data) {
  if (!data) return { percentage: 0, isComplete: false, missingFields: ['Profile Data'] };

  let score = 0;
  const missing = [];

  // Name (15%)
  if (data.name && data.name.trim()) score += 15; else missing.push('Full Name');
  
  // Department & Year (25%)
  if (data.department && data.year) score += 25; else {
    if (!data.department) missing.push('Department');
    if (!data.year) missing.push('Year of Study');
  }

  // Bio (15%)
  if (data.bio && data.bio.trim().length >= 10) score += 15; else missing.push('Short Bio');

  // Can Help skills (25%)
  if (Array.isArray(data.canHelp) && data.canHelp.length > 0) score += 25; else missing.push('At least 1 "Can Help" Skill');

  // Availability (15%)
  if (Array.isArray(data.availability) && data.availability.length > 0) score += 15; else missing.push('At least 1 Availability Slot');

  // Mode & Location (5%)
  if (data.mode) {
    if (data.mode === 'Online') {
      score += 5;
    } else if ((data.mode === 'Offline' || data.mode === 'Both') && data.location && data.location.trim()) {
      score += 5;
    } else {
      missing.push('Preferred Study Location');
    }
  } else {
    missing.push('Preferred Study Mode');
  }

  const isComplete = (
    Boolean(data.name && data.name.trim()) &&
    Boolean(data.department) &&
    Boolean(data.year) &&
    Array.isArray(data.canHelp) && data.canHelp.length > 0 &&
    Array.isArray(data.availability) && data.availability.length > 0 &&
    Boolean(data.mode) &&
    (data.mode === 'Online' || Boolean(data.location && data.location.trim()))
  );

  return {
    percentage: Math.min(100, score),
    isComplete,
    missingFields: missing
  };
}

/**
 * Fetch student profile by user ID or current user
 */
export async function getUserProfile(uid) {
  if (!uid) return null;

  try {
    const response = await apiClient.get(`/users/profile/${uid}`);
    const profile = response.profile || response.user;
    if (!profile) return null;

    return {
      uid: profile.uid || profile._id,
      ...profile,
    };
  } catch (error) {
    console.error('Error fetching student profile from backend:', error);
    throw error;
  }
}

/**
 * Update current student profile in MongoDB Atlas
 */
export async function updateUserProfile(uid, profileData) {
  if (!uid) throw new Error('Invalid user ID');

  const completionStats = calculateProfileCompletion(profileData);

  const payload = {
    ...profileData,
    profileCompleted: completionStats.isComplete,
    completionPercentage: completionStats.percentage,
  };

  try {
    const response = await apiClient.put('/users/profile', payload);
    const updated = response.profile || response.user || payload;
    return {
      uid,
      ...updated,
    };
  } catch (error) {
    console.error('Error updating user profile in backend:', error);
    throw error;
  }
}

/**
 * Find potential study buddies for a subject or criteria from MERN backend
 */
export async function getPotentialBuddies(currentUserId, criteriaOrSubject) {
  try {
    let query = '';

    if (typeof criteriaOrSubject === 'string' && criteriaOrSubject.trim()) {
      query = `?subject=${encodeURIComponent(criteriaOrSubject.trim())}`;
    } else if (criteriaOrSubject && typeof criteriaOrSubject === 'object') {
      const params = new URLSearchParams();
      if (criteriaOrSubject.subject) {
        params.append('subject', String(criteriaOrSubject.subject).trim());
      }
      if (criteriaOrSubject.requiredLevel || criteriaOrSubject.level) {
        params.append('requiredLevel', criteriaOrSubject.requiredLevel || criteriaOrSubject.level);
      }
      if (criteriaOrSubject.day) {
        params.append('day', criteriaOrSubject.day);
      }
      if (criteriaOrSubject.startTime) {
        params.append('startTime', criteriaOrSubject.startTime);
      }
      if (criteriaOrSubject.endTime) {
        params.append('endTime', criteriaOrSubject.endTime);
      }
      if (criteriaOrSubject.mode) {
        params.append('mode', criteriaOrSubject.mode);
      }
      if (criteriaOrSubject.location) {
        params.append('location', criteriaOrSubject.location);
      }
      const qs = params.toString();
      if (qs) query = `?${qs}`;
    }

    const response = await apiClient.get(`/users/buddies${query}`);

    // Support response.buddies, response.candidates, or response.matches defensively
    const rawList =
      response.buddies ||
      response.candidates ||
      (Array.isArray(response.matches) ? response.matches.map((m) => m.candidate) : []) ||
      [];

    return rawList.map((b) => ({
      uid: b.uid || b._id,
      ...b,
    }));
  } catch (err) {
    console.error('Error fetching study buddies from backend:', err);
    throw err;
  }
}
