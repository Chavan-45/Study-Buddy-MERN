/**
 * Matching Algorithm Utility for Study Buddy Roulette
 */

export function normalizeString(str) {
  if (!str) return '';
  return String(str).trim().toLowerCase();
}

export function levelToNumeric(levelStr) {
  const norm = normalizeString(levelStr);
  if (norm === 'advanced') return 3;
  if (norm === 'intermediate') return 2;
  if (norm === 'beginner') return 1;
  return 2; // Default to intermediate if unspecified
}

export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * 1. Subject Score (35 points max)
 */
export function calculateSubjectScore(requestedSubject, candidateCanHelp = []) {
  if (!requestedSubject || !Array.isArray(candidateCanHelp)) return 0;
  const reqNorm = normalizeString(requestedSubject);

  const matchedSkill = candidateCanHelp.find(
    item => normalizeString(item.subject) === reqNorm
  );

  if (matchedSkill) {
    return { score: 35, matchedSkill };
  }

  return { score: 0, matchedSkill: null };
}

/**
 * 2. Skill Level Score (20 points max)
 */
export function calculateSkillScore(requestedLevel, helperLevel) {
  const reqNum = levelToNumeric(requestedLevel);
  const helpNum = levelToNumeric(helperLevel);

  if (helpNum >= reqNum) {
    return 20; // Full score if helper is equal or higher level
  } else if (helpNum === reqNum - 1) {
    return 10; // Partial score if 1 level below
  }
  return 0;
}

/**
 * 3. Availability Score (20 points max)
 */
export function calculateAvailabilityScore(requestedSlot, candidateAvailability = []) {
  if (!requestedSlot || !requestedSlot.day || !Array.isArray(candidateAvailability)) return 0;

  const reqDay = normalizeString(requestedSlot.day);
  const reqStart = timeToMinutes(requestedSlot.startTime);
  const reqEnd = timeToMinutes(requestedSlot.endTime);

  if (reqEnd <= reqStart) return 0;

  let maxScore = 0;
  let bestSlotMatch = null;

  for (const slot of candidateAvailability) {
    if (normalizeString(slot.day) === reqDay) {
      const candStart = timeToMinutes(slot.startTime);
      const candEnd = timeToMinutes(slot.endTime);

      const overlapStart = Math.max(reqStart, candStart);
      const overlapEnd = Math.min(reqEnd, candEnd);
      const overlapMinutes = Math.max(0, overlapEnd - overlapStart);

      if (overlapMinutes >= 60) {
        return { score: 20, slotMatch: slot }; // Strong overlap
      } else if (overlapMinutes > 0 && maxScore < 15) {
        maxScore = 15; // Partial overlap
        bestSlotMatch = slot;
      }
    }
  }

  return { score: maxScore, slotMatch: bestSlotMatch };
}

/**
 * 4. Mode Compatibility Score (15 points max)
 */
export function calculateModeScore(requestedMode, candidateMode) {
  const req = normalizeString(requestedMode || 'both');
  const cand = normalizeString(candidateMode || 'both');

  if (req === 'online') {
    if (cand === 'online' || cand === 'both') return 15;
    return 0;
  }

  if (req === 'offline') {
    if (cand === 'offline' || cand === 'both') return 15;
    return 0;
  }

  // Requested Both
  if (cand === 'online' || cand === 'offline' || cand === 'both') return 15;
  return 0;
}

/**
 * 5. Location Match Score (10 points max)
 */
export function calculateLocationScore(requestedMode, requestedLocation, candidateMode, candidateLocation) {
  const reqMode = normalizeString(requestedMode || 'both');

  // If session is online, location does not penalize
  if (reqMode === 'online') return 10;

  const reqLoc = normalizeString(requestedLocation);
  const candLoc = normalizeString(candidateLocation);

  if (reqLoc && candLoc && reqLoc === candLoc) {
    return 10;
  }

  return 0;
}

/**
 * Main Algorithm: Ranks candidates based on total match score
 */
export function findBestMatches(criteria, candidates = []) {
  if (!criteria || !Array.isArray(candidates)) return [];

  const results = [];

  for (const candidate of candidates) {
    // 1. Subject score
    const subjectResult = calculateSubjectScore(criteria.subject, candidate.canHelp);
    if (subjectResult.score === 0) continue; // Exclude candidates without requested subject

    // 2. Skill level score
    const helperLevel = subjectResult.matchedSkill?.level || 'Intermediate';
    const skillScore = calculateSkillScore(criteria.requiredLevel, helperLevel);

    // 3. Availability score
    const availResult = calculateAvailabilityScore({
      day: criteria.day,
      startTime: criteria.startTime,
      endTime: criteria.endTime
    }, candidate.availability);

    // 4. Mode score
    const modeScore = calculateModeScore(criteria.mode, candidate.mode);

    // Exclude incompatible mode candidates if mode is strictly conflicting
    if (modeScore === 0) continue;

    // 5. Location score
    const locationScore = calculateLocationScore(
      criteria.mode,
      criteria.location,
      candidate.mode,
      candidate.location
    );

    const totalScore = Math.min(
      100,
      subjectResult.score + skillScore + availResult.score + modeScore + locationScore
    );

    const breakdown = {
      subjectScore: subjectResult.score,
      skillScore,
      availabilityScore: availResult.score,
      modeScore,
      locationScore,
      totalScore,
      matchedSkill: subjectResult.matchedSkill,
      matchedAvailability: availResult.slotMatch,
      explanations: [
        { label: `Subject matched (${criteria.subject})`, passed: subjectResult.score > 0 },
        { label: `Skill level suitable (${helperLevel})`, passed: skillScore >= 10 },
        { label: `Availability overlaps on ${criteria.day}`, passed: availResult.score > 0 },
        { label: `Preferred mode compatible (${candidate.mode || 'Both'})`, passed: modeScore > 0 },
        { label: `Study location matches (${candidate.location || 'Library'})`, passed: locationScore > 0 }
      ]
    };

    results.push({
      candidate,
      matchScore: totalScore,
      breakdown
    });
  }

  // Sort by highest matchScore descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  return results;
}
