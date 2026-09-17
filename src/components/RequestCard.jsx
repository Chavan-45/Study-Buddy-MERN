import React, { useState } from 'react';
import { formatTime12Hour } from '../utils/timeUtils';
import { 
  Check, 
  X, 
  Sparkles,
  CheckCircle2
} from 'lucide-react';

export default function RequestCard({
  request,
  type = 'incoming', // 'incoming' | 'sent'
  onAccept,
  onReject
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!request) return null;

  const handleAccept = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onAccept(request.id, request);
    } catch (err) {
      console.error("Accept request error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await onReject(request.id);
    } catch (err) {
      console.error("Reject request error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const status = request.status || 'pending';
  const isIncoming = type === 'incoming';

  const userName = isIncoming ? request.requesterName : request.helperName;
  const roleSubtitle = isIncoming ? 'Study Request from Learner' : 'Sent to Helper';

  return (
    <div className={`request-card ${status}`}>
      {/* CARD HEADER */}
      <div className="request-card-header">
        <div className="request-user-info">
          <div className="request-avatar">
            {userName ? userName.charAt(0).toUpperCase() : (isIncoming ? 'S' : 'H')}
          </div>
          <div className="request-name-details">
            <h3 className="request-user-name">{userName}</h3>
            <span className="request-role-subtitle">{roleSubtitle}</span>
          </div>
        </div>

        {/* BADGES */}
        <div className="request-badges">
          {request.matchPercentage && (
            <span className="request-match-pill">
              <Sparkles size={12} /> {request.matchPercentage}% Match
            </span>
          )}

          <span className={`status-badge-pill ${status}`}>
            {status === 'pending' && 'Pending'}
            {status === 'accepted' && 'Accepted'}
            {status === 'rejected' && 'Rejected'}
            {status === 'cancelled' && 'Cancelled'}
          </span>
        </div>
      </div>

      <hr className="request-card-divider" />

      {/* REQUEST DETAILS GRID */}
      <div className="request-details-grid">
        <div className="request-detail-item">
          <span className="request-detail-label">SUBJECT</span>
          <strong className="request-detail-value">{request.subject}</strong>
        </div>

        <div className="request-detail-item">
          <span className="request-detail-label">LEVEL</span>
          <strong className="request-detail-value">{request.requiredLevel || 'Intermediate'}</strong>
        </div>

        <div className="request-detail-item">
          <span className="request-detail-label">SCHEDULE</span>
          <strong className="request-detail-value">
            {request.day} • {formatTime12Hour(request.startTime)} – {formatTime12Hour(request.endTime)}
          </strong>
        </div>

        <div className="request-detail-item">
          <span className="request-detail-label">MODE & LOCATION</span>
          <strong className="request-detail-value">
            {request.mode} {request.location && request.mode !== 'Online' ? `• ${request.location}` : ''}
          </strong>
        </div>
      </div>

      {/* ACCEPTED NOTE */}
      {status === 'accepted' && (
        <div className="request-accepted-note">
          <CheckCircle2 size={16} />
          <span>This request has been accepted. The session is available in Sessions.</span>
        </div>
      )}

      {/* ACTION BUTTONS FOR INCOMING PENDING REQUESTS */}
      {isIncoming && status === 'pending' && (
        <div className="request-actions">
          <button
            type="button"
            className="btn-danger btn-reject-req"
            onClick={handleReject}
            disabled={isProcessing}
            id={`btn-reject-request-${request.id}`}
          >
            <X size={16} /> Reject
          </button>

          <button
            type="button"
            className="btn-primary btn-accept-req"
            onClick={handleAccept}
            disabled={isProcessing}
            id={`btn-accept-request-${request.id}`}
          >
            {isProcessing ? (
              <>
                <span className="spinner"></span> Accepting...
              </>
            ) : (
              <>
                <Check size={16} /> Accept Request
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
