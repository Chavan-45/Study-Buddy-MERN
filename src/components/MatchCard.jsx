import React, { useState, useEffect } from 'react';
import MatchBreakdown from './MatchBreakdown';
import { 
  sendStudyRequest, 
  checkExistingRequest 
} from '../services/requestService';
import { formatTime12Hour } from '../utils/timeUtils';
import { 
  Sparkles, 
  Send, 
  RefreshCw, 
  User, 
  X, 
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Star
} from 'lucide-react';

export default function MatchCard({
  matchResult,
  currentUser,
  searchCriteria,
  onTryAnother,
  hasMultipleMatches = false
}) {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const candidate = matchResult?.candidate;
  const matchScore = matchResult?.matchScore;
  const breakdown = matchResult?.breakdown;

  // Check if a request is already pending for this candidate
  useEffect(() => {
    async function checkPendingStatus() {
      if (!currentUser?.uid || !candidate?.uid) return;
      try {
        const subjectToMatch = searchCriteria?.subject || breakdown?.matchedSkill?.subject || candidate?.canHelp?.[0]?.subject || 'Study Session';
        const dayToMatch = searchCriteria?.day || breakdown?.matchedAvailability?.day || candidate?.availability?.[0]?.day || 'Monday';

        const existing = await checkExistingRequest(
          currentUser.uid,
          candidate.uid,
          subjectToMatch,
          dayToMatch
        );
        if (existing) {
          setIsPending(true);
        } else {
          setIsPending(false);
        }
      } catch (err) {
        console.error("Error checking request status:", err);
      }
    }
    checkPendingStatus();
  }, [currentUser, candidate, searchCriteria, breakdown]);

  if (!matchResult || !candidate) return null;

  const matchedSkillName = searchCriteria?.subject || breakdown?.matchedSkill?.subject || candidate?.canHelp?.[0]?.subject || 'General Skills';
  const matchedSkillLevel = searchCriteria?.requiredLevel || breakdown?.matchedSkill?.level || candidate?.canHelp?.[0]?.level || 'Intermediate';

  const matchedSlot = breakdown?.matchedAvailability || candidate?.availability?.[0] || { day: 'Monday', startTime: '16:00', endTime: '18:00' };
  const availabilityText = `${matchedSlot.day || 'Monday'} • ${formatTime12Hour(matchedSlot.startTime || '16:00')} – ${formatTime12Hour(matchedSlot.endTime || '18:00')}`;

  const ratingCount = Number(candidate?.ratingCount || 0);
  const averageRating = candidate?.averageRating ? Number(candidate.averageRating).toFixed(1) : null;

  const handleSendRequest = async () => {
    if (isSending || isPending) return;

    setIsSending(true);
    setFeedback(null);

    try {
      const requesterName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Student A';
      
      await sendStudyRequest({
        requesterId: currentUser.uid,
        requesterName: requesterName,
        helperId: candidate.uid,
        helperName: candidate.name || 'Student B',
        subject: matchedSkillName,
        requiredLevel: matchedSkillLevel,
        day: searchCriteria?.day || matchedSlot.day || 'Monday',
        startTime: searchCriteria?.startTime || matchedSlot.startTime || '16:00',
        endTime: searchCriteria?.endTime || matchedSlot.endTime || '18:00',
        mode: searchCriteria?.mode || candidate.mode || 'Both',
        location: (searchCriteria?.mode === 'Online') ? 'Online' : (searchCriteria?.location || candidate.location || 'College Library'),
        matchPercentage: matchScore
      });

      setFeedback({ type: 'success', text: 'Study request sent successfully!' });
      setIsPending(true);
    } catch (err) {
      console.error("Send request error:", err);
      if (err.code === 'request-already-sent') {
        setIsPending(true);
        setFeedback({ type: 'error', text: 'Request already sent to this buddy.' });
      } else {
        setFeedback({ type: 'error', text: err.message || 'Failed to send study request.' });
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="best-match-card">
      {/* BEST MATCH HEADER WITH PILL BADGE */}
      <div className="best-match-card-header">
        <div className="best-match-title">
          <Sparkles size={18} className="sparkle-icon" /> 🎉 BEST MATCH
        </div>
        <div className="best-match-score">
          {matchScore}% Match
        </div>
      </div>

      {/* STUDENT IDENTITY WITH RATING */}
      <div className="best-match-identity-row">
        <div className="candidate-avatar">
          {candidate.name ? candidate.name.charAt(0).toUpperCase() : 'S'}
        </div>
        <div className="identity-details">
          <h3 className="candidate-name">{candidate.name}</h3>
          <div className="candidate-dept">
            {candidate.department || 'CSE'} • {candidate.year || '3rd Year'}
          </div>
          <div className="candidate-rating-badge">
            <Star size={14} fill="#f59e0b" color="#f59e0b" />
            {ratingCount > 0 ? (
              <span>{averageRating} ({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})</span>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>New</span>
            )}
          </div>
        </div>
      </div>

      {/* SUCCESS / ERROR ALERT */}
      {feedback && (
        <div className={`best-match-success-alert ${feedback.type}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <div>{feedback.text}</div>
        </div>
      )}

      {/* INNER INFORMATION PANEL */}
      <div className="best-match-info-panel">
        <div className="best-match-meta-grid">
          <div className="meta-item">
            <span className="meta-label">CAN HELP WITH</span>
            <span className="meta-value">{matchedSkillName} — <strong>{matchedSkillLevel}</strong></span>
          </div>

          <div className="meta-item">
            <span className="meta-label">AVAILABILITY</span>
            <span className="meta-value">{availabilityText}</span>
          </div>

          <div className="meta-item">
            <span className="meta-label">MODE</span>
            <span className="meta-value">{candidate.mode || 'Both'}</span>
          </div>

          <div className="meta-item">
            <span className="meta-label">LOCATION</span>
            <span className="meta-value">{candidate.location || 'College Library'}</span>
          </div>
        </div>
      </div>

      {/* MATCH BREAKDOWN */}
      <MatchBreakdown breakdown={breakdown} />

      {/* ACTION BUTTONS (Side-by-Side) */}
      <div className="best-match-actions">
        <button
          type="button"
          className="btn-secondary btn-action-half"
          onClick={() => setShowProfileModal(true)}
          id="btn-view-match-profile"
        >
          <User size={16} /> View Profile
        </button>

        <button
          type="button"
          className={`btn-primary btn-action-half ${isPending ? 'btn-pending-state' : ''}`}
          onClick={handleSendRequest}
          disabled={isSending || isPending}
          id="btn-send-study-request"
        >
          {isSending ? (
            <>
              <span className="spinner"></span> Sending...
            </>
          ) : isPending ? (
            <>
              <Clock3 size={16} /> Request Pending
            </>
          ) : (
            <>
              <Send size={16} /> Send Study Request
            </>
          )}
        </button>

        {hasMultipleMatches && (
          <button
            type="button"
            className="btn-secondary btn-try-another"
            onClick={onTryAnother}
            id="btn-try-another-match"
          >
            <RefreshCw size={16} /> 🎲 Try Another Match
          </button>
        )}
      </div>

      {/* REDESIGNED SCOPED BUDDY PROFILE PREVIEW CARD MODAL */}
      {showProfileModal && (
        <div className="find-buddy-modal-backdrop" onClick={() => setShowProfileModal(false)}>
          <div className="buddy-profile-preview" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="btn-close-modal"
              onClick={() => setShowProfileModal(false)}
              aria-label="Close profile"
            >
              <X size={18} />
            </button>

            {/* HEADER */}
            <div className="buddy-profile-header">
              <div className="buddy-profile-avatar">
                {candidate.name ? candidate.name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div className="buddy-header-details">
                <h2>{candidate.name}</h2>
                <span className="buddy-subtitle">{candidate.department || 'CSE'} • {candidate.year || '3rd Year'}</span>
                <div className="buddy-rating-badge">
                  <Star size={15} fill="#f59e0b" color="#f59e0b" />
                  {ratingCount > 0 ? (
                    <span>{averageRating} ({ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'})</span>
                  ) : (
                    <span className="rating-new">New Student</span>
                  )}
                </div>
              </div>
            </div>

            <hr className="profile-divider" />

            {/* BIO */}
            {candidate.bio && (
              <div className="buddy-profile-section">
                <p className="buddy-modal-bio">"{candidate.bio}"</p>
              </div>
            )}

            {/* CAN HELP WITH */}
            <div className="buddy-profile-section">
              <span className="section-label">CAN HELP WITH</span>
              <div className="buddy-chips-wrap">
                {Array.isArray(candidate.canHelp) && candidate.canHelp.length > 0 ? (
                  candidate.canHelp.map((sk, idx) => (
                    <span key={idx} className="buddy-skill-chip">
                      {sk.subject} • <strong>{sk.level}</strong>
                    </span>
                  ))
                ) : (
                  <span className="chip-none">No skills added</span>
                )}
              </div>
            </div>

            {/* AVAILABILITY */}
            <div className="buddy-profile-section">
              <span className="section-label">AVAILABILITY</span>
              <div className="buddy-chips-wrap">
                {Array.isArray(candidate.availability) && candidate.availability.length > 0 ? (
                  candidate.availability.map((av, idx) => (
                    <span key={idx} className="buddy-availability-chip">
                      {av.day} • {formatTime12Hour(av.startTime)} – {formatTime12Hour(av.endTime)}
                    </span>
                  ))
                ) : (
                  <span className="chip-none">No availability slots set</span>
                )}
              </div>
            </div>

            {/* MODE & LOCATION */}
            <div className="buddy-profile-section">
              <div className="mode-location-grid">
                <div className="meta-col">
                  <span className="section-label">MODE</span>
                  <strong className="meta-val">{candidate.mode || 'Both'}</strong>
                </div>
                <div className="meta-col">
                  <span className="section-label">LOCATION</span>
                  <strong className="meta-val">{candidate.location || 'College Library'}</strong>
                </div>
              </div>
            </div>

            {/* PRIVACY NOTICE */}
            <div className="buddy-privacy-notice">
              <ShieldCheck size={18} className="shield-icon" />
              <span>Contact details are shared only after the study request is accepted.</span>
            </div>

            {/* CLOSE ACTION */}
            <button
              type="button"
              className="btn-secondary btn-close-profile-bottom"
              onClick={() => setShowProfileModal(false)}
            >
              Close Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
