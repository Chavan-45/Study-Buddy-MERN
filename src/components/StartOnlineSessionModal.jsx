import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { startOnlineSession, validateGoogleMeetUrl } from '../services/sessionService';
import { Video, AlertCircle, X, ExternalLink } from 'lucide-react';

export default function StartOnlineSessionModal({ session, currentUser, onClose, onSessionStarted }) {
  const [meetUrl, setMeetUrl] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isStarting) return;
    setError('');

    const trimmed = meetUrl.trim();
    if (!trimmed) {
      setError("Please enter a Google Meet link.");
      return;
    }

    if (!validateGoogleMeetUrl(trimmed)) {
      setError("Please enter a valid Google Meet link (e.g. https://meet.google.com/abc-defg-hij).");
      return;
    }

    setIsStarting(true);
    try {
      await startOnlineSession(session.id, trimmed, currentUser.uid, session);
      if (onSessionStarted) onSessionStarted(trimmed);
      onClose();
    } catch (err) {
      console.error("Error starting online session:", err);
      setError(err.message || "Failed to start online session.");
    } finally {
      setIsStarting(false);
    }
  };

  const modalContent = (
    <div className="rating-popup-overlay" style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(28, 25, 23, 0.5)',
      backdropFilter: 'blur(6px)',
      padding: '1rem'
    }}>
      <div className="rating-modal-container" style={{
        background: '#ffffff',
        border: '1px solid var(--card-border)',
        borderRadius: '1.25rem',
        boxShadow: 'var(--card-shadow)',
        width: '100%',
        maxWidth: '480px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* HEADER */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.1rem 1.4rem',
          borderBottom: '1px solid #f3e8df',
          background: '#fff7ed'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1c1917', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Video size={20} style={{ color: '#ea580c' }} /> Start Online Session
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#78716c', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY FORM */}
        <form onSubmit={handleSubmit} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.88rem', color: '#57534e', lineHeight: 1.45 }}>
            Create a Google Meet in your browser, then paste the meeting link below to start the session.
          </p>

          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '0.65rem',
            padding: '0.75rem 0.9rem',
            fontSize: '0.82rem',
            color: '#047857',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>Need to create a new Meet?</span>
            <a 
              href="https://meet.google.com/new" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ color: '#047857', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'underline' }}
            >
              Open Meet <ExternalLink size={13} />
            </a>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1c1917', marginBottom: '0.4rem', display: 'block' }}>
              Google Meet Link
            </label>
            <input
              type="url"
              value={meetUrl}
              onChange={(e) => {
                setMeetUrl(e.target.value);
                if (error) setError('');
              }}
              placeholder="https://meet.google.com/abc-defg-hij"
              className="themed-input"
              style={{ height: '44px', fontSize: '0.88rem', padding: '0 0.85rem' }}
              autoFocus
              disabled={isStarting}
            />
            {error && (
              <span className="field-error" style={{ marginTop: '0.4rem', fontSize: '0.8rem' }}>
                <AlertCircle size={14} /> {error}
              </span>
            )}
          </div>

          {/* FOOTER ACTIONS */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isStarting}
              style={{ width: 'auto', padding: '0 1.1rem', height: '40px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isStarting || !meetUrl.trim()}
              style={{ width: 'auto', padding: '0 1.25rem', height: '40px' }}
              id="btn-start-meet-submit"
            >
              {isStarting ? (
                <>
                  <span className="spinner"></span> Starting...
                </>
              ) : (
                'Start Meeting'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
