console.log("ENV PROJECT ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID);
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';

// Helper to get saved dynamic firebase config from localStorage if env variables are empty
function getSavedConfig() {
  try {
    const saved = localStorage.getItem('study_buddy_firebase_config');
    if (saved) return JSON.parse(saved);
  } catch { }
  return null;
}

const savedConfig = getSavedConfig();

const firebaseConfig = {
  apiKey: savedConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: savedConfig?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: savedConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: savedConfig?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: savedConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: savedConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID || ""
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "your_api_key_here" &&
  firebaseConfig.projectId
);

let app;
let auth;
let db;

if (isFirebaseConfigured) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("🔥 Firebase initialized with project:", firebaseConfig.projectId);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

export { app, auth, db };

export function saveCustomFirebaseConfig(config) {
  try {
    localStorage.setItem('study_buddy_firebase_config', JSON.stringify(config));
    window.location.reload();
  } catch (e) {
    console.error("Failed to save firebase config", e);
  }
}

export function clearCustomFirebaseConfig() {
  localStorage.removeItem('study_buddy_firebase_config');
  window.location.reload();
}

/**
 * Friendly error message parser for Firebase Auth error codes
 */
export function getFriendlyErrorMessage(error) {
  if (!error) return "An unexpected error occurred. Please try again.";
  const code = error.code || error.message || String(error);

  switch (code) {
    case 'auth/email-already-in-use':
      return "An account with this email address already exists. Try logging in instead.";
    case 'auth/invalid-email':
      return "The email address entered is invalid. Please check for typos.";
    case 'auth/operation-not-allowed':
      return "Email/Password sign-in is not enabled in your Firebase console. Go to Auth > Sign-in method to enable it.";
    case 'auth/weak-password':
      return "The password is too weak. Please use at least 6 characters.";
    case 'auth/user-disabled':
      return "This account has been disabled. Please contact support.";
    case 'auth/user-not-found':
      return "No account was found with this email address. Please check for typos or register first.";
    case 'auth/wrong-password':
      return "Incorrect password. Please check your credentials and try again.";
    case 'auth/invalid-credential':
      return "Invalid email or password. Please verify your credentials.";
    case 'auth/too-many-requests':
      return "Too many unsuccessful attempts. Access suspended temporarily. Please try again later.";
    case 'auth/network-request-failed':
      return "Network error. Please check your internet connection.";
    default:
      if (typeof error === 'string') return error;
      return error.message || "Authentication failed. Please check your credentials.";
  }
}

// Mock storage for Demo Mode
const MOCK_STORAGE_KEY = 'study_buddy_roulette_mock_users';

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
 * REGISTER USER
 */
export async function registerUser({ name, email, phone, password }) {
  try {
    sessionStorage.setItem(`pending_phone_${email.toLowerCase()}`, phone);
    sessionStorage.setItem(`pending_name_${email.toLowerCase()}`, name);
  } catch { }

  if (isFirebaseConfigured && auth) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, { displayName: name });
    await sendEmailVerification(user);
    await signOut(auth);

    return { user, uid: user.uid };
  } else {
    // Demo Mode
    await new Promise((res) => setTimeout(res, 800));
    const mockUsers = getMockUsers();

    if (Object.values(mockUsers).some(u => u.email.toLowerCase() === email.toLowerCase())) {
      const err = new Error("Email already in use");
      err.code = 'auth/email-already-in-use';
      throw err;
    }

    const mockUid = 'demo-uid-' + Date.now();
    const newUser = {
      uid: mockUid,
      name,
      email,
      phone,
      emailVerified: false,
      createdAt: new Date().toISOString(),
      firestoreCreated: false
    };

    mockUsers[mockUid] = { ...newUser, password };
    saveMockUsers(mockUsers);

    return { user: newUser, uid: mockUid, isDemo: true };
  }
}

/**
 * LOGIN USER
 */
export async function loginUser(email, password) {
  if (isFirebaseConfigured && auth) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } else {
    await new Promise((res) => setTimeout(res, 800));
    const mockUsers = getMockUsers();
    const foundEntry = Object.values(mockUsers).find(
      u => u.email.toLowerCase() === email.toLowerCase()
    );

    if (!foundEntry) {
      const err = new Error("User not found");
      err.code = 'auth/user-not-found';
      throw err;
    }

    if (foundEntry.password !== password) {
      const err = new Error("Invalid credential");
      err.code = 'auth/invalid-credential';
      throw err;
    }

    const { password: _, ...userWithoutPass } = foundEntry;
    return userWithoutPass;
  }
}

/**
 * PASSWORD RESET EMAIL
 */
export async function resetUserPassword(email) {
  if (isFirebaseConfigured && auth) {
    await sendPasswordResetEmail(auth, email);
    return true;
  } else {
    await new Promise((res) => setTimeout(res, 800));
    const mockUsers = getMockUsers();
    const foundEntry = Object.values(mockUsers).find(
      u => u.email.toLowerCase() === email.toLowerCase()
    );
    if (!foundEntry) {
      const err = new Error("User not found");
      err.code = 'auth/user-not-found';
      throw err;
    }
    return true;
  }
}

/**
 * CREATES FIRESTORE USER DOCUMENT ONLY AFTER EMAIL IS VERIFIED
 */
export async function createFirestoreDocIfVerified(user) {
  if (!user || !user.emailVerified) return null;

  const emailLower = user.email ? user.email.toLowerCase() : '';
  const pendingPhone = sessionStorage.getItem(`pending_phone_${emailLower}`) || user.phoneNumber || '';
  const pendingName = sessionStorage.getItem(`pending_name_${emailLower}`) || user.displayName || 'User Name';

  if (isFirebaseConfigured && db) {
    const userDocRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      const userData = {
        name: pendingName,
        email: user.email,
        phone: pendingPhone,
        emailVerified: true,
        createdAt: serverTimestamp()
      };
      await setDoc(userDocRef, userData);
      console.log("✅ Firestore 'users' document created after verification:", user.uid);
      return userData;
    } else {
      await setDoc(userDocRef, { emailVerified: true }, { merge: true });
      return userSnap.data();
    }
  } else {
    const mockUsers = getMockUsers();
    if (mockUsers[user.uid]) {
      mockUsers[user.uid].emailVerified = true;
      mockUsers[user.uid].firestoreCreated = true;
      saveMockUsers(mockUsers);
      return mockUsers[user.uid];
    }
    return null;
  }
}

export async function resendVerification(currentUser) {
  if (isFirebaseConfigured && auth) {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    } else {
      throw new Error("Session expired. Please log in again to send verification email.");
    }
    return true;
  } else {
    await new Promise((res) => setTimeout(res, 600));
    if (currentUser && currentUser.uid) {
      const mockUsers = getMockUsers();
      if (mockUsers[currentUser.uid]) {
        mockUsers[currentUser.uid].emailVerified = true;
        saveMockUsers(mockUsers);
      }
    }
    return true;
  }
}

export async function logoutUser() {
  if (isFirebaseConfigured && auth) {
    await signOut(auth);
  }
}
