import { db, isFirebaseConfigured } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';

const MOCK_STORAGE_KEY = 'study_buddy_roulette_mock_users';

const DEMO_CANDIDATES = [
  {
    uid: 'demo-priya-01',
    name: 'Priya Sharma',
    email: 'priya@university.edu',
    phone: '9876543210',
    department: 'CSE',
    year: '3rd Year',
    bio: 'Passionate about Machine Learning, AI algorithms, and Python data science.',
    canHelp: [
      { subject: 'Machine Learning', level: 'Advanced' },
      { subject: 'Python', level: 'Advanced' },
      { subject: 'Data Structures', level: 'Intermediate' }
    ],
    availability: [
      { day: 'Monday', startTime: '16:00', endTime: '19:00' },
      { day: 'Wednesday', startTime: '17:00', endTime: '20:00' }
    ],
    mode: 'Both',
    location: 'College Library',
    profileCompleted: true
  },
  {
    uid: 'demo-rahul-02',
    name: 'Rahul Verma',
    email: 'rahul.v@university.edu',
    phone: '9876543211',
    department: 'IT',
    year: '2nd Year',
    bio: 'Frontend enthusiast & Java developer who loves pair programming.',
    canHelp: [
      { subject: 'Java', level: 'Advanced' },
      { subject: 'Machine Learning', level: 'Intermediate' },
      { subject: 'Web Development', level: 'Advanced' }
    ],
    availability: [
      { day: 'Monday', startTime: '15:00', endTime: '18:00' },
      { day: 'Friday', startTime: '16:00', endTime: '19:00' }
    ],
    mode: 'Offline',
    location: 'College Library',
    profileCompleted: true
  },
  {
    uid: 'demo-arjun-03',
    name: 'Arjun Mehta',
    email: 'arjun@university.edu',
    phone: '9876543212',
    department: 'ECE',
    year: '4th Year',
    bio: 'Hardware engineer with strong foundations in C++ & Computer Networks.',
    canHelp: [
      { subject: 'Computer Networks', level: 'Advanced' },
      { subject: 'C++', level: 'Advanced' },
      { subject: 'Machine Learning', level: 'Beginner' }
    ],
    availability: [
      { day: 'Tuesday', startTime: '14:00', endTime: '17:00' },
      { day: 'Thursday', startTime: '16:00', endTime: '19:00' }
    ],
    mode: 'Online',
    location: 'CSE Block',
    profileCompleted: true
  },
  {
    uid: 'demo-sneha-04',
    name: 'Sneha Patel',
    email: 'sneha@university.edu',
    phone: '9876543213',
    department: 'CSE',
    year: '2nd Year',
    bio: 'Database systems and SQL geek. Always eager to collaborate on assignments.',
    canHelp: [
      { subject: 'DBMS', level: 'Advanced' },
      { subject: 'Python', level: 'Intermediate' },
      { subject: 'Machine Learning', level: 'Intermediate' }
    ],
    availability: [
      { day: 'Monday', startTime: '16:30', endTime: '19:30' },
      { day: 'Saturday', startTime: '10:00', endTime: '13:00' }
    ],
    mode: 'Both',
    location: 'CSE Block',
    profileCompleted: true
  }
];

function getMockUsers() {
  try {
    const data = localStorage.getItem(MOCK_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveMockUsers(users) {
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error("Failed to save mock users", err);
  }
}

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

export async function getUserProfile(uid) {
  if (!uid) return null;

  if (isFirebaseConfigured && db) {
    try {
      const userRef = doc(db, "users", uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return { uid, ...snap.data() };
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile from Firestore:", error);
      throw error;
    }
  } else {
    const mockUsers = getMockUsers();
    if (mockUsers[uid]) {
      return { uid, ...mockUsers[uid] };
    }
    const demoFound = DEMO_CANDIDATES.find(c => c.uid === uid);
    return demoFound ? { ...demoFound } : null;
  }
}

export async function updateUserProfile(uid, profileData) {
  if (!uid) throw new Error("Invalid user ID");

  const completionStats = calculateProfileCompletion(profileData);

  const payload = {
    ...profileData,
    profileCompleted: completionStats.isComplete,
    completionPercentage: completionStats.percentage,
    updatedAt: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString()
  };

  if (isFirebaseConfigured && db) {
    try {
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, payload, { merge: true });
      return payload;
    } catch (error) {
      console.error("Error updating user profile in Firestore:", error);
      throw error;
    }
  } else {
    const mockUsers = getMockUsers();
    mockUsers[uid] = {
      ...(mockUsers[uid] || {}),
      ...payload
    };
    saveMockUsers(mockUsers);
    return payload;
  }
}

export async function getPotentialBuddies(currentUserId, requestedSubject) {
  let candidates = [];

  if (isFirebaseConfigured && db) {
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const candidateUid = docSnap.id;

        if (candidateUid !== currentUserId && data.profileCompleted === true) {
          candidates.push({ uid: candidateUid, ...data });
        }
      });

      if (candidates.length === 0) {
        candidates = DEMO_CANDIDATES.filter(c => c.uid !== currentUserId);
      }
    } catch (err) {
      console.error("Firestore candidate search error:", err);
      candidates = DEMO_CANDIDATES.filter(c => c.uid !== currentUserId);
    }
  } else {
    const mockUsers = getMockUsers();
    const localCandidates = Object.values(mockUsers).filter(
      u => u.uid !== currentUserId && u.profileCompleted === true
    );
    
    candidates = [...localCandidates, ...DEMO_CANDIDATES.filter(c => c.uid !== currentUserId)];
  }

  if (requestedSubject) {
    const normSubject = requestedSubject.trim().toLowerCase();
    candidates = candidates.filter(c => 
      Array.isArray(c.canHelp) && c.canHelp.some(
        skill => skill.subject.trim().toLowerCase() === normSubject
      )
    );
  }

  return candidates;
}
