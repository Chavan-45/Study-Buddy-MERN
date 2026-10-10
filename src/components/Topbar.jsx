import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Bell, Menu, User, LogOut } from 'lucide-react';
import { subscribeToNotifications } from '../services/notificationService';
import NotificationPanel from './NotificationPanel';
import { logoutUser } from '../services/authService';

export default function Topbar({ currentUser, onLogout, onToggleSidebar }) {
  const location = useLocation();
  const navigate = useNavigate();

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

  const handleMarkReadLocal = (notifId) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notifId ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllReadLocal = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true }))
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const initial = currentUser?.displayName
    ? currentUser.displayName.charAt(0).toUpperCase()
    : currentUser?.email
    ? currentUser.email.charAt(0).toUpperCase()
    : 'U';

  const getPageMeta = () => {
    const p = location.pathname;
    if (p === '/dashboard') return { title: 'Dashboard', subtitle: 'Overview of your study matches and sessions' };
    if (p === '/find-buddy') return { title: 'Find Study Buddy', subtitle: 'Search and spin the roulette for your best match' };
    if (p === '/requests') return { title: 'Study Requests', subtitle: 'Manage incoming and sent buddy requests' };
    if (p === '/sessions') return { title: 'Study Sessions', subtitle: 'Manage active, upcoming, and completed sessions' };
    if (p === '/history') return { title: 'Study History', subtitle: 'Review your past study sessions and feedback' };
    if (p === '/profile') return { title: 'Student Profile', subtitle: 'Manage your skills, availability, and preferences' };
    if (p.startsWith('/chat/')) return { title: 'Study Buddy Chat', subtitle: 'Real-time conversation with your buddy' };
    return { title: 'Study Buddy Roulette', subtitle: 'Peer learning and skill exchange' };
  };

  const pageMeta = getPageMeta();

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="topbar-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle Navigation Menu"
        >
          <Menu size={22} />
        </button>

        <div className="topbar-page-info">
          <h1 className="topbar-title">{pageMeta.title}</h1>
          <p className="topbar-subtitle">{pageMeta.subtitle}</p>
        </div>
      </div>

      <div className="topbar-right">
        {/* NOTIFICATION BELL DROPDOWN */}
        <div ref={dropdownRef} className="topbar-notif-container">
          <button
            type="button"
            className={`topbar-icon-btn ${showNotifications ? 'active' : ''}`}
            onClick={() => setShowNotifications(prev => !prev)}
            aria-label="Notifications"
            id="topbar-btn-notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="topbar-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

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

        {/* USER PROFILE SHORTCUT */}
        <Link to="/profile" className="topbar-user-badge" title="View Profile">
          <div className="topbar-avatar">{initial}</div>
          <span className="topbar-user-name-text">
            {currentUser?.displayName || currentUser?.email?.split('@')[0]}
          </span>
        </Link>

        {/* LOGOUT */}
        <button
          type="button"
          className="topbar-logout-btn"
          onClick={handleSignOut}
          title="Sign Out"
          id="topbar-btn-logout"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
