import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SessionCard from '../components/SessionCard';
import PageHeader from '../components/PageHeader';
import { 
  subscribeToUserSessions, 
  completeSession, 
  cancelSession 
} from '../services/sessionService';
import { 
  CalendarCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function SessionsPage({ currentUser }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertMessage, setAlertMessage] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoading(true);

    const unsubscribe = subscribeToUserSessions(currentUser.uid, (data) => {
      setSessions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleComplete = async (sessionId) => {
    setAlertMessage(null);
    try {
      const sess = sessions.find(s => s.id === sessionId);
      await completeSession(sessionId, sess, currentUser?.uid);
      setAlertMessage({
        type: 'success',
        text: 'Study session marked as completed! 🎉'
      });
    } catch (err) {
      console.error("Complete session error:", err);
      setAlertMessage({
        type: 'error',
        text: err.message || "Failed to mark session as completed."
      });
    }
  };

  const handleCancel = async (sessionId) => {
    setAlertMessage(null);
    try {
      const sess = sessions.find(s => s.id === sessionId);
      await cancelSession(sessionId, sess, currentUser?.uid);
      setAlertMessage({
        type: 'success',
        text: 'Study session cancelled.'
      });
    } catch (err) {
      console.error("Cancel session error:", err);
      setAlertMessage({
        type: 'error',
        text: err.message || "Failed to cancel session."
      });
    }
  };

  const upcomingSessions = sessions.filter(s => s.status === 'upcoming');
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const cancelledSessions = sessions.filter(s => s.status === 'cancelled');

  return (
    <div className="sessions-page">
      <PageHeader
        title="Study Sessions 📅"
        description="Coordinate Google Meet links, meeting points, and track your study sessions."
        icon={CalendarCheck}
      />

      {alertMessage && (
        <div className={`alert-banner ${alertMessage.type}`} style={{ marginBottom: '1.25rem' }}>
          {alertMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <div>{alertMessage.text}</div>
        </div>
      )}

      {loading ? (
        <div className="loading-card">
          <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
          <p>Syncing study sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        /* GLOBAL EMPTY STATE */
        <div className="app-empty-state">
          <div className="empty-state-icon">
            <CalendarCheck size={28} />
          </div>
          <h3 className="empty-state-title">No study sessions yet</h3>
          <p className="empty-state-desc">
            Find a Study Buddy and send a study request to schedule your first session!
          </p>
          <Link to="/find-buddy" className="btn-primary" style={{ textDecoration: 'none' }}>
            <Sparkles size={18} /> Find a Study Buddy
          </Link>
        </div>
      ) : (
        <div className="sessions-sections-list">
          {/* UPCOMING SESSIONS */}
          <div className="session-group-section">
            <div className="session-group-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Clock size={20} style={{ color: '#ea580c' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1c1917', margin: 0 }}>
                Upcoming Sessions ({upcomingSessions.length})
              </h3>
            </div>

            {upcomingSessions.length > 0 ? (
              <div className="sessions-stack">
                {upcomingSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    currentUser={currentUser}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            ) : (
              /* POLISHED COMPACT EMPTY UPCOMING SESSIONS CARD */
              <div className="app-empty-state" style={{ padding: '2.25rem 1.5rem', gap: '0.65rem' }}>
                <div className="empty-state-icon" style={{ width: '48px', height: '48px' }}>
                  <Clock size={24} />
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1c1917', margin: 0 }}>
                  No upcoming sessions
                </h4>
                <p className="empty-state-desc" style={{ fontSize: '0.86rem' }}>
                  Accepted Study Buddy sessions will appear here.
                </p>
                <Link to="/find-buddy" className="btn-secondary" style={{ textDecoration: 'none', height: '38px', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                  <Sparkles size={16} /> Find Study Buddy
                </Link>
              </div>
            )}
          </div>

          {/* COMPLETED SESSIONS */}
          {completedSessions.length > 0 && (
            <div className="session-group-section" style={{ marginTop: '2rem' }}>
              <div className="session-group-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <CheckCircle size={20} style={{ color: '#059669' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1c1917', margin: 0 }}>
                  Completed Sessions ({completedSessions.length})
                </h3>
              </div>

              <div className="sessions-stack">
                {completedSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    currentUser={currentUser}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            </div>
          )}

          {/* CANCELLED SESSIONS */}
          {cancelledSessions.length > 0 && (
            <div className="session-group-section" style={{ marginTop: '2rem' }}>
              <div className="session-group-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <XCircle size={20} style={{ color: '#78716c' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1c1917', margin: 0 }}>
                  Cancelled Sessions ({cancelledSessions.length})
                </h3>
              </div>

              <div className="sessions-stack">
                {cancelledSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    currentUser={currentUser}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
