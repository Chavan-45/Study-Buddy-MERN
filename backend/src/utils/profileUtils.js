/**
 * Calculates profile completion percentage and validation status
 * Reused from Study Buddy Roulette frontend specification
 */
export function calculateProfileCompletion(data) {
  if (!data) return { percentage: 0, isComplete: false, missingFields: ['Profile Data'] };

  let score = 0;
  const missing = [];

  // Name (15%)
  if (data.name && data.name.trim()) score += 15;
  else missing.push('Full Name');

  // Department & Year (25%)
  if (data.department && data.year) score += 25;
  else {
    if (!data.department) missing.push('Department');
    if (!data.year) missing.push('Year of Study');
  }

  // Bio (15%)
  if (data.bio && data.bio.trim().length >= 10) score += 15;
  else missing.push('Short Bio');

  // Can Help skills (25%)
  if (Array.isArray(data.canHelp) && data.canHelp.length > 0) score += 25;
  else missing.push('At least 1 "Can Help" Skill');

  // Availability (15%)
  if (Array.isArray(data.availability) && data.availability.length > 0) score += 15;
  else missing.push('At least 1 Availability Slot');

  // Mode & Location (5%)
  if (data.mode) {
    if (data.mode === 'Online') {
      score += 5;
    } else if (
      (data.mode === 'Offline' || data.mode === 'Both') &&
      data.location &&
      data.location.trim()
    ) {
      score += 5;
    } else {
      missing.push('Preferred Study Location');
    }
  } else {
    missing.push('Preferred Study Mode');
  }

  const isComplete =
    Boolean(data.name && data.name.trim()) &&
    Boolean(data.department) &&
    Boolean(data.year) &&
    Array.isArray(data.canHelp) &&
    data.canHelp.length > 0 &&
    Array.isArray(data.availability) &&
    data.availability.length > 0 &&
    Boolean(data.mode) &&
    (data.mode === 'Online' || Boolean(data.location && data.location.trim()));

  return {
    percentage: Math.min(100, score),
    isComplete,
    missingFields: missing,
  };
}
