import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Sparkles, 
  Inbox, 
  CalendarCheck, 
  History, 
  User, 
  LogOut,
  X
} from 'lucide-react';
import { logoutUser } from '../firebase';

export default function Sidebar({ currentUser, onLogout, isOpen, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await logoutUser();
      if (onLogout) onLogout();
      navigate('/');
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Find Buddy', path: '/find-buddy', icon: Sparkles },
    { label: 'Requests', path: '/requests', icon: Inbox },
    { label: 'Sessions', path: '/sessions', icon: CalendarCheck },
    { label: 'Study History', path: '/history', icon: History },
    { label: 'Profile', path: '/profile', icon: User },
  ];

  const initial = currentUser?.displayName
    ? currentUser.displayName.charAt(0).toUpperCase()
    : currentUser?.email
    ? currentUser.email.charAt(0).toUpperCase()
    : 'U';

  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Student';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={onClose}
        />
      )}

      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`}>
        {/* BRANDING HEADER */}
        <div className="sidebar-brand">
          <Link to="/dashboard" className="sidebar-brand-link" onClick={onClose}>
            <span className="sidebar-logo">🎲</span>
            <span className="sidebar-title">Study Buddy<span className="sidebar-title-highlight"> Roulette</span></span>
          </Link>
          <button 
            type="button" 
            className="sidebar-close-btn" 
            onClick={onClose}
            aria-label="Close Sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">MAIN MENU</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon size={19} className="sidebar-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* BOTTOM USER PROFILE CARD */}
        <div className="sidebar-footer">
          <div className="sidebar-user-card">
            <div className="sidebar-avatar">{initial}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{userName}</span>
              <span className="sidebar-user-email">{currentUser?.email}</span>
            </div>
            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={handleSignOut}
              title="Sign Out"
              id="sidebar-btn-logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
