import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatTime12Hour } from '../utils/timeUtils';
import { hasUserRatedSession } from '../services/ratingService';
import { 
  updateSessionMeetingPoint, 
  endOnlineSession,
  respondToSessionActionRequest
} from '../services/sessionService';
import { getUserProfile } from '../services/userService';
import RatingModal from './RatingModal';
import StartOnlineSessionModal from './StartOnlineSessionModal';
import SessionActionModal from './SessionActionModal';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  Star, 
  Sparkles,
  Phone,
  Mail,
  User,
  Check,
  ShieldCheck,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Video,
  VideoOff,
  ExternalLink,
  Edit2
} from 'lucide-react';

const normalizeMode = (m) => String(m || '').trim().toLowerCase();

const supportsOnline = (m) => {
  const norm = normalizeMode(m);
  return norm === 'online' || norm === 'both';
};

const supportsOffline = (m) => {
  const norm = normalizeMode(m);
  return norm === 'offline' || norm === 'both';
};

export default function SessionCard({
  session,
  currentUser,
  onComplete,
  onCancel
}) {
  const navigate = useNavigate();

  const [isUpdating, setIsUpdating] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [actionModalType, setActionModalType] = useState(null); // 'completion' | 'cancellation' | null
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [isRespondingReq, setIsRespondingReq] = useState(false);

  const [ratingStatus, setRatingStatus] = useState({ rated: false, ratingVal: 0 });
  const [meetingPointInput, setMeetingPointInput] = useState(session?.meetingPoint || '');
  const [isEditingMeetingPoint, setIsEditingMeetingPoint] = useState(false);
  const [isSavingPoint, setIsSavingPoint] = useState(false);
  const [pointError, setPointError] = useState('');

  const [fetchedBuddy, setFetchedBuddy] = useState(null);

  const isLearner = session?.learnerId === currentUser?.uid || session?.requesterId === currentUser?.uid;
  const isHelper = session?.helperId === currentUser?.uid;
  const isParticipant = isLearner || isHelper;

  const isCompleted = session?.status === 'completed';
  const isCancelled = session?.status === 'cancelled';
  const isUpcoming = session?.status === 'upcoming';

  const [showContactDetails, setShowContactDetails] = useState(!isCompleted);

  const isOnlineSupported = supportsOnline(session?.mode);
  const isOfflineSupported = supportsOffline(session?.mode);

  const onlineStatus = session?.onlineSessionStatus || 'not_started';
  const isLive = onlineStatus === 'live';
  const isEnded = onlineStatus === 'ended';

  const actionReq = session?.sessionActionRequest;
  const isPendingActionReq = actionReq?.status === 'pending';

  const buddyId = isLearner ? session?.helperId : session?.learnerId;
  const roleLabel = isLearner ? 'Learner' : 'Helper';
  const buddyRoleTitle = isLearner ? 'Helper' : 'Learner';

  // Fetch the OTHER participant's Firestore profile to get exact name, email, phone & privacy settings
  useEffect(() => {
    async function fetchBuddyData() {
      if (!buddyId) return;
      try {
        const data = await getUserProfile(buddyId);
        if (data) {
          setFetchedBuddy(data);
        }
      } catch (err) {
        console.error("Error fetching buddy profile for session:", err);
      }
    }
    fetchBuddyData();
  }, [buddyId]);

  const otherUserName = fetchedBuddy?.name || (isLearner ? session?.helperName : (session?.learnerName || session?.requesterName)) || 'Study Buddy';
  const buddyEmail = fetchedBuddy?.email || (isLearner ? session?.helperEmail : session?.learnerEmail) || '';
  const buddyPhone = fetchedBuddy?.phone ?? fetchedBuddy?.phoneNumber ?? fetchedBuddy?.mobileNumber ?? (isLearner ? session?.helperPhone : session?.learnerPhone) ?? '';
  const isPhoneHidden = fetchedBuddy?.sharePhoneAfterAcceptance === false;

  const canViewContact = isParticipant && (isUpcoming || isCompleted);

  useEffect(() => {
    async function checkReview() {
      if (!isCompleted || !isLearner || !session?.id || !currentUser?.uid) return;
      try {
        const res = await hasUserRatedSession(session.id, currentUser.uid);
        if (res.rated) {
          setRatingStatus({ rated: true, ratingVal: res.review?.rating || 5 });
        }
      } catch (err) {
        console.error("Error checking review status:", err);
      }
    }
    checkReview();
  }, [isCompleted, isLearner, session, currentUser]);

  const handleRatingSubmitted = (sessionId, ratingVal) => {
    setRatingStatus({ rated: true, ratingVal });
  };

  const handleComplete = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      if (onComplete) await onComplete(session.id);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (isUpdating) return;
    if (!window.confirm("Are you sure you want to cancel this study session?")) return;
    setIsUpdating(true);
    try {
      if (onCancel) await onCancel(session.id);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRespondActionRequest = async (isApproved) => {
    if (isRespondingReq) return;
    setIsRespondingReq(true);
    try {
      await respondToSessionActionRequest(session.id, isApproved, currentUser.uid, session);
    } catch (err) {
      console.error("Error responding to action request:", err);
    } finally {
      setIsRespondingReq(false);
    }
  };

  const handleSaveMeetingPoint = async (e) => {
    e.preventDefault();
    setPointError('');
    const trimmed = meetingPointInput.trim();

    setIsSavingPoint(true);
    try {
      await updateSessionMeetingPoint(session.id, trimmed, currentUser.uid, session);
      setIsEditingMeetingPoint(false);
    } catch (err) {
      console.error("Failed to update meeting point:", err);
      setPointError(err.message || "Failed to save meeting point.");
    } finally {
      setIsSavingPoint(false);
    }
  };

  const handleEndOnlineSession = async () => {
    if (isEndingMeeting) return;
    if (!window.confirm("Are you sure you want to end this live Google Meet session?")) return;
    setIsEndingMeeting(true);
    try {
      await endOnlineSession(session.id, currentUser.uid, session);
    } catch (err) {
      console.error("Failed to end online session:", err);
    } finally {
      setIsEndingMeeting(false);
    }
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
    <div className={`session-card ${session.status}`}>
      {/* CARD HEADER */}
      <div className="session-card-header">
        <div className="session-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div className="candidate-avatar sm">
            {otherUserName ? otherUserName.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1c1917', margin: 0 }}>
              {session.subject}
            </h3>
            <span className="session-role-subtitle" style={{ fontSize: '0.84rem', color: '#78716c' }}>
              Study Buddy: <strong>{otherUserName}</strong> • Your Role: <strong style={{ color: '#ea580c' }}>{roleLabel}</strong>
            </span>
          </div>
        </div>

        <div className="session-badges-wrap" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {session.matchPercentage && (
            <span className="match-pill-small">
              <Sparkles size={12} /> {session.matchPercentage}% Match
            </span>
          )}

          <span className={`status-badge-pill ${session.status}`}>
            {isUpcoming && 'Upcoming 🕐'}
            {isCompleted && 'Completed ✅'}
            {isCancelled && 'Cancelled ❌'}
          </span>
        </div>
      </div>

      {/* SESSION DETAILS GRID */}
      <div className="session-info-grid">
        <div className="sess-info-item">
          <Calendar size={16} className="sess-icon" />
          <span>Day: <strong>{session.day || 'Monday'}</strong></span>
        </div>

        <div className="sess-info-item">
          <Clock size={16} className="sess-icon" />
          <span>Time: <strong>{formatTime12Hour(session.startTime)} – {formatTime12Hour(session.endTime)}</strong></span>
        </div>

        <div className="sess-info-item">
          <MapPin size={16} className="sess-icon" />
          <span>Mode: <strong>{session.mode}</strong></span>
        </div>

        <div className="sess-info-item">
          <BookOpen size={16} className="sess-icon" />
          <span>Target Level: <strong>{session.requiredLevel || 'Intermediate'}</strong></span>
        </div>
      </div>

      {/* START / JOIN GOOGLE MEET FOR ONLINE & BOTH SESSIONS */}
      {isOnlineSupported && isUpcoming && (
        <div className="online-session-card-block" style={{
          background: isLive ? '#ecfdf5' : '#fff7ed',
          border: isLive ? '1px solid #a7f3d0' : '1px solid #ffedd5',
          borderRadius: '0.9rem',
          padding: '1rem 1.25rem',
          marginTop: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Video size={18} style={{ color: isLive ? '#059669' : '#ea580c' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1c1917', margin: 0 }}>
                Online Google Meet Session
              </h4>
            </div>

            <span style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              padding: '0.25rem 0.65rem',
              borderRadius: '1rem',
              background: isLive ? '#d1fae5' : isEnded ? '#f5f5f4' : '#ffedd5',
              color: isLive ? '#047857' : isEnded ? '#78716c' : '#c2410c',
              border: isLive ? '1px solid #a7f3d0' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}>
              {isLive && '🔴 Live'}
              {isEnded && 'Ended'}
              {!isLive && !isEnded && 'Not Started'}
            </span>
          </div>

          {/* SUB-CONTENT BASED ON ROLE AND MEETING STATUS */}
          {onlineStatus === 'not_started' && (
            <div>
              {isHelper ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#57534e' }}>
                    Create a Google Meet link and start the online session.
                  </span>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setShowStartModal(true)}
                    style={{
                      width: 'auto',
                      height: '38px',
                      fontSize: '0.85rem',
                      padding: '0 1rem'
                    }}
                    id={`btn-start-online-session-${session.id}`}
                  >
                    <Video size={16} /> Start Online Session
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#78716c', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={15} style={{ color: '#ea580c' }} />
                  Online option available • Waiting for your Study Buddy ({otherUserName}) to start the Google Meet.
                </div>
              )}
            </div>
          )}

          {isLive && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.86rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <Sparkles size={15} style={{ color: '#059669' }} />
                Google Meet is live! Both participants can join now.
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => window.open(session.meetingUrl, '_blank', 'noopener,noreferrer')}
                  style={{
                    width: 'auto',
                    height: '40px',
                    fontSize: '0.88rem',
                    padding: '0 1.2rem',
                    background: '#059669',
                    fontWeight: 800
                  }}
                  id={`btn-join-meet-${session.id}`}
                >
                  <ExternalLink size={16} /> Join Google Meet
                </button>

                {isHelper && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleEndOnlineSession}
                    disabled={isEndingMeeting}
                    style={{
                      width: 'auto',
                      height: '40px',
                      fontSize: '0.82rem',
                      padding: '0 0.95rem',
                      borderColor: '#fca5a5',
                      color: '#dc2626'
                    }}
                    id={`btn-end-online-session-${session.id}`}
                  >
                    <VideoOff size={15} /> {isEndingMeeting ? 'Ending...' : 'End Online Session'}
                  </button>
                )}
              </div>
            </div>
          )}

          {isEnded && (
            <div style={{ fontSize: '0.85rem', color: '#78716c', fontStyle: 'italic' }}>
              The Google Meet session has ended.
            </div>
          )}
        </div>
      )}

      {/* UNLOCKED POST-ACCEPTANCE CONTACT & MEETING DETAILS */}
      {canViewContact && (
        <div className="contact-meeting-details-card" style={{
          background: '#fafaf9',
          border: '1px solid #f3e8df',
          borderRadius: '0.9rem',
          padding: showContactDetails ? '1rem 1.25rem' : '0.75rem 1.25rem',
          marginTop: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: showContactDetails ? '0.85rem' : '0',
          transition: 'all 0.2s ease'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: showContactDetails ? '1px solid #f3e8df' : 'none',
            paddingBottom: showContactDetails ? '0.5rem' : '0'
          }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1c1917', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
              <ShieldCheck size={16} style={{ color: '#059669' }} /> Contact &amp; Meeting Details
            </h4>

            {isCompleted ? (
              <button
                type="button"
                onClick={() => setShowContactDetails(prev => !prev)}
                className="completed-session-details-toggle"
                style={{
                  background: '#fff7ed',
                  border: '1px solid #ffedd5',
                  color: '#ea580c',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.65rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
                id={`btn-toggle-details-${session.id}`}
              >
                {showContactDetails ? (
                  <>
                    Hide Details <ChevronUp size={13} />
                  </>
                ) : (
                  <>
                    View Details <ChevronDown size={13} />
                  </>
                )}
              </button>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>Unlocked ✅</span>
            )}
          </div>

          {showContactDetails && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              {/* Buddy Contact Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#78716c', fontWeight: 700, textTransform: 'uppercase' }}>
                  Contact Details ({buddyRoleTitle})
                </span>

                <div style={{ fontSize: '0.9rem', color: '#1c1917', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={15} style={{ color: '#ea580c' }} /> {otherUserName}
                </div>

                <div style={{ fontSize: '0.86rem', color: '#57534e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Mail size={15} style={{ color: '#ea580c' }} /> 
                  {buddyEmail ? buddyEmail : <span style={{ fontStyle: 'italic', color: '#a8a29e' }}>Email not provided</span>}
                </div>

                <div style={{ fontSize: '0.86rem', color: '#57534e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Phone size={15} style={{ color: '#ea580c' }} />
                  {isPhoneHidden ? (
                    <span style={{ fontStyle: 'italic', color: '#a8a29e' }}>Phone number hidden by user</span>
                  ) : buddyPhone ? (
                    <strong style={{ color: '#059669' }}>{buddyPhone}</strong>
                  ) : (
                    <span style={{ fontStyle: 'italic', color: '#a8a29e' }}>Phone number not provided</span>
                  )}
                </div>
              </div>

              {/* Exact Meeting Point or Online Mode Note */}
              {isOfflineSupported && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#78716c', fontWeight: 700, textTransform: 'uppercase' }}>
                    Offline Meeting Location
                  </span>

                  <div>
                    <div style={{ fontSize: '0.9rem', color: '#1c1917', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <MapPin size={15} style={{ color: '#d97706' }} /> {session.location || 'College Library'}
                    </div>

                    {!isEditingMeetingPoint ? (
                      <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.86rem', color: session.meetingPoint ? '#b45309' : '#a8a29e', fontStyle: session.meetingPoint ? 'normal' : 'italic' }}>
                          {session.meetingPoint ? `📍 ${session.meetingPoint}` : 'No exact meeting point set yet.'}
                        </div>

                        {isUpcoming && (
                          <button
                            type="button"
                            onClick={() => {
                              setMeetingPointInput(session.meetingPoint || '');
                              setIsEditingMeetingPoint(true);
                            }}
                            style={{
                              background: '#fff7ed',
                              border: '1px solid #ffedd5',
                              color: '#ea580c',
                              borderRadius: '0.4rem',
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Edit2 size={12} /> {session.meetingPoint ? 'Edit' : 'Set Point'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleSaveMeetingPoint} style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <input
                          type="text"
                          value={meetingPointInput}
                          onChange={(e) => setMeetingPointInput(e.target.value)}
                          placeholder="e.g. Ground Floor – Main Entrance"
                          maxLength={150}
                          className="themed-input"
                          style={{ height: '36px', fontSize: '0.85rem', padding: '0 0.65rem' }}
                          autoFocus
                          disabled={isSavingPoint}
                        />
                        {pointError && (
                          <span className="field-error" style={{ fontSize: '0.78rem' }}>
                            <AlertCircle size={12} /> {pointError}
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="submit"
                            className="btn-primary"
                            disabled={isSavingPoint}
                            style={{ height: '32px', fontSize: '0.8rem', padding: '0 0.75rem', width: 'auto' }}
                          >
                            {isSavingPoint ? 'Saving...' : 'Save Point'}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setIsEditingMeetingPoint(false);
                              setPointError('');
                            }}
                            disabled={isSavingPoint}
                            style={{ height: '32px', fontSize: '0.8rem', padding: '0 0.65rem', width: 'auto' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TUTOR APPROVAL PANEL FOR LEARNER ACTION REQUESTS */}
      {isUpcoming && isHelper && isPendingActionReq && (
        <div className="tutor-action-request-card" style={{
          background: '#fff7ed',
          border: '1px solid #ffedd5',
          borderRadius: '0.9rem',
          padding: '0.85rem 1.15rem',
          marginTop: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div>
            <strong style={{ fontSize: '0.88rem', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={16} /> Learner requested session {actionReq.type}
            </strong>
            <span style={{ fontSize: '0.8rem', color: '#78716c', display: 'block', marginTop: '0.15rem' }}>
              {otherUserName} asks to {actionReq.type === 'completion' ? 'mark this session as completed' : 'cancel this session'}.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-danger"
              onClick={() => handleRespondActionRequest(false)}
              disabled={isRespondingReq}
              style={{ height: '36px', fontSize: '0.82rem', padding: '0 0.85rem' }}
              id={`btn-reject-action-req-${session.id}`}
            >
              Reject
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleRespondActionRequest(true)}
              disabled={isRespondingReq}
              style={{ height: '36px', fontSize: '0.82rem', padding: '0 0.95rem' }}
              id={`btn-approve-action-req-${session.id}`}
            >
              {actionReq.type === 'completion' ? 'Approve Completion' : 'Approve Cancellation'}
            </button>
          </div>
        </div>
      )}

      {/* LEARNER PENDING ACTION REQUEST STATUS BANNER */}
      {isUpcoming && isLearner && isPendingActionReq && (
        <div style={{
          background: '#fff7ed',
          border: '1px solid #ffedd5',
          borderRadius: '0.75rem',
          padding: '0.65rem 1rem',
          marginTop: '0.75rem',
          fontSize: '0.84rem',
          fontWeight: 700,
          color: '#c2410c',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <Clock size={16} />
          <span>
            ⏳ {actionReq.type === 'completion' ? 'Completion' : 'Cancellation'} request pending tutor approval
          </span>
        </div>
      )}

      {/* LEARNER REJECTED ACTION REQUEST NOTICE */}
      {isUpcoming && isLearner && actionReq?.status === 'rejected' && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecdd3',
          borderRadius: '0.75rem',
          padding: '0.55rem 0.9rem',
          marginTop: '0.65rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#dc2626'
        }}>
          Your previous {actionReq.type} request was declined by tutor.
        </div>
      )}

      {/* ACTIONS & REAL-TIME CHAT BUTTON */}
      <div className="session-card-actions" style={{ flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Real-time Chat Button */}
        {isParticipant && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate(`/chat/${session.id}`)}
            style={{
              width: 'auto',
              padding: '0 1.1rem',
              height: '40px',
              fontSize: '0.88rem'
            }}
            id={`btn-chat-session-${session.id}`}
          >
            <MessageSquare size={16} /> {isUpcoming ? '💬 Chat' : '💬 View Chat'}
          </button>
        )}

        {/* TUTOR DIRECT ACTIONS */}
        {isUpcoming && isHelper && (
          <div className="session-actions-row" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleComplete}
              disabled={isUpdating}
              style={{ background: '#059669', height: '40px', fontSize: '0.85rem' }}
              id={`btn-tutor-complete-${session.id}`}
            >
              {isUpdating ? (
                <>
                  <span className="spinner"></span> Updating...
                </>
              ) : (
                <>
                  <CheckCircle size={16} /> Mark Completed
                </>
              )}
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={handleCancel}
              disabled={isUpdating}
              style={{ color: '#dc2626', borderColor: '#fca5a5', height: '40px', fontSize: '0.85rem' }}
              id={`btn-tutor-cancel-${session.id}`}
            >
              <XCircle size={16} /> Cancel Session
            </button>
          </div>
        )}

        {/* LEARNER ACTION REQUEST BUTTONS */}
        {isUpcoming && isLearner && !isPendingActionReq && (
          <div className="session-actions-row" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActionModalType('completion')}
              style={{ height: '40px', fontSize: '0.85rem', color: '#ea580c', borderColor: '#ffedd5' }}
              id={`btn-learner-req-complete-${session.id}`}
            >
              <CheckCircle size={16} /> Request Completion
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActionModalType('cancellation')}
              style={{ height: '40px', fontSize: '0.85rem', color: '#dc2626', borderColor: '#fca5a5' }}
              id={`btn-learner-req-cancel-${session.id}`}
            >
              <XCircle size={16} /> Request Cancellation
            </button>
          </div>
        )}

        {/* STRICT REQUIREMENT: Only show rating option to Learner */}
        {isCompleted && isLearner && (
          <div className="rating-action-wrapper">
            {ratingStatus.rated ? (
              <div className="rated-badge-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="rated-check" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Check size={14} /> Rated
                </span>
                <div className="stars-row">{renderStars(ratingStatus.ratingVal)}</div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-primary btn-rate-buddy"
                onClick={() => setShowRatingModal(true)}
                style={{ height: '40px', fontSize: '0.88rem' }}
              >
                <Star size={16} fill="#ffffff" /> ⭐ Rate My Buddy
              </button>
            )}
          </div>
        )}
      </div>

      {/* LEARNER ACTION CONFIRMATION MODAL */}
      {actionModalType && (
        <SessionActionModal
          session={session}
          actionType={actionModalType}
          currentUser={currentUser}
          onClose={() => setActionModalType(null)}
        />
      )}

      {/* START ONLINE SESSION MODAL (HELPER ONLY) */}
      {showStartModal && (
        <StartOnlineSessionModal
          session={session}
          currentUser={currentUser}
          onClose={() => setShowStartModal(false)}
        />
      )}

      {/* RATING MODAL (STABLE OVERLAY DIALOG) */}
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
