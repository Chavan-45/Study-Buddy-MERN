import React, { useState, useEffect } from 'react';
import { formatTime12Hour } from '../utils/timeUtils';
import { hasUserRatedSession } from '../services/ratingService';
import RatingModal from './RatingModal';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen, 
  Star, 
  Sparkles,
  Check
} from 'lucide-react';

export default function HistoryCard({ session, currentUser }) {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingStatus, setRatingStatus] = useState({ rated: false, ratingVal: 0 });

  const isLearner = session?.learnerId === currentUser?.uid || session?.requesterId === currentUser?.uid;
  const buddyName = isLearner ? session?.helperName : (session?.learnerName || session?.requesterName);
  const roleLabel = isLearner ? 'Learner' : 'Helper';

  const isCompleted = session?.status === 'completed';
  const isCancelled = session?.status === 'cancelled';

  useEffect(() => {
    async function checkReview() {
      if (!isCompleted || !isLearner || !session?.id || !currentUser?.uid) return;
      try {
        const res = await hasUserRatedSession(session.id, currentUser.uid);
        if (res.rated) {
          setRatingStatus({ rated: true, ratingVal: res.review?.rating || 5 });
        }
      } catch (err) {
        console.error("Error checking history review status:", err);
      }
    }
    checkReview();
  }, [isCompleted, isLearner, session, currentUser]);

  const handleRatingSubmitted = (sessionId, ratingVal) => {
    setRatingStatus({ rated: true, ratingVal });
  };

  const renderStars = (count) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          size={14}
          fill={i <= count ? '#f59e0b' : 'transparent'}
          color={i <= count ? '#f59e0b' : '#a8a29e'}
        />
      );
    }
    return stars;
  };

  return (
    <div className={`history-card session-card ${session.status}`}>
      {/* HEADER */}
      <div className="session-card-header">
        <div className="session-title-wrap">
          <div className="candidate-avatar sm">
            {buddyName ? buddyName.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <h3>{session.subject}</h3>
            <span className="session-role-subtitle">
              Studied with: <strong>{buddyName}</strong> • Role: <strong style={{ color: '#ea580c' }}>{roleLabel}</strong>
            </span>
          </div>
        </div>

        <div className="session-badges-wrap">
          {session.matchPercentage && (
            <span className="match-pill-small">
              <Sparkles size={12} /> {session.matchPercentage}% Match
            </span>
          )}

          <span className={`status-badge-pill ${session.status}`}>
            {isCompleted && 'Completed ✅'}
            {isCancelled && 'Cancelled ❌'}
          </span>
        </div>
      </div>

      {/* SESSION DETAILS GRID */}
      <div className="session-info-grid">
        <div className="sess-info-item">
          <Calendar size={16} className="sess-icon" />
          <span>{session.day || 'Monday'}</span>
        </div>

        <div className="sess-info-item">
          <Clock size={16} className="sess-icon" />
          <span>{formatTime12Hour(session.startTime)} – {formatTime12Hour(session.endTime)}</span>
        </div>

        <div className="sess-info-item">
          <MapPin size={16} className="sess-icon" />
          <span>{session.mode}: <strong>{session.location}</strong></span>
        </div>

        <div className="sess-info-item">
          <BookOpen size={16} className="sess-icon" />
          <span>Target Level: <strong>{session.requiredLevel || 'Intermediate'}</strong></span>
        </div>
      </div>

      {/* EXACT MEETING POINT FOR COMPLETED OFFLINE SESSIONS */}
      {isCompleted && session.meetingPoint && (
        <div style={{
          background: '#fff7ed',
          border: '1px solid #ffedd5',
          borderRadius: '0.65rem',
          padding: '0.6rem 0.85rem',
          marginTop: '0.35rem',
          fontSize: '0.85rem',
          color: '#b45309'
        }}>
          📍 Meeting Point: <strong>{session.meetingPoint}</strong>
        </div>
      )}

      {/* RATING DISPLAY / ACTION */}
      {isCompleted && (
        <div className="history-card-footer" style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f3e8df', paddingTop: '0.75rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#57534e' }}>
            Status: <strong style={{ color: '#059669' }}>Session Completed</strong>
          </div>

          {isLearner && (
            <div>
              {ratingStatus.rated ? (
                <div className="rated-badge-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="rated-check" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Check size={14} /> Rated {ratingStatus.ratingVal}/5
                  </span>
                  <div className="stars-row">{renderStars(ratingStatus.ratingVal)}</div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-primary btn-rate-buddy"
                  onClick={() => setShowRatingModal(true)}
                  style={{ height: '36px', fontSize: '0.82rem', padding: '0 0.85rem' }}
                >
                  <Star size={14} fill="#ffffff" /> ⭐ Rate Buddy
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* RATING MODAL DIALOG */}
      {showRatingModal && (
        <RatingModal
          session={session}
          currentUser={currentUser}
          onClose={() => setShowRatingModal(false)}
          onRatingSubmitted={handleRatingSubmitted}
        />
      )}
    </div>
  );
}
