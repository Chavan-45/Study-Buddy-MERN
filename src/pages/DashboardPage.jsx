import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getUserProfile, calculateProfileCompletion } from '../services/userService';
import { subscribeToUserSessions } from '../services/sessionService';
import { subscribeToIncomingRequests, acceptStudyRequest, rejectStudyRequest } from '../services/requestService';
import { subscribeToNotifications } from '../services/notificationService';
import { formatTime12Hour } from '../utils/timeUtils';
import PageHeader from '../components/PageHeader';
import { 
  Sparkles, 
  GraduationCap, 
  Clock, 
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Inbox,
  Bell,
  ArrowRight,
  UserCheck,
  MapPin,
  MessageSquare,
  Video,
  ExternalLink,
  History,
  ShieldCheck,
  User,
  Check,
  X
} from 'lucide-react';

export default function DashboardPage({ currentUser }) {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoadingProfile(true);
    getUserProfile(currentUser.uid)
      .then(data => setProfile(data || {}))
      .catch(err => console.error("Error loading profile:", err))
      .finally(() => setLoadingProfile(false));

    // Real-time subscriptions for real dashboard stats!
    const unsubSessions = subscribeToUserSessions(currentUser.uid, (data) => {
      setSessions(data || []);
    });

    const unsubRequests = subscribeToIncomingRequests(currentUser.uid, (data) => {
      setRequests(data || []);
    });

    const unsubNotifs = subscribeToNotifications(currentUser.uid, (data) => {
      setNotifications(data || []);
    });

    return () => {
      unsubSessions();
      unsubRequests();
      unsubNotifs();
    };
  }, [currentUser]);

  const handleAcceptReq = async (reqId) => {
    setActionLoadingId(reqId);
    try {
      await acceptStudyRequest(reqId, currentUser.uid);
    } catch (err) {
      console.error("Accept error:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectReq = async (reqId) => {
    setActionLoadingId(reqId);
    try {
      await rejectStudyRequest(reqId, currentUser.uid);
    } catch (err) {
      console.error("Reject error:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const displayName = profile?.name || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Student';
  const completionStats = calculateProfileCompletion(profile);
  const isComplete = completionStats.isComplete;
  const percentage = completionStats.percentage;

  // Real Stats Calculations
  const upcomingSessions = sessions.filter(s => s.status === 'upcoming');
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const unreadNotifs = notifications.filter(n => !n.isRead);

  // Next Upcoming Session
  const nextSession = upcomingSessions.length > 0 ? upcomingSessions[0] : null;

  if (loadingProfile) {
    return (
      <div className="dashboard-container">
        <div className="loading-card">
          <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
          <p>Loading your study dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* WELCOME BANNER CARD */}
      <div className="welcome-banner-card">
        <div className="welcome-banner-content">
          <div className="welcome-badge">
            <Sparkles size={14} /> Peer Learning Platform
          </div>
          <h1>Welcome back, {displayName}! 👋</h1>
          <p>
            {isComplete
              ? "Find your ideal study buddy, coordinate Google Meet sessions, and excel together."
              : "Complete your student profile to enable roulette matching and connect with study buddies."}
          </p>

          <div className="welcome-banner-actions">
            <Link to="/find-buddy" className="btn-primary" id="btn-welcome-find-buddy">
              <Sparkles size={18} /> Find Study Buddy
            </Link>
            <Link to="/profile" className="btn-secondary" style={{ background: '#ffffff', color: '#ea580c' }}>
              <User size={16} /> My Profile
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert-banner error" style={{ marginBottom: '1.25rem' }}>
          <AlertCircle size={20} />
          <div>{error}</div>
        </div>
      )}

      {/* COMPACT INCOMPLETE PROFILE NOTICE */}
      {!isComplete && (
        <div className="compact-profile-progress-bar">
          <div className="compact-progress-info">
            <span className="compact-percentage">{percentage}%</span>
            <div className="compact-text-wrap">
              <strong>Profile Incomplete</strong>
              <p>
                {completionStats.missingFields.length > 0
                  ? `Missing: ${completionStats.missingFields.join(', ')}`
                  : 'Complete remaining fields to unlock study buddy matching.'}
              </p>
            </div>
          </div>

          <div className="compact-bar-track">
            <div
              className="compact-bar-fill"
              style={{ width: `${percentage}%` }}
            ></div>
          </div>

          <Link to="/profile" className="btn-compact-complete">
            Complete Profile <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* SUMMARY STATS GRID */}
      <div className="dashboard-stats-grid">
        <div className="stat-card">
          <div className="stat-icon-wrap orange">
            <CalendarCheck size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-number">{upcomingSessions.length}</span>
            <span className="stat-label">Upcoming Sessions</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap green">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-number">{completedSessions.length}</span>
            <span className="stat-label">Completed Sessions</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap amber">
            <Inbox size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-number">{pendingRequests.length}</span>
            <span className="stat-label">Pending Requests</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrap purple">
            <Bell size={22} />
          </div>
          <div className="stat-details">
            <span className="stat-number">{unreadNotifs.length}</span>
            <span className="stat-label">Unread Notifications</span>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN DASHBOARD CONTENT */}
      <div className="dashboard-content-grid">
        {/* LEFT COLUMN: UPCOMING SPOTLIGHT & PENDING REQUESTS */}
        <div className="dash-col-left">
          {/* UPCOMING SESSION SPOTLIGHT */}
          <div className="dash-widget-card">
            <div className="dash-widget-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: '#ea580c' }} /> Next Study Session
              </h3>
              <Link to="/sessions" className="widget-header-link">View All</Link>
            </div>

            {nextSession ? (
              <div className="next-session-card">
                <div className="next-session-top">
                  <div className="candidate-avatar sm" style={{ background: '#fff7ed', color: '#ea580c', fontWeight: 800 }}>
                    {(nextSession.learnerId === currentUser?.uid ? nextSession.helperName : nextSession.learnerName)?.charAt(0).toUpperCase() || 'S'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 className="next-session-title">{nextSession.subject}</h4>
                    <span className="next-session-buddy">
                      With <strong>{nextSession.learnerId === currentUser?.uid ? nextSession.helperName : nextSession.learnerName}</strong>
                    </span>
                  </div>
                  <span className="status-badge-pill upcoming">Upcoming</span>
                </div>

                <div className="next-session-details">
                  <span>🗓️ {nextSession.day || 'Monday'}</span>
                  <span>🕐 {formatTime12Hour(nextSession.startTime)} – {formatTime12Hour(nextSession.endTime)}</span>
                  <span>📍 {nextSession.mode}: {nextSession.location}</span>
                </div>

                <div className="next-session-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => navigate(`/chat/${nextSession.id}`)}
                    style={{ height: '36px', fontSize: '0.85rem', padding: '0 0.85rem' }}
                  >
                    <MessageSquare size={14} /> Chat
                  </button>
                  
                  {nextSession.mode === 'Online' && nextSession.meetingUrl && nextSession.onlineSessionStatus === 'live' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => window.open(nextSession.meetingUrl, '_blank', 'noopener,noreferrer')}
                      style={{ height: '36px', fontSize: '0.85rem', padding: '0 0.85rem', color: '#059669', borderColor: '#a7f3d0' }}
                    >
                      <ExternalLink size={14} /> Join Meet
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="dash-empty-widget">
                <Clock size={32} style={{ color: '#cbd5e1' }} />
                <p>No upcoming sessions scheduled.</p>
                <Link to="/find-buddy" className="btn-secondary" style={{ fontSize: '0.82rem', height: '34px' }}>
                  <Sparkles size={14} /> Find Buddy
                </Link>
              </div>
            )}
          </div>

          {/* PENDING INCOMING REQUESTS PREVIEW */}
          <div className="dash-widget-card">
            <div className="dash-widget-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Inbox size={18} style={{ color: '#ea580c' }} /> Pending Requests ({pendingRequests.length})
              </h3>
              <Link to="/requests" className="widget-header-link">View All</Link>
            </div>

            {pendingRequests.length > 0 ? (
              <div className="pending-requests-preview-list">
                {pendingRequests.slice(0, 3).map((req) => (
                  <div key={req.id} className="dash-req-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                      <div className="candidate-avatar sm" style={{ width: '38px', height: '38px', fontSize: '0.95rem' }}>
                        {req.requesterName ? req.requesterName.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: '0.9rem', color: '#1c1917', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {req.requesterName}
                        </strong>
                        <span style={{ fontSize: '0.8rem', color: '#78716c' }}>
                          {req.subject} • {req.day}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleAcceptReq(req.id)}
                        disabled={actionLoadingId === req.id}
                        style={{ height: '32px', fontSize: '0.78rem', padding: '0 0.6rem', background: '#059669' }}
                      >
                        <Check size={13} /> Accept
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleRejectReq(req.id)}
                        disabled={actionLoadingId === req.id}
                        style={{ height: '32px', fontSize: '0.78rem', padding: '0 0.6rem', color: '#dc2626', borderColor: '#fca5a5' }}
                      >
                        <X size={13} /> Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dash-empty-widget" style={{ padding: '1.5rem' }}>
                <Inbox size={28} style={{ color: '#cbd5e1' }} />
                <p style={{ fontSize: '0.85rem' }}>No pending study requests right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: PROFILE ACADEMICS & QUICK ACTIONS */}
        <div className="dash-col-right">
          {/* QUICK SHORTCUTS GRID */}
          <div className="dash-widget-card">
            <div className="dash-widget-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="quick-actions-grid">
              <Link to="/find-buddy" className="quick-action-btn">
                <Sparkles size={20} style={{ color: '#ea580c' }} />
                <span>Find Buddy</span>
              </Link>
              <Link to="/requests" className="quick-action-btn">
                <Inbox size={20} style={{ color: '#0284c7' }} />
                <span>Requests</span>
              </Link>
              <Link to="/sessions" className="quick-action-btn">
                <CalendarCheck size={20} style={{ color: '#059669' }} />
                <span>Sessions</span>
              </Link>
              <Link to="/history" className="quick-action-btn">
                <History size={20} style={{ color: '#7c3aed' }} />
                <span>Study History</span>
              </Link>
            </div>
          </div>

          {/* ACADEMICS & SKILLS SNAPSHOT */}
          <div className="dash-widget-card">
            <div className="dash-widget-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GraduationCap size={18} style={{ color: '#ea580c' }} /> Academic Profile
              </h3>
              <Link to="/profile" className="widget-header-link">Edit</Link>
            </div>

            <div className="dash-profile-summary">
              <div className="dash-info-row">
                <span>Department:</span>
                <strong>{profile?.department || 'Not set'}</strong>
              </div>
              <div className="dash-info-row">
                <span>Year:</span>
                <strong>{profile?.year || 'Not set'}</strong>
              </div>
              <div className="dash-info-row">
                <span>Study Mode:</span>
                <strong>{profile?.mode || 'Both'}</strong>
              </div>

              <div style={{ marginTop: '0.85rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#78716c', textTransform: 'uppercase' }}>
                  I Can Help With:
                </span>
                <div className="pill-wrap" style={{ marginTop: '0.35rem' }}>
                  {Array.isArray(profile?.canHelp) && profile.canHelp.length > 0 ? (
                    profile.canHelp.map((s, idx) => (
                      <span key={idx} className="dash-pill green">
                        {s.subject} ({s.level})
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.82rem', color: '#a8a29e', fontStyle: 'italic' }}>No skills added yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
