import React, { useState } from 'react';
import AuthForm from '../components/AuthForm';
import VerificationScreen from '../components/VerificationScreen';

export default function AuthPage({ currentUser, setCurrentUser }) {
  const [viewState, setViewState] = useState(() => {
    if (currentUser) {
      return currentUser.emailVerified ? 'dashboard' : 'verification';
    }
    return 'auth';
  });

  const [unverifiedUser, setUnverifiedUser] = useState(null);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setViewState('dashboard');
  };

  const handleRequireVerification = (user) => {
    setUnverifiedUser(user);
    setViewState('verification');
  };

  const handleBackToLogin = () => {
    setUnverifiedUser(null);
    setCurrentUser(null);
    setViewState('auth');
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        {/* LEFT COLUMN: BRANDING & INTRO */}
        <div className="auth-brand">
          <div className="brand-logo-badge">🎲</div>
          <h1 className="brand-title">Study Buddy Roulette</h1>
          <p className="brand-tagline">Find. Connect. Learn Together.</p>
          <p className="brand-description">
            Connect with students who can help you learn based on skills, availability, and study preferences.
          </p>
          
          <div className="brand-features">
            <div className="feature-pill">✓ Smart Study Buddy Matching</div>
            <div className="feature-pill">✓ Online & Offline Sessions</div>
            <div className="feature-pill">✓ Real-Time Chat</div>
          </div>
        </div>

        {/* RIGHT COLUMN: AUTH CARD */}
        <div className="auth-card-container">
          {viewState === 'auth' && (
            <AuthForm
              onLoginSuccess={handleLoginSuccess}
              onRequireVerification={handleRequireVerification}
            />
          )}

          {viewState === 'verification' && (
            <VerificationScreen
              user={unverifiedUser || currentUser}
              onBackToLogin={handleBackToLogin}
            />
          )}
        </div>
      </div>
    </div>
  );
}
