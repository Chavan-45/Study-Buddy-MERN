import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from '../services/notificationService';
import { formatRelativeTime } from '../utils/dateUtils';
import { 
  Bell, 
  CheckCheck, 
  Inbox, 
  MessageSquare, 
  MapPin, 
  CheckCircle2, 
  XCircle,
  Video,
  VideoOff
} from 'lucide-react';

export default function NotificationPanel({ 
  currentUser, 
  notifications, 
  onClose,
  onMarkRead,
  onMarkAllRead
}) {
  const navigate = useNavigate();
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const handleItemClick = async (notif) => {
    if (!notif.isRead) {
      if (onMarkRead) onMarkRead(notif.id);
      await markNotificationAsRead(notif.id);
    }
    if (onClose) onClose();

    // Determine target route based on type
    if (notif.type === 'study_request' || notif.type === 'request_rejected') {
      navigate('/requests');
    } else if (notif.type === 'new_message' && notif.relatedSessionId) {
      navigate(`/chat/${notif.relatedSessionId}`);
    } else {
      navigate('/sessions');
    }
  };

  const handleMarkAllReadSubmit = async () => {
    if (!currentUser?.uid || isMarkingAll) return;
    setIsMarkingAll(true);

    if (onMarkAllRead) onMarkAllRead();

    try {
      await markAllNotificationsAsRead(currentUser.uid);
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'study_request':
        return <Inbox size={16} style={{ color: '#ea580c' }} />;
      case 'request_accepted':
        return <CheckCircle2 size={16} style={{ color: '#059669' }} />;
      case 'request_rejected':
        return <XCircle size={16} style={{ color: '#dc2626' }} />;
      case 'new_message':
        return <MessageSquare size={16} style={{ color: '#0284c7' }} />;
      case 'meeting_point_updated':
        return <MapPin size={16} style={{ color: '#d97706' }} />;
      case 'online_session_started':
        return <Video size={16} style={{ color: '#059669' }} />;
      case 'online_session_ended':
        return <VideoOff size={16} style={{ color: '#78716c' }} />;
      case 'session_completed':
        return <CheckCircle2 size={16} style={{ color: '#059669' }} />;
      case 'session_cancelled':
        return <XCircle size={16} style={{ color: '#dc2626' }} />;
      default:
        return <Bell size={16} style={{ color: '#ea580c' }} />;
    }
  };

  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <div className="notification-panel-dropdown" style={{
      position: 'absolute',
      top: 'calc(100% + 0.6rem)',
      right: '0',
      width: '360px',
      maxWidth: 'calc(100vw - 2rem)',
      background: '#ffffff',
      border: '1px solid var(--card-border)',
      borderRadius: '1rem',
      boxShadow: 'var(--card-shadow)',
      zIndex: 1100,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* HEADER */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.9rem 1.1rem',
        borderBottom: '1px solid var(--card-border)',
        background: '#fff7ed'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '0.95rem', color: '#1c1917' }}>
          <Bell size={17} style={{ color: '#ea580c' }} />
          Notifications
        </div>

        {hasUnread && (
          <button
            type="button"
            onClick={handleMarkAllReadSubmit}
            disabled={isMarkingAll}
            style={{
              background: 'none',
              border: 'none',
              color: isMarkingAll ? '#a8a29e' : '#ea580c',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: isMarkingAll ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            id="btn-mark-all-read"
          >
            <CheckCheck size={14} /> {isMarkingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      {/* NOTIFICATIONS LIST */}
      <div style={{
        maxHeight: '380px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {notifications.length > 0 ? (
          notifications.map(item => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              style={{
                padding: '0.85rem 1.1rem',
                borderBottom: '1px solid #f3e8df',
                cursor: 'pointer',
                background: item.isRead ? '#ffffff' : '#fff7ed',
                transition: 'background 0.2s ease',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
                position: 'relative'
              }}
              className="notification-item-hover"
            >
              {/* Unread indicator dot */}
              {!item.isRead && (
                <span style={{
                  position: 'absolute',
                  top: '1.1rem',
                  left: '0.45rem',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#ea580c'
                }} />
              )}

              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#fafaf9',
                border: '1px solid #e7e5e4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '0.1rem'
              }}>
                {getIconForType(item.type)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.86rem',
                  fontWeight: item.isRead ? 600 : 800,
                  color: '#1c1917',
                  marginBottom: '0.15rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                  <span style={{ fontSize: '0.72rem', color: '#78716c', fontWeight: 500, flexShrink: 0 }}>
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>

                <div style={{
                  fontSize: '0.8rem',
                  color: item.isRead ? '#57534e' : '#1c1917',
                  lineHeight: 1.35,
                  wordBreak: 'break-word'
                }}>
                  {item.message}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            color: '#78716c',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <Bell size={32} style={{ color: '#cbd5e1' }} />
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1c1917' }}>No notifications yet</span>
            <span style={{ fontSize: '0.8rem', color: '#78716c', maxWidth: '240px', lineHeight: 1.4 }}>
              Updates about requests, sessions and messages will appear here.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
