import React, { useState, useEffect } from 'react';
import { subscribeToUserSessions } from '../services/sessionService';
import HistoryCard from '../components/HistoryCard';
import PageHeader from '../components/PageHeader';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  BookOpen, 
  User 
} from 'lucide-react';

export default function StudyHistoryPage({ currentUser }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('completed'); // 'completed' | 'cancelled'
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'learner' | 'helper'
  const [subjectFilter, setSubjectFilter] = useState('all');

  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoading(true);
    const unsub = subscribeToUserSessions(currentUser.uid, (data) => {
      setSessions(data || []);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  // Separate Completed & Cancelled Sessions
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const cancelledSessions = sessions.filter(s => s.status === 'cancelled');

  const currentTabSessions = activeTab === 'completed' ? completedSessions : cancelledSessions;

  // Extract unique subjects for filtering
  const uniqueSubjects = Array.from(
    new Set(currentTabSessions.map(s => s.subject).filter(Boolean))
  );

  // Apply Role & Subject Filters
  const filteredSessions = currentTabSessions.filter(s => {
    const isLearner = s.learnerId === currentUser?.uid || s.requesterId === currentUser?.uid;
    const isHelper = s.helperId === currentUser?.uid;

    if (roleFilter === 'learner' && !isLearner) return false;
    if (roleFilter === 'helper' && !isHelper) return false;
    if (subjectFilter !== 'all' && s.subject !== subjectFilter) return false;

    return true;
  });

  if (loading) {
    return (
      <div className="requests-container">
        <div className="loading-card">
          <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
          <p>Loading your study history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="requests-container">
      <PageHeader
        title="Study History 📜"
        description="Review your completed sessions, learning milestones, and peer feedback."
        icon={History}
      />

      {/* TAB NAVIGATION: [ Completed (count) ] [ Cancelled (count) ] */}
      <div className="tabs-header" style={{ marginBottom: '1.25rem', maxWidth: '440px' }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('completed');
            setSubjectFilter('all');
          }}
          id="tab-history-completed"
        >
          <CheckCircle2 size={18} />
          Completed Sessions
          <span className="tab-count-badge" style={{ background: '#059669', color: '#ffffff' }}>
            {completedSessions.length}
          </span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('cancelled');
            setSubjectFilter('all');
          }}
          id="tab-history-cancelled"
        >
          <XCircle size={18} />
          Cancelled Sessions
          <span className="tab-count-badge" style={{ background: '#78716c', color: '#ffffff' }}>
            {cancelledSessions.length}
          </span>
        </button>
      </div>

      {/* FILTER CONTROLS BAR */}
      {currentTabSessions.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: '#ffffff',
          border: '1px solid var(--card-border)',
          padding: '0.85rem 1.25rem',
          borderRadius: '0.85rem',
          marginBottom: '1rem',
          boxShadow: 'var(--card-shadow)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#57534e', fontWeight: 700 }}>
            <Filter size={16} /> Filter By:
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <User size={15} style={{ color: '#ea580c' }} />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="themed-select"
              style={{ height: '36px', fontSize: '0.85rem', padding: '0 0.75rem', width: 'auto' }}
            >
              <option value="all">All Roles</option>
              <option value="learner">Learner</option>
              <option value="helper">Helper</option>
            </select>
          </div>

          {uniqueSubjects.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BookOpen size={15} style={{ color: '#ea580c' }} />
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="themed-select"
                style={{ height: '36px', fontSize: '0.85rem', padding: '0 0.75rem', width: 'auto' }}
              >
                <option value="all">All Subjects</option>
                {uniqueSubjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* SESSIONS LIST OR EMPTY STATE */}
      {filteredSessions.length > 0 ? (
        <div className="requests-list">
          {filteredSessions.map(session => (
            <HistoryCard
              key={session.id}
              session={session}
              currentUser={currentUser}
            />
          ))}
        </div>
      ) : (
        <div className="section-card empty-sessions-card" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <History size={48} style={{ color: '#a8a29e', marginBottom: '1rem' }} />
          {activeTab === 'completed' ? (
            <>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1c1917', marginBottom: '0.35rem' }}>
                No study history yet 📜
              </h3>
              <p style={{ color: '#78716c', fontSize: '0.9rem', maxWidth: '360px', margin: '0 auto' }}>
                Complete a Study Buddy session and it will appear here.
              </p>
            </>
          ) : (
            <>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1c1917', marginBottom: '0.35rem' }}>
                No cancelled sessions
              </h3>
              <p style={{ color: '#78716c', fontSize: '0.9rem', maxWidth: '360px', margin: '0 auto' }}>
                You have no cancelled study sessions in your record.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
