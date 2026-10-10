import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  MailCheck,
  Send,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import {
  resendVerification,
  verifyEmailToken,
  checkEmailVerificationStatus,
  logoutUser,
  getFriendlyErrorMessage,
} from '../services/authService';
import { getStoredToken } from '../services/apiClient';

export default function VerificationScreen({ user, onBackToLogin, onVerified }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token');

  // Secret & URL Safety: Store token in component state, then scrub it from the URL bar immediately
  const [pendingToken, setPendingToken] = useState(tokenFromUrl || '');
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(() => {
    return Boolean(getStoredToken() && user);
  });
  const [isSending, setIsSending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  // Track whether verification email was successfully delivered
  const [emailSentSuccessfully, setEmailSentSuccessfully] = useState(
    user?.verificationEmailSent !== false
  );

  // Secret & URL Safety: Remove the token query parameter from the address bar on mount
  // to prevent token leakage via shoulder-surfing, browser history, or Referrer headers.
  useEffect(() => {
    if (tokenFromUrl) {
      setPendingToken(tokenFromUrl);
      try {
        const cleanPath = window.location.pathname;
        window.history.replaceState({}, document.title, cleanPath);
      } catch {
        // Fallback in environments where history.replaceState is restricted
      }
    }
  }, [tokenFromUrl]);

  // Scanner Safety: Require an explicit user click action before sending POST to consume token
  const handleConfirmVerification = async () => {
    if (!pendingToken || isVerifyingToken) return;

    setIsVerifyingToken(true);
    setError('');
    setMessage('');

    try {
      const res = await verifyEmailToken(pendingToken);
      setTokenVerified(true);
      setPendingToken(''); // Clean token from state once consumed

      const authed = Boolean(res.isAuthenticated);
      setIsUserAuthenticated(authed);

      if (authed) {
        setMessage(
          res.message ||
            'Your email address has been verified successfully! You now have full access.'
        );
        if (onVerified) {
          onVerified(res.user);
        }
      } else {
        setMessage(
          'Your email address has been verified successfully! Please log in with your credentials to access your dashboard.'
        );
      }
    } catch (err) {
      console.error('Email token verification failed:', err);
      setError(
        getFriendlyErrorMessage(err) ||
          'This verification link is invalid, expired, or has already been used.'
      );
      setPendingToken(''); // Clear invalid token from state
    } finally {
      setIsVerifyingToken(false);
    }
  };

  const handleResendEmail = async () => {
    if (cooldown > 0 || isSending) return;

    setIsSending(true);
    setMessage('');
    setError('');

    try {
      const res = await resendVerification(user);
      setEmailSentSuccessfully(true);
      setMessage(
        res.message ||
          'Verification email sent! Please check your inbox and spam folder.'
      );

      // Start 60-second cooldown timer
      startCooldownTimer(60);
    } catch (err) {
      console.error('Resend error:', err);
      setEmailSentSuccessfully(false);
      const friendlyMsg = getFriendlyErrorMessage(err);
      setError(friendlyMsg);

      // If backend returned a rate-limit retryAfterSeconds, respect it
      if (err.data?.retryAfterSeconds) {
        startCooldownTimer(err.data.retryAfterSeconds);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleCheckStatus = async () => {
    if (isCheckingStatus) return;
    setIsCheckingStatus(true);
    setError('');
    setMessage('');

    try {
      const refreshedUser = await checkEmailVerificationStatus();
      if (refreshedUser?.emailVerified) {
        setTokenVerified(true);
        setIsUserAuthenticated(true);
        setMessage('Your email is verified! Redirecting to Dashboard...');
        if (onVerified) {
          onVerified(refreshedUser);
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(
          'Email not verified yet. Please check your inbox, click the link, and confirm your account.'
        );
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const startCooldownTimer = (seconds) => {
    setCooldown(seconds);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSignOut = async () => {
    await logoutUser();
    if (onBackToLogin) {
      onBackToLogin();
    } else {
      navigate('/');
    }
  };

  const handleContinueToDashboard = () => {
    navigate('/dashboard');
  };

  const handleGoToLogin = () => {
    if (onBackToLogin) {
      onBackToLogin();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="auth-card verification-card" style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div className="verification-icon-circle">
        {tokenVerified ? (
          <CheckCircle2 size={36} className="verification-icon" style={{ color: 'var(--color-success, #16a34a)' }} />
        ) : pendingToken ? (
          <ShieldCheck size={36} className="verification-icon" style={{ color: 'var(--color-primary, #ea580c)' }} />
        ) : (
          <MailCheck size={36} className="verification-icon" />
        )}
      </div>

      <h2 className="auth-title" style={{ textAlign: 'center' }}>
        {tokenVerified
          ? 'Email Verified! 🎉'
          : pendingToken
          ? 'Confirm Verification 🛡'
          : 'Verify Your Email ✉'}
      </h2>

      {/* When a token was detected from the email link: require explicit user click */}
      {pendingToken && !tokenVerified && (
        <>
          <div className="alert-banner warning" style={{ width: '100%' }}>
            <ShieldCheck size={18} style={{ flexShrink: 0 }} />
            <div>Click the button below to confirm and activate your Study Buddy Roulette account.</div>
          </div>
          <p className="verification-text" style={{ textAlign: 'center', lineHeight: '1.6' }}>
            To protect your account from automated email link scanners, please confirm your verification below.
          </p>
        </>
      )}

      {/* Warning when unverified without a pending token */}
      {!tokenVerified && !pendingToken && (
        <>
          <div className="alert-banner warning" style={{ width: '100%' }}>
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <div>Please verify your university email before accessing study buddy sessions.</div>
          </div>
          {error || !emailSentSuccessfully ? (
            <p className="verification-text error-text" style={{ textAlign: 'center', lineHeight: '1.6', color: 'var(--color-error, #dc2626)' }}>
              Unable to deliver verification email to{' '}
              <strong className="verification-email" style={{ color: 'var(--color-text, #1e293b)' }}>
                {user?.email || 'your email'}
              </strong>
              . Please check SMTP settings or click &ldquo;Resend Verification Email&rdquo; below.
            </p>
          ) : (
            <p className="verification-text" style={{ textAlign: 'center', lineHeight: '1.6' }}>
              We've sent a verification link to{' '}
              <strong className="verification-email" style={{ color: 'var(--color-primary, #ea580c)' }}>
                {user?.email || 'your email'}
              </strong>
              . Click the link in your inbox to unlock your account.
            </p>
          )}
        </>
      )}

      {/* Success banner */}
      {message && (
        <div className="alert-banner success" style={{ width: '100%' }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <div>{message}</div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="alert-banner error" style={{ width: '100%' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>{error}</div>
        </div>
      )}

      {/* Action Buttons */}
      {tokenVerified ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '1rem' }}>
          {isUserAuthenticated ? (
            <button
              type="button"
              className="btn-primary auth-submit-btn"
              onClick={handleContinueToDashboard}
              id="btn-continue-dashboard"
            >
              <Sparkles size={18} /> Continue to Dashboard
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary auth-submit-btn"
              onClick={handleGoToLogin}
              id="btn-login-prompt"
            >
              <ArrowLeft size={18} /> Proceed to Login
            </button>
          )}
        </div>
      ) : pendingToken ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn-primary auth-submit-btn"
            onClick={handleConfirmVerification}
            disabled={isVerifyingToken}
            id="btn-confirm-verification"
          >
            {isVerifyingToken ? (
              <>
                <span className="spinner"></span> Verifying Account...
              </>
            ) : (
              <>
                <CheckCircle2 size={18} /> Confirm & Verify Account
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-secondary auth-back-btn"
            onClick={handleSignOut}
            id="btn-back-to-login"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <ArrowLeft size={18} /> Back to Login
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn-primary auth-submit-btn"
            onClick={handleResendEmail}
            disabled={isSending || cooldown > 0}
            id="btn-resend-verification"
          >
            {isSending ? (
              <>
                <span className="spinner"></span> Sending Email...
              </>
            ) : cooldown > 0 ? (
              `Resend Email in ${cooldown}s`
            ) : (
              <>
                <Send size={18} /> Resend Verification Email
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleCheckStatus}
            disabled={isCheckingStatus}
            id="btn-check-verification-status"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            {isCheckingStatus ? (
              <>
                <span className="spinner"></span> Checking...
              </>
            ) : (
              <>
                <RefreshCw size={16} /> I've Verified — Check Status
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-secondary auth-back-btn"
            onClick={handleSignOut}
            id="btn-back-to-login"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <ArrowLeft size={18} /> Back to Login
          </button>
        </div>
      )}
    </div>
  );
}
