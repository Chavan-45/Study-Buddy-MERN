import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Sparkles, 
  Inbox, 
  CalendarCheck, 
  History,
  Bell,
  User, 
  LogOut 
} from 'lucide-react';
import { logoutUser } from '../services/authService';
import { subscribeToNotifications } from '../services/notificationService';
import NotificationPanel from './NotificationPanel';

export default function Navbar({ currentUser, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeToNotifications(currentUser.uid, (data) => {
      setNotifications(data || []);
    });
    return () => unsub();
  }, [currentUser]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await logoutUser();
      if (onLogout) onLogout();
      navigate('/');
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Immediate optimistic update for single notification read
  const handleMarkReadLocal = (notifId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
    );
  };

  // Immediate optimistic update for all notifications read
  const handleMarkAllReadLocal = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true }))
    );
  };

  // Derived unread count directly from state array
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const initial = currentUser?.displayName
    ? currentUser.displayName.charAt(0).toUpperCase()
    : currentUser?.email
    ? currentUser.email.charAt(0).toUpperCase()
    : 'U';

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <Link to="/dashboard" className="navbar-brand">
          <span className="navbar-logo">🎲</span>
          <span className="navbar-title">Study Buddy Roulette</span>
        </Link>

        {/* Navigation Links */}
        <div className="navbar-links">
          <Link
            to="/dashboard"
            className={`nav-item ${location.pathname === '/dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </Link>

          <Link
            to="/find-buddy"
            className={`nav-item ${location.pathname === '/find-buddy' ? 'active' : ''}`}
          >
            <Sparkles size={18} />
            <span>Find Buddy</span>
          </Link>

          <Link
            to="/requests"
            className={`nav-item ${location.pathname === '/requests' ? 'active' : ''}`}
          >
            <Inbox size={18} />
            <span>Requests</span>
          </Link>

          <Link
            to="/sessions"
            className={`nav-item ${location.pathname === '/sessions' ? 'active' : ''}`}
          >
            <CalendarCheck size={18} />
            <span>Sessions</span>
          </Link>

          <Link
            to="/history"
            className={`nav-item ${location.pathname === '/history' ? 'active' : ''}`}
          >
            <History size={18} />
            <span>Study History</span>
          </Link>

          {/* NOTIFICATION BELL WITH BADGE */}
          <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
              type="button"
              className={`nav-item ${showNotifications ? 'active' : ''}`}
              onClick={() => setShowNotifications(prev => !prev)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Notifications"
              id="nav-btn-notifications"
            >
              <Bell size={19} />
              {unreadCount > 0 && (
                <span className="nav-notif-badge" style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  height: '17px',
                  minWidth: '17px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  border: '2px solid var(--nav-bg)',
                  boxShadow: '0 0 10px var(--primary-glow)'
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* NOTIFICATION DROPDOWN PANEL */}
            {showNotifications && (
              <NotificationPanel
                currentUser={currentUser}
                notifications={notifications}
                onClose={() => setShowNotifications(false)}
                onMarkRead={handleMarkReadLocal}
                onMarkAllRead={handleMarkAllReadLocal}
              />
            )}
          </div>

          <Link
            to="/profile"
            className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
          >
            <User size={18} />
            <span>Profile</span>
          </Link>

          {/* User Profile & Sign Out */}
          <div className="nav-user-menu">
            <div className="user-avatar" title={currentUser?.email || ''}>
              {initial}
            </div>
            <button
              type="button"
              className="btn-logout"
              onClick={handleSignOut}
              title="Sign Out"
              id="nav-btn-logout"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
