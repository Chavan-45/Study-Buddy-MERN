import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import FindBuddyPage from './pages/FindBuddyPage';
import RequestsPage from './pages/RequestsPage';
import SessionsPage from './pages/SessionsPage';
import StudyHistoryPage from './pages/StudyHistoryPage';
import ChatPage from './pages/ChatPage';
import ProtectedRoute from './components/ProtectedRoute';
import { auth, isFirebaseConfigured, logoutUser } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setInitializing(false);
      });
      return () => unsubscribe();
    } else {
      setInitializing(false);
    }
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth / Login Page */}
        <Route
          path="/"
          element={
            currentUser && currentUser.emailVerified ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
              />
            )
          }
        />

        {/* Protected Dashboard Page */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              currentUser={currentUser}
              initializing={initializing}
              onLogout={handleLogout}
            >
              <DashboardPage currentUser={currentUser} />
            </ProtectedRoute>
          }
        />

        {/* Protected Student Profile Setup Page */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute
              currentUser={currentUser}
              initializing={initializing}
              onLogout={handleLogout}
            >
              <ProfilePage currentUser={currentUser} />
            </ProtectedRoute>
          }
        />

        {/* Protected Find Study Buddy Page */}
        <Route
          path="/find-buddy"
          element={
            <ProtectedRoute
              currentUser={currentUser}
              initializing={initializing}
              onLogout={handleLogout}
            >
              <FindBuddyPage currentUser={currentUser} />
            </ProtectedRoute>
          }
        />

        {/* Protected Requests Page */}
        <Route
          path="/requests"
          element={
            <ProtectedRoute
              currentUser={currentUser}
              initializing={initializing}
              onLogout={handleLogout}
            >
              <RequestsPage currentUser={currentUser} />
            </ProtectedRoute>
          }
        />

        {/* Protected Sessions Page */}
        <Route
          path="/sessions"
          element={
            <ProtectedRoute
              currentUser={currentUser}
              initializing={initializing}
              onLogout={handleLogout}
            >
              <SessionsPage currentUser={currentUser} />
            </ProtectedRoute>
          }
        />

        {/* Protected Study History Page */}
        <Route
          path="/history"
          element={
            <ProtectedRoute
              currentUser={currentUser}
              initializing={initializing}
              onLogout={handleLogout}
            >
              <StudyHistoryPage currentUser={currentUser} />
            </ProtectedRoute>
          }
        />

        {/* Protected Real-Time Chat Page */}
        <Route
          path="/chat/:sessionId"
          element={
            <ProtectedRoute
              currentUser={currentUser}
              initializing={initializing}
              onLogout={handleLogout}
            >
              <ChatPage currentUser={currentUser} />
            </ProtectedRoute>
          }
        />

        {/* Fallback Catch-all Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
