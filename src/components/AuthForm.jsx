import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2,
  KeyRound,
  ArrowLeft
} from 'lucide-react';
import { 
  registerUser, 
  loginUser, 
  resetUserPassword,
  createFirestoreDocIfVerified,
  getFriendlyErrorMessage 
} from '../services/authService';

export default function AuthForm({ onLoginSuccess, onRequireVerification: _onRequireVerification }) {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Registration Form State
  const [regData, setRegData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  // Login Form State
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  // Validation Errors
  const [regErrors, setRegErrors] = useState({});
  const [loginErrors, setLoginErrors] = useState({});
  const [resetError, setResetError] = useState('');

  // Password Visibility Toggles
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Global Request States
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [globalSuccess, setGlobalSuccess] = useState('');

  // Switch tabs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setIsForgotPassword(false);
    setGlobalError('');
    setGlobalSuccess('');
    setRegErrors({});
    setLoginErrors({});
    setResetError('');
  };

  const handleRegChange = (e) => {
    const { name, value } = e.target;
    setRegData(prev => ({ ...prev, [name]: value }));
    if (regErrors[name]) {
      setRegErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData(prev => ({ ...prev, [name]: value }));
    if (loginErrors[name]) {
      setLoginErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateRegister = () => {
    const errors = {};
    if (!regData.name.trim()) errors.name = "Full Name cannot be empty.";

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regData.email.trim()) {
      errors.email = "Email cannot be empty.";
    } else if (!emailRegex.test(regData.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    const phoneClean = regData.phone.replace(/[\s\-\(\)\+]/g, '');
    if (!regData.phone.trim()) {
      errors.phone = "Phone number cannot be empty.";
    } else if (phoneClean.length < 7 || !/^\d+$/.test(phoneClean)) {
      errors.phone = "Please enter a valid phone number (at least 7 digits).";
    }

    if (!regData.password) {
      errors.password = "Password cannot be empty.";
    } else if (regData.password.length < 8) {
      errors.password = "Password should have at least 8 characters.";
    }

    if (!regData.confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (regData.password !== regData.confirmPassword) {
      errors.confirmPassword = "Confirm Password must match Password.";
    }

    setRegErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateLogin = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!loginData.email.trim()) {
      errors.email = "Email is required.";
    } else if (!emailRegex.test(loginData.email.trim())) {
      errors.email = "Please enter a valid email address.";
    }

    if (!loginData.password) {
      errors.password = "Password is required.";
    }

    setLoginErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');
    setGlobalSuccess('');

    if (!validateRegister()) return;

    setIsLoading(true);

    try {
      const regRes = await registerUser({
        name: regData.name.trim(),
        email: regData.email.trim(),
        phone: regData.phone.trim(),
        password: regData.password
      });

      setGlobalSuccess(
        "Account created successfully! Welcome to Study Buddy Roulette."
      );

      setRegData({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
      });

      if (regRes?.user && onLoginSuccess) {
        onLoginSuccess(regRes.user);
      } else {
        setActiveTab('login');
      }
    } catch (err) {
      console.error("Registration error:", err);
      setGlobalError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');
    setGlobalSuccess('');

    if (!validateLogin()) return;

    setIsLoading(true);

    try {
      const user = await loginUser(loginData.email.trim(), loginData.password);
      await createFirestoreDocIfVerified(user);
      onLoginSuccess(user);
    } catch (err) {
      console.error("Login error:", err);
      setGlobalError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password Submit
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setGlobalError('');
    setGlobalSuccess('');
    setResetError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!resetEmail.trim()) {
      setResetError("Please enter your email address.");
      return;
    }
    if (!emailRegex.test(resetEmail.trim())) {
      setResetError("Please enter a valid email address.");
      return;
    }

    setIsLoading(true);

    try {
      await resetUserPassword(resetEmail.trim());
      setGlobalSuccess("Password reset email sent. Check your inbox.");
      setIsForgotPassword(false);
    } catch (err) {
      console.error("Password reset error:", err);
      setGlobalError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card">
      {/* SEGMENTED TAB SWITCHER */}
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab ${activeTab === 'login' && !isForgotPassword ? 'active' : ''}`}
          onClick={() => handleTabChange('login')}
          id="tab-login"
        >
          Login
        </button>
        <button
          type="button"
          className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
          onClick={() => handleTabChange('register')}
          id="tab-register"
        >
          Register
        </button>
      </div>

      {/* GLOBAL ALERTS */}
      {globalError && (
        <div className="alert-banner error" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>{globalError}</div>
        </div>
      )}

      {globalSuccess && (
        <div className="alert-banner success" style={{ marginBottom: '1.25rem' }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <div>{globalSuccess}</div>
        </div>
      )}

      {/* FORGOT PASSWORD FORM */}
      {isForgotPassword && (
        <form onSubmit={handleForgotPasswordSubmit} className="auth-form" noValidate>
          <div className="auth-form-header">
            <KeyRound size={32} className="auth-header-icon" />
            <h2 className="auth-title">Reset Your Password</h2>
            <p className="auth-subtitle">
              Enter your registered email address to receive a password reset link.
            </p>
          </div>

          <div className="auth-field">
            <label htmlFor="reset-email">Registered Email</label>
            <div className={`auth-input-wrapper ${resetError ? 'has-error' : ''}`}>
              <Mail className="auth-input-icon" size={18} />
              <input
                id="reset-email"
                type="email"
                placeholder="student@university.edu"
                value={resetEmail}
                onChange={(e) => {
                  setResetEmail(e.target.value);
                  if (resetError) setResetError('');
                }}
                disabled={isLoading}
                className="auth-input"
                autoFocus
              />
            </div>
            {resetError && (
              <span className="field-error">
                <AlertCircle size={14} /> {resetError}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={isLoading}
            id="btn-reset-password-submit"
          >
            {isLoading ? (
              <>
                <span className="spinner"></span> Sending Email...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>

          <button
            type="button"
            className="btn-secondary auth-back-btn"
            onClick={() => setIsForgotPassword(false)}
          >
            <ArrowLeft size={16} /> Back to Login
          </button>
        </form>
      )}

      {/* LOGIN FORM */}
      {activeTab === 'login' && !isForgotPassword && (
        <form onSubmit={handleLoginSubmit} className="auth-form" noValidate>
          <div className="auth-form-header">
            <h2 className="auth-title">Welcome Back</h2>
            <p className="auth-subtitle">Sign in to continue finding your Study Buddy.</p>
          </div>

          {/* EMAIL FIELD */}
          <div className="auth-field">
            <label htmlFor="login-email">Email</label>
            <div className={`auth-input-wrapper ${loginErrors.email ? 'has-error' : ''}`}>
              <Mail className="auth-input-icon" size={18} />
              <input
                id="login-email"
                type="email"
                name="email"
                placeholder="student@university.edu"
                value={loginData.email}
                onChange={handleLoginChange}
                disabled={isLoading}
                className="auth-input"
              />
            </div>
            {loginErrors.email && (
              <span className="field-error">
                <AlertCircle size={14} /> {loginErrors.email}
              </span>
            )}
          </div>

          {/* PASSWORD FIELD WITH FORGOT LINK RIGHT ALIGNED ON LABEL ROW */}
          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                className="forgot-password-link"
                onClick={() => {
                  setResetEmail(loginData.email);
                  setIsForgotPassword(true);
                  setGlobalError('');
                  setGlobalSuccess('');
                }}
              >
                Forgot Password?
              </button>
            </div>

            <div className={`auth-input-wrapper ${loginErrors.password ? 'has-error' : ''}`}>
              <Lock className="auth-input-icon" size={18} />
              <input
                id="login-password"
                type={showLoginPassword ? "text" : "password"}
                name="password"
                placeholder="••••••••"
                value={loginData.password}
                onChange={handleLoginChange}
                disabled={isLoading}
                className="auth-input"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowLoginPassword(!showLoginPassword)}
                aria-label={showLoginPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {loginErrors.password && (
              <span className="field-error">
                <AlertCircle size={14} /> {loginErrors.password}
              </span>
            )}
          </div>

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={isLoading}
            id="btn-login-submit"
          >
            {isLoading ? (
              <>
                <span className="spinner"></span> Signing in...
              </>
            ) : (
              'Login'
            )}
          </button>

          {/* FOOTER PROMPT */}
          <div className="auth-footer-prompt">
            Don't have an account?{' '}
            <button
              type="button"
              className="auth-switch-link"
              onClick={() => handleTabChange('register')}
            >
              Register
            </button>
          </div>
        </form>
      )}

      {/* REGISTER FORM */}
      {activeTab === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="auth-form" noValidate>
          <div className="auth-form-header">
            <h2 className="auth-title">Create Your Account</h2>
            <p className="auth-subtitle">Join Study Buddy Roulette and start learning together.</p>
          </div>

          {/* FULL NAME */}
          <div className="auth-field">
            <label htmlFor="reg-name">Full Name</label>
            <div className={`auth-input-wrapper ${regErrors.name ? 'has-error' : ''}`}>
              <User className="auth-input-icon" size={18} />
              <input
                id="reg-name"
                type="text"
                name="name"
                placeholder="Alex Morgan"
                value={regData.name}
                onChange={handleRegChange}
                disabled={isLoading}
                className="auth-input"
              />
            </div>
            {regErrors.name && (
              <span className="field-error">
                <AlertCircle size={14} /> {regErrors.name}
              </span>
            )}
          </div>

          {/* EMAIL */}
          <div className="auth-field">
            <label htmlFor="reg-email">Email</label>
            <div className={`auth-input-wrapper ${regErrors.email ? 'has-error' : ''}`}>
              <Mail className="auth-input-icon" size={18} />
              <input
                id="reg-email"
                type="email"
                name="email"
                placeholder="alex@university.edu"
                value={regData.email}
                onChange={handleRegChange}
                disabled={isLoading}
                className="auth-input"
              />
            </div>
            {regErrors.email && (
              <span className="field-error">
                <AlertCircle size={14} /> {regErrors.email}
              </span>
            )}
          </div>

          {/* PHONE */}
          <div className="auth-field">
            <label htmlFor="reg-phone">Phone Number</label>
            <div className={`auth-input-wrapper ${regErrors.phone ? 'has-error' : ''}`}>
              <Phone className="auth-input-icon" size={18} />
              <input
                id="reg-phone"
                type="tel"
                name="phone"
                placeholder="9876543210"
                value={regData.phone}
                onChange={handleRegChange}
                disabled={isLoading}
                className="auth-input"
              />
            </div>
            {regErrors.phone && (
              <span className="field-error">
                <AlertCircle size={14} /> {regErrors.phone}
              </span>
            )}
          </div>

          {/* PASSWORD */}
          <div className="auth-field">
            <label htmlFor="reg-password">Password</label>
            <div className={`auth-input-wrapper ${regErrors.password ? 'has-error' : ''}`}>
              <Lock className="auth-input-icon" size={18} />
              <input
                id="reg-password"
                type={showRegPassword ? "text" : "password"}
                name="password"
                placeholder="At least 6 characters"
                value={regData.password}
                onChange={handleRegChange}
                disabled={isLoading}
                className="auth-input"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowRegPassword(!showRegPassword)}
                aria-label={showRegPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {regErrors.password && (
              <span className="field-error">
                <AlertCircle size={14} /> {regErrors.password}
              </span>
            )}
          </div>

          {/* CONFIRM PASSWORD */}
          <div className="auth-field">
            <label htmlFor="reg-confirm-password">Confirm Password</label>
            <div className={`auth-input-wrapper ${regErrors.confirmPassword ? 'has-error' : ''}`}>
              <Lock className="auth-input-icon" size={18} />
              <input
                id="reg-confirm-password"
                type={showRegConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Re-enter your password"
                value={regData.confirmPassword}
                onChange={handleRegChange}
                disabled={isLoading}
                className="auth-input"
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                aria-label={showRegConfirmPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showRegConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {regErrors.confirmPassword && (
              <span className="field-error">
                <AlertCircle size={14} /> {regErrors.confirmPassword}
              </span>
            )}
          </div>

          {/* CREATE ACCOUNT BUTTON */}
          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={isLoading}
            id="btn-register-submit"
          >
            {isLoading ? (
              <>
                <span className="spinner"></span> Creating Account...
              </>
            ) : (
              'Create Account'
            )}
          </button>

          {/* FOOTER PROMPT */}
          <div className="auth-footer-prompt">
            Already have an account?{' '}
            <button
              type="button"
              className="auth-switch-link"
              onClick={() => handleTabChange('login')}
            >
              Login
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
