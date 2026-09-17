import React, { useState } from 'react';
import { MailCheck, Send, ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { resendVerification, logoutUser, getFriendlyErrorMessage } from '../firebase';

export default function VerificationScreen({ user, onBackToLogin }) {
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const handleResendEmail = async () => {
    if (cooldown > 0) return;
    
    setIsSending(true);
    setMessage('');
    setError('');

    try {
      await resendVerification(user);
      setMessage("Verification email sent! Please check your inbox and spam folder.");
      
      setCooldown(30);
      const timer = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Resend error:", err);
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  const handleSignOut = async () => {
    await logoutUser();
    onBackToLogin();
  };

  return (
    <div className="auth-card verification-card">
      <div className="verification-icon-circle">
        <MailCheck size={36} className="verification-icon" />
      </div>

      <h2 className="auth-title" style={{ textAlign: 'center' }}>Check Your Email ✉</h2>

      <div className="alert-banner warning" style={{ width: '100%' }}>
        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
        <div>Please verify your email before continuing.</div>
      </div>

      <p className="verification-text">
        We've sent a verification link to{' '}
        <strong className="verification-email">{user?.email || 'your email'}</strong>. 
        Click the link in the email to activate your account and unlock Study Buddy Roulette.
      </p>

      {message && (
        <div className="alert-banner success" style={{ width: '100%' }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <div>{message}</div>
        </div>
      )}

      {error && (
        <div className="alert-banner error" style={{ width: '100%' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>{error}</div>
        </div>
      )}

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
        className="btn-secondary auth-back-btn"
        onClick={handleSignOut}
        id="btn-back-to-login"
      >
        <ArrowLeft size={18} /> Back to Login
      </button>
    </div>
  );
}
