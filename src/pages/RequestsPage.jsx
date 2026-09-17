import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import RequestCard from '../components/RequestCard';
import PageHeader from '../components/PageHeader';
import { 
  subscribeToIncomingRequests, 
  subscribeToSentRequests, 
  acceptStudyRequest, 
  rejectStudyRequest 
} from '../services/requestService';
import { 
  Inbox, 
  Send, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2 
} from 'lucide-react';

export default function RequestsPage({ currentUser }) {
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming' | 'sent'
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertMessage, setAlertMessage] = useState(null);

  // Subscribe to real-time incoming and sent requests
  useEffect(() => {
    async function loadRequests() {
      if (!currentUser?.uid) return;

      setLoading(true);

      const unsubIncoming = subscribeToIncomingRequests(currentUser.uid, (data) => {
        setIncomingRequests(data);
        setLoading(false);
      });

      const unsubSent = subscribeToSentRequests(currentUser.uid, (data) => {
        setSentRequests(data);
        setLoading(false);
      });

      return () => {
        unsubIncoming();
        unsubSent();
      };
    }
    loadRequests();
  }, [currentUser]);

  const handleAccept = async (requestId, requestData) => {
    setAlertMessage(null);
    try {
      await acceptStudyRequest(requestId, requestData);
      setAlertMessage({
        type: 'success',
        text: `Request accepted! A new study session for "${requestData.subject}" has been created.`
      });
    } catch (err) {
      console.error("Accept error:", err);
      setAlertMessage({
        type: 'error',
        text: err.message || "Failed to accept study request."
      });
    }
  };

  const handleReject = async (requestId) => {
    setAlertMessage(null);
    try {
      await rejectStudyRequest(requestId);
      setAlertMessage({
        type: 'success',
        text: 'Study request rejected.'
      });
    } catch (err) {
      console.error("Reject error:", err);
      setAlertMessage({
        type: 'error',
        text: err.message || "Failed to reject request."
      });
    }
  };

  const currentRequests = activeTab === 'incoming' ? incomingRequests : sentRequests;
  const pendingCount = incomingRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="requests-page">
      <PageHeader
        title="Study Requests 📩"
        description="Manage incoming requests from peers and track requests you've sent."
        icon={Inbox}
      />

      {alertMessage && (
        <div className={`alert-banner ${alertMessage.type}`} style={{ marginBottom: '1.25rem' }}>
          {alertMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <div>{alertMessage.text}</div>
        </div>
      )}

      {/* TABS CONTAINER */}
      <div className="requests-tabs-wrapper">
        <div className="requests-tabs">
          <button
            type="button"
            className={`requests-tab ${activeTab === 'incoming' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('incoming');
              setAlertMessage(null);
            }}
            id="tab-incoming-requests"
          >
            <Inbox size={18} />
            Incoming Requests
            {pendingCount > 0 && (
              <span className="requests-tab-badge">{pendingCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`requests-tab ${activeTab === 'sent' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('sent');
              setAlertMessage(null);
            }}
            id="tab-sent-requests"
          >
            <Send size={18} />
            Sent Requests
          </button>
        </div>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="loading-card">
          <div className="spinner" style={{ width: '32px', height: '32px' }}></div>
          <p>Syncing study requests...</p>
        </div>
      ) : (
        <div className="requests-list-container">
          {currentRequests.length > 0 ? (
            <div className="requests-cards-stack">
              {currentRequests.map((req) => (
                <RequestCard
                  key={req.id}
                  request={req}
                  type={activeTab}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              ))}
            </div>
          ) : (
            /* POLISHED SHARED EMPTY STATE */
            <div className="app-empty-state">
              <div className="empty-state-icon">
                {activeTab === 'incoming' ? <Inbox size={28} /> : <Send size={28} />}
              </div>
              <h3 className="empty-state-title">
                {activeTab === 'incoming'
                  ? 'No incoming requests'
                  : 'No sent requests'}
              </h3>
              <p className="empty-state-desc">
                {activeTab === 'incoming'
                  ? 'When another student sends you a study request, it will appear here.'
                  : 'Find a Study Buddy and send your first request.'}
              </p>
              {activeTab === 'sent' && (
                <Link to="/find-buddy" className="btn-primary" style={{ textDecoration: 'none' }}>
                  <Sparkles size={18} /> Find a Study Buddy
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
