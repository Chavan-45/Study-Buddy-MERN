import React from 'react';
import { LogOut, CheckCircle, Sparkles, UserCheck, ShieldCheck } from 'lucide-react';
import { logoutUser } from '../firebase';

export default function Dashboard({ user, onLogout }) {
  const handleLogout = async () => {
    await logoutUser();
    onLogout();
  };

  const initial = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : 'S';

  return (
    <div className="auth-card dashboard-card">
      <div className="avatar-badge">{initial}</div>

      <div style={{ textTransform: 'capitalize' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          Welcome, {user?.displayName || user?.name || 'Student'}! 👋
        </h2>
        <span className="verified-badge">
          <CheckCircle size={14} /> Email Verified
        </span>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
        You are authenticated and ready to find your next study buddy.
      </p>

      <div className="user-info-box">
        <div className="info-row">
          <span className="info-label">Account Email</span>
          <span className="info-val">{user?.email}</span>
        </div>
        {user?.phone && (
          <div className="info-row">
            <span className="info-label">Phone Number</span>
            <span className="info-val">{user.phone}</span>
          </div>
        )}
        <div className="info-row">
          <span className="info-label">Auth Provider</span>
          <span className="info-val">Firebase Auth</span>
        </div>
        <div className="info-row">
          <span className="info-label">Account Status</span>
          <span className="info-val" style={{ color: '#34d399' }}>Active & Verified</span>
        </div>
      </div>

      <div style={{
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1px border-dashed rgba(99, 102, 241, 0.3)',
        borderRadius: '0.75rem',
        padding: '0.85rem',
        fontSize: '0.85rem',
        color: 'var(--accent-light)',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Sparkles size={18} style={{ flexShrink: 0 }} />
        <span>Authentication complete! Study Buddy Roulette matching coming soon.</span>
      </div>

      <button
        type="button"
        className="btn-secondary"
        onClick={handleLogout}
        id="btn-dashboard-logout"
      >
        <LogOut size={18} /> Sign Out
      </button>
    </div>
  );
}
