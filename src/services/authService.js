import apiClient, {
  setStoredToken,
  getStoredToken,
  setStoredUser,
  getStoredUser,
  clearStoredAuth,
} from './apiClient';

/**
 * Format user object from backend to match frontend expectations
 */
export function formatAuthUser(user) {
  if (!user) return null;
  return {
    ...user,
    uid: user.uid || user._id,
    displayName: user.displayName || user.name || 'Student',
    emailVerified: user.emailVerified !== undefined ? Boolean(user.emailVerified) : true,
  };
}

/**
 * Register a new user account with MERN backend
 */
export async function registerUser({ name, email, phone, password }) {
  if (!name || !name.trim()) throw new Error('Full Name cannot be empty.');
  if (!email || !email.trim()) throw new Error('Email cannot be empty.');
  if (!phone || !phone.trim()) throw new Error('Phone number cannot be empty.');
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const payload = {
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    password,
  };

  const response = await apiClient.post('/auth/register', payload);

  if (response?.token) {
    setStoredToken(response.token);
  }

  const user = formatAuthUser(response?.user);
  if (user) {
    setStoredUser(user);
    window.dispatchEvent(new CustomEvent('study_buddy_auth_changed', { detail: user }));
  }

  return {
    user,
    uid: user?.uid,
    message: response?.message,
  };
}

/**
 * Authenticate user credentials with MERN backend
 */
export async function loginUser(email, password) {
  if (!email || !email.trim()) throw new Error('Email is required.');
  if (!password) throw new Error('Password is required.');

  const payload = {
    email: email.trim(),
    password,
  };

  const response = await apiClient.post('/auth/login', payload);

  if (response?.token) {
    setStoredToken(response.token);
  }

  const user = formatAuthUser(response?.user);
  if (user) {
    setStoredUser(user);
    window.dispatchEvent(new CustomEvent('study_buddy_auth_changed', { detail: user }));
  }

  return user;
}

/**
 * Log out and clear all stored authentication tokens
 */
export async function logoutUser() {
  clearStoredAuth();
}

/**
 * Restore authenticated session on page refresh from backend
 */
export async function getCurrentUser() {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const response = await apiClient.get('/auth/me');
    if (response?.user) {
      const user = formatAuthUser(response.user);
      setStoredUser(user);
      return user;
    }
    return null;
  } catch (error) {
    // If token invalid or expired, clear and return null
    if (error.status === 401) {
      clearStoredAuth();
    }
    return null;
  }
}

/**
 * Dispatch application-wide authentication state change event with user detail
 */
export function notifyAuthStateChanged(user) {
  const payload = user !== undefined ? user : formatAuthUser(getStoredUser());
  window.dispatchEvent(new CustomEvent('study_buddy_auth_changed', { detail: payload }));
}

/**
 * Subscribe to auth state changes (replaces Firebase onAuthStateChanged)
 */
export function subscribeToAuthState(callback) {
  // Initial check: if cached user exists, emit immediately to prevent UI flash
  const cachedUser = formatAuthUser(getStoredUser());
  if (cachedUser && getStoredToken()) {
    callback(cachedUser);
  }

  // Then verify with backend asynchronously
  getCurrentUser()
    .then((verifiedUser) => {
      callback(verifiedUser);
    })
    .catch(() => {
      callback(null);
    });

  const handler = (event) => {
    if (event?.detail !== undefined) {
      callback(event.detail);
    } else {
      const stored = getStoredUser();
      const token = getStoredToken();
      callback(stored && token ? formatAuthUser(stored) : null);
    }
  };

  window.addEventListener('study_buddy_auth_changed', handler);
  return () => {
    window.removeEventListener('study_buddy_auth_changed', handler);
  };
}

/**
 * Password reset placeholder (notifies user)
 */
export async function resetUserPassword(email) {
  if (!email || !email.trim()) throw new Error('Please enter your email address.');
  // External email is not configured in MERN mini project
  return true;
}

/**
 * Compatibility helper for existing AuthForm
 */
export async function createFirestoreDocIfVerified(user) {
  return formatAuthUser(user);
}

/**
 * Request or resend verification email from backend
 */
export async function resendVerification(userOrEmail) {
  const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail?.email;
  const payload = email ? { email } : {};
  return await apiClient.post('/auth/resend-verification', payload);
}

/**
 * Verify email using cryptographic token from email link.
 * After backend validation, refreshes the authoritative session profile via GET /auth/me.
 */
export async function verifyEmailToken(token) {
  if (!token || !token.trim()) {
    throw new Error('A verification token is required.');
  }

  // 1. Consume token on backend
  const response = await apiClient.post('/auth/verify-email', { token: token.trim() });

  const verifiedUserFromResponse = formatAuthUser(response?.user);
  const currentToken = getStoredToken();
  let authoritativeUser = null;

  // 2. Authoritative check: If session token exists, fetch authoritative profile from GET /api/auth/me
  if (currentToken) {
    try {
      const meResponse = await apiClient.get('/auth/me');
      if (meResponse?.user) {
        authoritativeUser = formatAuthUser(meResponse.user);
      }
    } catch (meErr) {
      console.warn('Failed to refresh /auth/me after email verification:', meErr);
    }
  }

  const isCurrentSessionUser = Boolean(
    currentToken &&
    authoritativeUser &&
    (authoritativeUser.uid === verifiedUserFromResponse?.uid ||
     authoritativeUser.email === verifiedUserFromResponse?.email)
  );

  // 3. Update application state if this is the active user's session
  if (isCurrentSessionUser && authoritativeUser?.emailVerified) {
    setStoredUser(authoritativeUser);
    notifyAuthStateChanged(authoritativeUser);
    return {
      ...response,
      user: authoritativeUser,
      isAuthenticated: true,
    };
  }

  // 4. Return unauthenticated verification result if user is not logged in in this browser
  return {
    ...response,
    user: verifiedUserFromResponse,
    isAuthenticated: false,
  };
}

/**
 * Refresh current user's profile and verification status from backend
 */
export async function checkEmailVerificationStatus() {
  const verifiedUser = await getCurrentUser();
  if (verifiedUser?.emailVerified) {
    notifyAuthStateChanged(verifiedUser);
  }
  return verifiedUser;
}

/**
 * Friendly error message parser for backend API errors
 */
export function getFriendlyErrorMessage(error) {
  if (!error) return 'An unexpected error occurred. Please try again.';
  if (typeof error === 'string') return error;

  if (error.isNetworkError) {
    return 'Unable to reach the Study Buddy backend server. Please verify your connection.';
  }

  const code = error.code || error.data?.code;
  const msg = error.message || error.data?.message;

  if (code === 'SMTP_AUTH_FAILED') {
    return 'Gmail SMTP authentication failed (535 Invalid credentials). Please check your Google App Password.';
  }

  if (code === 'SMTP_DELIVERY_FAILED' || error.status === 502) {
    return msg || 'Unable to deliver verification email. Please check your SMTP configuration.';
  }

  if (error.status === 429) {
    return msg || 'Too many requests. Please wait a minute before requesting another email.';
  }

  if (error.status === 503 || code === 'SMTP_NOT_CONFIGURED') {
    return msg || 'SMTP email service is not configured on the server. Please contact your administrator.';
  }

  if (msg) return msg;

  if (error.status === 401) {
    return 'Invalid email or password. Please verify your credentials.';
  }
  if (error.status === 409) {
    return 'An account with this email address already exists. Try logging in instead.';
  }
  if (error.status === 404) {
    return 'Requested account was not found.';
  }

  return 'Authentication failed. Please check your credentials.';
}
