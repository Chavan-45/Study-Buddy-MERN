import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  getOrCreateChat, 
  sendMessage, 
  subscribeToMessages 
} from '../services/chatService';
import { formatTime12Hour } from '../utils/timeUtils';
import { getSessionById } from '../services/sessionService';
import { 
  ArrowLeft, 
  Send, 
  MessageSquare, 
  MapPin, 
  AlertCircle,
  ShieldAlert
} from 'lucide-react';

export default function ChatPage({ currentUser }) {
  const { sessionId } = useParams();

  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const messagesEndRef = useRef(null);

  // Load Session details & verify participant authorization
  useEffect(() => {
    async function loadSession() {
      if (!sessionId || !currentUser?.uid) return;
      try {
        setLoadingSession(true);
        const sessData = await getSessionById(sessionId);

        if (!sessData) {
          setError("Study session not found.");
          setLoadingSession(false);
          return;
        }

        // Participant check
        const learnerId = sessData.learnerId || sessData.requesterId;
        const helperId = sessData.helperId;
        if (currentUser.uid !== learnerId && currentUser.uid !== helperId) {
          setUnauthorized(true);
          setLoadingSession(false);
          return;
        }

        setSession(sessData);
        // Ensure chat document exists
        await getOrCreateChat(sessionId, sessData);
      } catch (err) {
        console.error("Error loading chat session:", err);
        setError("Failed to load conversation.");
      } finally {
        setLoadingSession(false);
      }
    }

    loadSession();
  }, [sessionId, currentUser]);

  // Subscribe to real-time chat messages
  useEffect(() => {
    if (!session || unauthorized) return;

    const unsub = subscribeToMessages(sessionId, (msgList) => {
      setMessages(msgList);
    });

    return () => unsub();
  }, [session, sessionId, unauthorized]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isLearner = session && (currentUser?.uid === session.learnerId || currentUser?.uid === session.requesterId);
  const buddyName = session ? (isLearner ? session.helperName : (session.learnerName || session.requesterName)) : 'Study Buddy';
  const isCancelled = session?.status === 'cancelled';

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (isSending || isCancelled) return;

    setError('');
    const clean = inputText.trim();
    if (!clean) return;

    if (clean.length > 1000) {
      setError("Message cannot exceed 1000 characters.");
      return;
    }

    setIsSending(true);
    const senderName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Student';

    try {
      const recipientId = isLearner ? session?.helperId : (session?.learnerId || session?.requesterId);
      await sendMessage(sessionId, currentUser.uid, senderName, clean, recipientId);
      setInputText('');
    } catch (err) {
      console.error("Send message error:", err);
      setError(err.message || "Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessageTime = (createdAt) => {
    if (!createdAt) return 'Sending...';

    let dateObj = null;
    if (createdAt.seconds) {
      dateObj = new Date(createdAt.seconds * 1000);
    } else if (typeof createdAt === 'string') {
      dateObj = new Date(createdAt);
    } else if (createdAt instanceof Date) {
      dateObj = createdAt;
    }

    if (!dateObj || isNaN(dateObj.getTime())) return 'Sending...';

    let hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  if (loadingSession) {
    return (
      <div className="main-content">
        <div className="loading-card">
          <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
          <p>Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="main-content">
        <div className="section-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <ShieldAlert size={48} style={{ color: '#dc2626', marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1c1917', marginBottom: '0.5rem' }}>
            Access Restricted 🛑
          </h2>
          <p style={{ color: '#78716c', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
            You don't have permission to access this chat conversation.
          </p>
          <Link to="/sessions" className="btn-primary" style={{ display: 'inline-flex', width: 'auto', padding: '0.75rem 1.5rem' }}>
            <ArrowLeft size={18} /> Return to Sessions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page-container" style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>
      {/* HEADER BAR */}
      <div className="chat-header-card" style={{
        background: '#fff7ed',
        border: '1px solid #ffedd5',
        borderRadius: '1.25rem 1.25rem 0 0',
        padding: '1.1rem 1.5rem',
        borderBottom: '1px solid #f3e8df'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <Link to="/sessions" className="btn-back" style={{ fontSize: '0.85rem' }}>
            <ArrowLeft size={16} /> Back to Sessions
          </Link>
          <span className={`status-badge-pill ${session.status}`}>
            {session.status === 'upcoming' && 'Upcoming'}
            {session.status === 'completed' && 'Completed ✅'}
            {session.status === 'cancelled' && 'Cancelled ❌'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div className="candidate-avatar sm" style={{ width: '44px', height: '44px', fontSize: '1.15rem' }}>
            {buddyName ? buddyName.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1c1917', margin: 0 }}>
              Chat with {buddyName}
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#ea580c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.15rem' }}>
              <span>Subject: <strong>{session.subject}</strong></span>
              <span>•</span>
              <span>{session.day} ({formatTime12Hour(session.startTime)} – {formatTime12Hour(session.endTime)})</span>
            </div>
          </div>
        </div>

        {/* Meeting Point Shortcut */}
        {session.mode !== 'Online' && (
          <div style={{
            marginTop: '0.75rem',
            background: '#ffffff',
            border: '1px solid #f3e8df',
            borderRadius: '0.6rem',
            padding: '0.45rem 0.85rem',
            fontSize: '0.82rem',
            color: '#b45309',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <MapPin size={14} style={{ color: '#d97706', flexShrink: 0 }} />
            <span>
              <strong>{session.location}</strong> {session.meetingPoint ? `📍 ${session.meetingPoint}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* MESSAGES LIST AREA */}
      <div className="chat-messages-body">
        {error && (
          <div className="alert-banner error" style={{ marginBottom: '0.5rem' }}>
            <AlertCircle size={16} />
            <div>{error}</div>
          </div>
        )}

        {messages.length > 0 ? (
          messages.map((msg, idx) => {
            const isMe = msg.senderId === currentUser?.uid;
            return (
              <div 
                key={msg.id || idx}
                className={`chat-message-row ${isMe ? 'sent' : 'received'}`}
              >
                <span className={`chat-message-sender ${isMe ? 'sent' : 'received'}`}>
                  {isMe ? 'Me' : msg.senderName || buddyName}
                </span>

                <div className={`chat-message-bubble ${isMe ? 'sent' : 'received'}`}>
                  {msg.text}
                </div>

                <span className={`chat-message-time ${isMe ? 'sent' : 'received'}`}>
                  {formatMessageTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#a8a29e',
            gap: '0.5rem',
            textAlign: 'center'
          }}>
            <MessageSquare size={40} style={{ color: '#fed7aa' }} />
            <h4 style={{ fontSize: '1.05rem', color: '#1c1917', fontWeight: 700 }}>No messages yet</h4>
            <p style={{ fontSize: '0.85rem' }}>Say hello to {buddyName} 👋</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA / READ-ONLY BANNER */}
      <div className="chat-input-footer" style={{
        background: '#ffffff',
        border: '1px solid #f3e8df',
        borderRadius: '0 0 1.25rem 1.25rem',
        padding: '1.1rem 1.5rem'
      }}>
        {isCancelled ? (
          <div style={{ textAlign: 'center', color: '#78716c', fontSize: '0.88rem', fontStyle: 'italic' }}>
            This session was cancelled. Chat is read-only.
          </div>
        ) : (
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Press Enter to send)"
              maxLength={1000}
              className="themed-input"
              disabled={isSending}
              style={{
                flex: 1,
                minHeight: '46px',
                height: '46px',
                padding: '0.75rem 1rem',
                resize: 'none',
                fontSize: '0.92rem'
              }}
            />

            <button
              type="submit"
              className="btn-primary"
              disabled={isSending || !inputText.trim()}
              style={{
                width: 'auto',
                padding: '0 1.25rem',
                height: '46px',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
              id="btn-chat-send"
            >
              {isSending ? (
                <span className="spinner"></span>
              ) : (
                <>
                  <Send size={16} /> Send
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
