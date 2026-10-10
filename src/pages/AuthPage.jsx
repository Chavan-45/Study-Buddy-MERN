import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AuthForm from '../components/AuthForm';
import VerificationScreen from '../components/VerificationScreen';

export default function AuthPage({ currentUser, setCurrentUser }) {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const navigate = useNavigate();

  const [viewState, setViewState] = useState(() => {
    if (tokenParam) {
      return 'verification';
    }
    if (currentUser) {
      return currentUser.emailVerified ? 'dashboard' : 'verification';
    }
    return 'auth';
  });

  const [unverifiedUser, setUnverifiedUser] = useState(null);

  // If currentUser is already verified, immediately navigate to dashboard
  useEffect(() => {
    if (currentUser && currentUser.emailVerified && !tokenParam) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, tokenParam, navigate]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.emailVerified) {
      navigate('/dashboard', { replace: true });
    } else {
      setUnverifiedUser(user);
      setViewState('verification');
    }
  };

  const handleRequireVerification = (user) => {
    setUnverifiedUser(user);
    setViewState('verification');
  };

  const handleBackToLogin = () => {
    setUnverifiedUser(null);
    setViewState('auth');
    if (window.location.pathname === '/verify-email') {
      navigate('/', { replace: true });
    }
  };

  const handleVerified = (verifiedUser) => {
    if (verifiedUser) {
      setCurrentUser(verifiedUser);
    }
    if (verifiedUser?.emailVerified) {
      navigate('/dashboard', { replace: true });
    }
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
              onVerified={handleVerified}
            />
          )}
        </div>
      </div>
    </div>
  );
}
