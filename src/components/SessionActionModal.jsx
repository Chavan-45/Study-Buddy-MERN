import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { requestSessionAction } from '../services/sessionService';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export default function SessionActionModal({ session, actionType, currentUser, onClose, onRequestSent }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isCompletion = actionType === 'completion';
  const tutorName = session?.helperName || 'your tutor';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError('');

    setIsSubmitting(true);
    try {
      await requestSessionAction(session.id, actionType, currentUser.uid, session);
      if (onRequestSent) onRequestSent(actionType);
      onClose();
    } catch (err) {
      console.error(`Error requesting ${actionType}:`, err);
      setError(err.message || `Failed to send ${actionType} request.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="rating-popup-overlay">
      <div className="rating-modal-container">
        {/* HEADER */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.1rem 1.4rem',
          borderBottom: '1px solid #f3e8df',
          background: isCompletion ? '#fff7ed' : '#fef2f2'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1c1917', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            {isCompletion ? (
              <>
                <CheckCircle size={20} style={{ color: '#ea580c' }} /> Request Session Completion?
              </>
            ) : (
              <>
                <XCircle size={20} style={{ color: '#dc2626' }} /> Request Session Cancellation?
              </>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#78716c', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleSubmit} style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.9rem', color: '#57534e', lineHeight: 1.5, margin: 0 }}>
            {isCompletion
              ? `This will ask your tutor (${tutorName}) to confirm that the "${session?.subject}" study session has been completed.`
              : `Your tutor (${tutorName}) will need to approve this request before the "${session?.subject}" session is cancelled.`}
          </p>

          <div style={{
            background: isCompletion ? '#fff7ed' : '#fff5f5',
            border: isCompletion ? '1px solid #ffedd5' : '1px solid #fecdd3',
            borderRadius: '0.65rem',
            padding: '0.75rem 0.9rem',
            fontSize: '0.82rem',
            color: isCompletion ? '#c2410c' : '#dc2626',
            fontWeight: 600
          }}>
            ℹ️ Note: The session status will remain <strong>Upcoming</strong> until {tutorName} responds.
          </div>

          {error && (
            <div className="field-error" style={{ fontSize: '0.82rem' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* ACTIONS */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ width: 'auto', padding: '0 1.1rem', height: '40px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={isCompletion ? 'btn-primary' : 'btn-danger'}
              disabled={isSubmitting}
              style={{ width: 'auto', padding: '0 1.25rem', height: '40px' }}
              id={`btn-confirm-${actionType}-req`}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner"></span> Sending...
                </>
              ) : isCompletion ? (
                'Send Request'
              ) : (
                'Send Cancellation Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}
