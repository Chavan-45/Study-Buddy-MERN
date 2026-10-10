/**
 * Matching Algorithm Utility for Study Buddy Roulette Backend
 * Directly synchronized with frontend matchingAlgorithm.js for 100% algorithm parity
 */

export function normalizeString(str) {
  if (!str) return '';
  return String(str).trim().toLowerCase().replace(/\s+/g, ' ');
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
 * Standard alias groupings for common subjects & course titles
 */
export const SUBJECT_ALIASES = [
  ['ml', 'machine learning'],
  ['dsa', 'data structures', 'data structures and algorithms', 'data structures & algorithms', 'data structure', 'data structures and algorithm'],
  ['dbms', 'database', 'databases', 'database management system', 'database management systems'],
  ['cn', 'computer networks', 'computer network', 'networking'],
  ['os', 'operating systems', 'operating system'],
  ['web dev', 'web development', 'web design'],
  ['c++', 'cpp', 'c plus plus'],
  ['c#', 'csharp', 'c sharp'],
  ['ai', 'artificial intelligence'],
  ['oop', 'oops', 'object oriented programming', 'object oriented programming systems'],
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['node', 'nodejs', 'node.js'],
  ['react', 'reactjs', 'react.js'],
  ['py', 'python'],
];

const GENERIC_SUFFIXES = ['programming', 'course', 'basics', 'fundamentals', '101', 'lab'];

/**
 * Extracts a subject string safely from a skill entry (object or string)
 */
export function getSubjectString(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    return item.subject || item.skill || item.name || '';
  }
  return String(item);
}

/**
 * Checks whether two subject terms represent a matching skill.
 * Normalizes case, internal whitespace, punctuation variations (e.g. Node.js vs NodeJS, C++ vs cpp),
 * common academic aliases (e.g. ML vs Machine Learning, DSA vs Data Structures),
 * and multi-token academic phrases.
 */
export function isSubjectMatch(requestedSubject, candidateSubject) {
  const a = normalizeString(requestedSubject);
  const b = normalizeString(candidateSubject);
  if (!a || !b) return false;
  if (a === b) return true;

  // Compare without punctuation/delimiters like dots, dashes, underscores, slashes
  const cleanA = a.replace(/[\s.\-_/]/g, '');
  const cleanB = b.replace(/[\s.\-_/]/g, '');
  if (cleanA && cleanB && cleanA === cleanB) return true;

  // Check alias dictionary
  for (const group of SUBJECT_ALIASES) {
    const hasA = group.some((alias) => alias === a || alias === cleanA);
    const hasB = group.some((alias) => alias === b || alias === cleanB);
    if (hasA && hasB) return true;
  }

  // Tokenize ignoring conjunctions
  const getTokens = (str) =>
    normalizeString(str)
      .replace(/[&,+]/g, ' ')
      .split(/\s+/)
      .filter((t) => t && t !== 'and' && t !== 'the' && t !== 'in' && t !== 'of');

  const tokensA = getTokens(a);
  const tokensB = getTokens(b);

  // If one is multi-word (>= 2 tokens) and all its key tokens appear in the other
  if (tokensA.length >= 2 && tokensB.length >= 2) {
    const aInB = tokensA.every((t) => tokensB.includes(t));
    const bInA = tokensB.every((t) => tokensA.includes(t));
    if (aInB || bInA) return true;
  }

  // Handle single-term exact subject with generic qualifiers (e.g., 'Python' vs 'Python Programming')
  if (tokensA.length === 1 && tokensB.length === 2 && tokensB[0] === tokensA[0] && GENERIC_SUFFIXES.includes(tokensB[1])) {
    return true;
  }
  if (tokensB.length === 1 && tokensA.length === 2 && tokensA[0] === tokensB[0] && GENERIC_SUFFIXES.includes(tokensA[1])) {
    return true;
  }

  return false;
}

/**
 * 1. Subject Score (35 points max)
 */
export function calculateSubjectScore(requestedSubject, candidateCanHelp = []) {
  if (!requestedSubject || !Array.isArray(candidateCanHelp)) {
    return { score: 0, matchedSkill: null };
  }

  const matchedSkill = candidateCanHelp.find((item) => {
    const candidateSub = getSubjectString(item);
    return isSubjectMatch(requestedSubject, candidateSub);
  });

  if (matchedSkill) {
    const skillObj =
      typeof matchedSkill === 'string'
        ? { subject: matchedSkill, level: 'Intermediate' }
        : {
            subject: getSubjectString(matchedSkill),
            level: matchedSkill.level || 'Intermediate',
            ...matchedSkill,
          };
    return { score: 35, matchedSkill: skillObj };
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
  if (!requestedSlot || !requestedSlot.day || !Array.isArray(candidateAvailability)) {
    return { score: 0, slotMatch: null };
  }

  const reqDay = normalizeString(requestedSlot.day);
  const reqStart = timeToMinutes(requestedSlot.startTime);
  const reqEnd = timeToMinutes(requestedSlot.endTime);

  if (reqEnd <= reqStart) return { score: 0, slotMatch: null };

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
  const currentId = criteria.currentUserId || criteria.currentUid || criteria.userId || criteria.uid;

  for (const candidate of candidates) {
    // Exclude current user to prevent self-matching
    const candidateId = candidate.uid || candidate._id?.toString?.() || candidate._id;
    if (currentId && candidateId && String(candidateId) === String(currentId)) {
      continue;
    }

    // 1. Subject score
    const subjectResult = calculateSubjectScore(criteria.subject, candidate.canHelp);
    if (!subjectResult || subjectResult.score === 0) continue; // Exclude candidates without requested subject

    // 2. Skill level score
    const helperLevel = subjectResult.matchedSkill?.level || 'Intermediate';
    const skillScore = calculateSkillScore(criteria.requiredLevel, helperLevel);

    // 3. Availability score
    const availResult = calculateAvailabilityScore(
      {
        day: criteria.day,
        startTime: criteria.startTime,
        endTime: criteria.endTime,
      },
      candidate.availability
    );

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
      subjectResult.score + skillScore + (availResult?.score || 0) + modeScore + locationScore
    );

    const breakdown = {
      subjectScore: subjectResult.score,
      skillScore,
      availabilityScore: availResult?.score || 0,
      modeScore,
      locationScore,
      totalScore,
      matchedSkill: subjectResult.matchedSkill,
      matchedAvailability: availResult?.slotMatch || null,
      explanations: [
        { label: `Subject matched (${criteria.subject})`, passed: subjectResult.score > 0 },
        { label: `Skill level suitable (${helperLevel})`, passed: skillScore >= 10 },
        { label: `Availability overlaps on ${criteria.day || 'scheduled day'}`, passed: (availResult?.score || 0) > 0 },
        { label: `Preferred mode compatible (${candidate.mode || 'Both'})`, passed: modeScore > 0 },
        { label: `Study location matches (${candidate.location || 'Library'})`, passed: locationScore > 0 },
      ],
    };

    results.push({
      candidate: typeof candidate.toJSON === 'function' ? candidate.toJSON() : candidate,
      matchScore: totalScore,
      breakdown,
    });
  }

  // Sort by highest matchScore descending
  results.sort((a, b) => b.matchScore - a.matchScore);

  return results;
}
