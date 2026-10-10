import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import VerificationScreen from './VerificationScreen';

export default function ProtectedRoute({ currentUser, initializing, onLogout, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (initializing) {
    return (
      <div className="loading-screen">
        <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }}></div>
        <p style={{ fontWeight: 600, color: 'var(--color-muted)' }}>Verifying session...</p>
      </div>
    );
  }

  // Not authenticated -> Redirect to Login page
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  // Authenticated but email not verified -> Render Verification Screen
  if (!currentUser.emailVerified) {
    return (
      <div className="app-layout-wrapper">
        <Sidebar 
          currentUser={currentUser} 
          onLogout={onLogout} 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
        <div className="app-main-layout">
          <Topbar 
            currentUser={currentUser} 
            onLogout={onLogout} 
            onToggleSidebar={() => setSidebarOpen(prev => !prev)} 
          />
          <main className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <VerificationScreen 
              user={currentUser} 
              onBackToLogin={onLogout} 
              onVerified={(verifiedUser) => {
                if (verifiedUser) {
                  window.dispatchEvent(
                    new CustomEvent('study_buddy_auth_changed', { detail: verifiedUser })
                  );
                }
              }} 
            />
          </main>
        </div>
      </div>
    );
  }

  // Authenticated & Email Verified -> Render Protected Page inside App Shell
  return (
    <div className="app-layout-wrapper">
      <Sidebar 
        currentUser={currentUser} 
        onLogout={onLogout} 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      <div className="app-main-layout">
        <Topbar 
          currentUser={currentUser} 
          onLogout={onLogout} 
          onToggleSidebar={() => setSidebarOpen(prev => !prev)} 
        />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
