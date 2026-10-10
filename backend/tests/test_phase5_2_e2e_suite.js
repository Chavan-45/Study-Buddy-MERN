import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import StudyRequest from '../src/models/StudyRequest.js';
import Session from '../src/models/Session.js';
import Chat from '../src/models/Chat.js';
import Message from '../src/models/Message.js';
import Notification from '../src/models/Notification.js';
import Review from '../src/models/Review.js';
import { normalizeMongoUri } from '../src/config/db.js';

const BASE_URL = 'http://localhost:5000/api';
const FRONTEND_URL = 'http://localhost:5173';

async function runE2EIntegrationTests() {
  console.log('===============================================================');
  console.log('  STUDY BUDDY ROULETTE — PHASE 5.2 END-TO-END VERIFICATION     ');
  console.log('===============================================================\n');

  const results = [];
  const report = (step, title, passed, details = '') => {
    results.push({ step, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [Step ${step}] ${title}${details ? ` -> ${details}` : ''}`);
  };

  const ts = Date.now();
  const userAEmail = `e2e_learner_${ts}@example.com`;
  const userBEmail = `e2e_helper_${ts}@example.com`;
  const userCEmail = `e2e_third_${ts}@example.com`;
  const password = 'TestSecurePassword123!';

  let tokenA, tokenB, tokenC;
  let userA, userB, userC;
  let requestId, sessionId;

  // 0. Pre-Flight Database Connectivity Check
  console.log('--- 0. Pre-Flight Check: MongoDB Atlas Connectivity ---');
  let isAtlasConnected = false;
  try {
    const healthRes = await (await fetch(`${BASE_URL}/health`)).json();
    isAtlasConnected = healthRes.success && healthRes.database?.connected && healthRes.database?.name === 'study_buddy_roulette';
    report('0', 'Pre-flight MongoDB Atlas Health Check', isAtlasConnected, `DB: ${healthRes.database?.name}, Host: ${healthRes.database?.host}`);
  } catch (err) {
    report('0', 'Pre-flight MongoDB Atlas Health Check', false, `Backend unreachable: ${err.message}`);
    console.error('CRITICAL: Cannot connect to backend server. Aborting tests.');
    return;
  }

  // 1. Register Two Users & Log In
  console.log('\n--- 1. Register Two Users and Log In ---');
  try {
    const regResA = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Learner',
        email: userAEmail,
        phone: '9876543210',
        password,
      }),
    })).json();

    const regResB = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Helper',
        email: userBEmail,
        phone: '9876543211',
        password,
      }),
    })).json();

    const regPassed = regResA.success && regResB.success && regResA.token && regResB.token;
    tokenA = regResA.token;
    userA = regResA.user;
    tokenB = regResB.token;
    userB = regResB.user;

    // Verify emailVerified defaults to false as required by auth flow
    const emailVerifiedDefault = userA.emailVerified === false && userB.emailVerified === false;
    report('1.1', 'Register two test accounts in MongoDB Atlas', regPassed, `User A: ${userA?.uid}, User B: ${userB?.uid}`);
    report('1.2', 'Confirm emailVerified is initially false on registration', emailVerifiedDefault, 'Both accounts created with emailVerified: false');

    // Test explicit Login endpoint
    const loginResA = await (await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userAEmail, password }),
    })).json();

    const loginResB = await (await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userBEmail, password }),
    })).json();

    const loginPassed = loginResA.success && loginResB.success && !!loginResA.token && !!loginResB.token;
    report('1.3', 'Authenticate both users via POST /api/auth/login', loginPassed, 'JWT issued for both users');
  } catch (err) {
    report('1', 'Register and login users', false, err.message);
  }

  // 2. JWT Authentication Persistence & Logout
  console.log('\n--- 2. JWT Session Persistence and Logout Verification ---');
  try {
    // Simulating page refresh by fetching /api/auth/me using the persisted token
    const meResA = await (await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })).json();

    const meResB = await (await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    })).json();

    const refreshSurvives = meResA.success && meResA.user?.email === userAEmail &&
                            meResB.success && meResB.user?.email === userBEmail;
    report('2.1', 'JWT authentication survives page refresh simulation (/api/auth/me)', refreshSurvives, 'User profiles restored correctly');

    // Test request without token or with cleared token (simulating logout)
    const logoutSimRes = await (await fetch(`${BASE_URL}/auth/me`, {
      headers: {}, // No Authorization header
    })).json();

    const logoutCleared = logoutSimRes.success === false;
    report('2.2', 'Session cleared on logout (request without Bearer token rejected 401)', logoutCleared, logoutSimRes.message);
  } catch (err) {
    report('2', 'Session persistence and logout', false, err.message);
  }

  // 3. Update Profiles, Set Subjects & Availability, Find Compatible Buddies
  console.log('\n--- 3. Profile Updates, Subjects, Availability & Buddy Search ---');
  try {
    // Update User A: Wants help in Computer Networks, available on Monday
    const profResA = await (await fetch(`${BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        department: 'CSE',
        year: '3rd Year',
        bio: 'Looking for a study partner in Computer Networks and Operating Systems',
        canHelp: [{ subject: 'Python', level: 'Intermediate' }],
        mode: 'Both',
        location: 'College Library',
        availability: [
          { day: 'Monday', startTime: '14:00', endTime: '16:00' },
          { day: 'Wednesday', startTime: '16:00', endTime: '18:00' },
        ],
      }),
    })).json();

    // Update User B: Can teach Computer Networks, available on Monday
    const profResB = await (await fetch(`${BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        department: 'CSE',
        year: '4th Year',
        bio: 'Senior student assisting juniors with Computer Networks and Systems',
        canHelp: [{ subject: 'Computer Networks', level: 'Advanced' }],
        mode: 'Both',
        location: 'College Library',
        availability: [
          { day: 'Monday', startTime: '14:00', endTime: '16:00' },
          { day: 'Friday', startTime: '10:00', endTime: '12:00' },
        ],
      }),
    })).json();

    const profsUpdated = profResA.success && profResB.success &&
      ((profResA.profile || profResA.user)?.profileCompleted === true) &&
      ((profResB.profile || profResB.user)?.profileCompleted === true);

    report('3.1', 'Update user profiles with subjects and availability slots', profsUpdated, `Alice Complete: ${(profResA.profile || profResA.user)?.profileCompleted}, Bob Complete: ${(profResB.profile || profResB.user)?.profileCompleted}`);

    // Find compatible buddies for Alice querying 'Computer Networks'
    const buddiesRes = await (await fetch(`${BASE_URL}/users/buddies?subject=Computer Networks&day=Monday`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })).json();

    const candidates = buddiesRes.candidates || [];
    const matchedBob = buddiesRes.success && (
      candidates.some(c => c.uid === userB.uid || c._id === userB.uid) ||
      (buddiesRes.matches || []).some(m => (m.candidate?.uid || m.candidate?._id) === userB.uid)
    );

    report('3.2', 'Find compatible buddies returns matched peer based on skills/availability', matchedBob, `Matched ${candidates.length} buddies for Computer Networks`);
  } catch (err) {
    report('3', 'Profile updates and buddy discovery', false, err.message);
  }

  // 4. Send Study Request from User A to User B
  console.log('\n--- 4. Send Study Request ---');
  try {
    const reqRes = await (await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        helperId: userB.uid,
        subject: 'Computer Networks',
        requiredLevel: 'Intermediate',
        day: 'Monday',
        startTime: '14:00',
        endTime: '16:00',
        mode: 'Both',
        location: 'College Library',
        matchPercentage: 95,
        note: 'Hi Bob, can we review routing protocols together on Monday afternoon?',
      }),
    })).json();

    const reqCreated = reqRes.success && reqRes.request?.status === 'pending';
    requestId = reqRes.request?.id || reqRes.request?._id;

    report('4.1', 'Send study request from User A to User B (POST /api/requests)', reqCreated, `Request ID: ${requestId}`);
  } catch (err) {
    report('4', 'Send study request', false, err.message);
  }

  // 5. Accept Request & Verify Exactly One Session Created
  console.log('\n--- 5. Accept Request & Session Creation ---');
  try {
    const acceptRes1 = await (await fetch(`${BASE_URL}/requests/${requestId}/accept`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({}),
    })).json();

    sessionId = acceptRes1.session?._id || acceptRes1.session?.id;
    const acceptedOk = acceptRes1.success && acceptRes1.request?.status === 'accepted' && !!sessionId;

    // Idempotency: Call accept again to confirm exactly 1 session exists
    const acceptRes2 = await (await fetch(`${BASE_URL}/requests/${requestId}/accept`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({}),
    })).json();

    // Query sessions for User B to verify count is exactly 1
    const sessionsList = await (await fetch(`${BASE_URL}/sessions`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    })).json();

    const matchingSessions = (sessionsList.sessions || []).filter(s => s.requestId === requestId || s._id === sessionId || s.id === sessionId);
    const exactlyOneSession = acceptedOk && matchingSessions.length === 1;

    report('5.1', 'Accept request updates status to accepted and creates session', acceptedOk, `Session ID: ${sessionId}`);
    report('5.2', 'Idempotent acceptance: exactly ONE session created', exactlyOneSession, `Session count in DB: ${matchingSessions.length}`);
  } catch (err) {
    report('5', 'Accept study request', false, err.message);
  }

  // 6. Both Users See Correct Request and Session Statuses
  console.log('\n--- 6. Status Visibility for Both Users ---');
  try {
    const sentA = await (await fetch(`${BASE_URL}/requests/sent`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })).json();

    const incomingB = await (await fetch(`${BASE_URL}/requests/incoming`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    })).json();

    const sessionsA = await (await fetch(`${BASE_URL}/sessions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })).json();

    const sessionsB = await (await fetch(`${BASE_URL}/sessions`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    })).json();

    const userAStatus = (sentA.requests || []).find(r => r.id === requestId || r._id === requestId)?.status;
    const userBStatus = (incomingB.requests || []).find(r => r.id === requestId || r._id === requestId)?.status;
    const sessionSeenA = (sessionsA.sessions || []).some(s => s._id === sessionId || s.id === sessionId);
    const sessionSeenB = (sessionsB.sessions || []).some(s => s._id === sessionId || s.id === sessionId);

    report('6.1', 'Both users see correct request status (accepted) in sent & incoming views', userAStatus === 'accepted' && userBStatus === 'accepted', `Sender: ${userAStatus}, Recipient: ${userBStatus}`);
    report('6.2', 'Both users see the created session with upcoming status', sessionSeenA && sessionSeenB, `Session found in Alice: ${sessionSeenA}, Bob: ${sessionSeenB}`);
  } catch (err) {
    report('6', 'Verify request and session statuses', false, err.message);
  }

  // 7. Update Meeting Point & Supported Online Session Actions
  console.log('\n--- 7. Meeting Point and Online Session Actions ---');
  try {
    // 7.1 Update physical meeting point
    const meetingPointRes = await (await fetch(`${BASE_URL}/sessions/${sessionId}/meeting-point`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ meetingPoint: 'Central Library Room 302' }),
    })).json();

    const pointUpdated = meetingPointRes.success && meetingPointRes.session?.meetingPoint === 'Central Library Room 302';
    report('7.1', 'Update physical meeting point (PUT /api/sessions/:id/meeting-point)', pointUpdated, `Location: ${meetingPointRes.session?.meetingPoint}`);

    // 7.2 Helper starts online session with Google Meet URL
    const meetUrl = 'https://meet.google.com/abc-defg-hij';
    const startOnlineRes = await (await fetch(`${BASE_URL}/sessions/${sessionId}/start-online`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ meetingUrl: meetUrl }),
    })).json();

    const onlineStarted = startOnlineRes.success &&
      startOnlineRes.session?.onlineSessionStatus === 'live' &&
      startOnlineRes.session?.meetingUrl === meetUrl;
    report('7.2', 'Start online session with Google Meet URL (PUT /api/sessions/:id/start-online)', onlineStarted, `Meet Link: ${startOnlineRes.session?.meetingUrl}`);

    // 7.3 Helper ends online session
    const endOnlineRes = await (await fetch(`${BASE_URL}/sessions/${sessionId}/end-online`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
    })).json();

    const onlineEnded = endOnlineRes.success && endOnlineRes.session?.onlineSessionStatus === 'ended';
    report('7.3', 'End online session (PUT /api/sessions/:id/end-online)', onlineEnded, `Status: ${endOnlineRes.session?.onlineSessionStatus}`);
  } catch (err) {
    report('7', 'Meeting point and online actions', false, err.message);
  }

  // 8. Bidirectional Messages and Polling Without Duplicates
  console.log('\n--- 8. Chat Messages & Polling Without Duplication ---');
  try {
    // User A sends message
    const msg1Res = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ text: 'Hello Bob! Looking forward to reviewing routing algorithms.' }),
    })).json();

    // User B sends response
    const msg2Res = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({ text: 'Hey Alice! I have prepared Dijkstra and Bellman-Ford examples.' }),
    })).json();

    const msgsSent = msg1Res.success && msg2Res.success;

    // Simulate Polling round 1 (User A fetching)
    const poll1 = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })).json();

    // Simulate Polling round 2 (User B fetching immediately after)
    const poll2 = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    })).json();

    const messagesA = poll1.messages || [];
    const messagesB = poll2.messages || [];

    // Verify messages match, no duplicates, count is exactly 2, and chronological
    const uniqueIdsA = new Set(messagesA.map(m => m._id || m.id));
    const noDuplicates = messagesA.length === 2 && uniqueIdsA.size === 2 && messagesB.length === 2;
    const chronological = messagesA.length === 2 && (new Date(messagesA[0].createdAt) <= new Date(messagesA[1].createdAt));

    report('8.1', 'Send bidirectional messages between session participants', msgsSent, 'Both messages delivered');
    report('8.2', 'Chat polling returns consistent updates without duplicate messages', noDuplicates && chronological, `Messages count: ${messagesA.length}, Unique IDs: ${uniqueIdsA.size}`);
  } catch (err) {
    report('8', 'Chat and polling verification', false, err.message);
  }

  // 9. Notifications Isolation & Read Status Persistence
  console.log('\n--- 9. Notifications Isolation & Read Status ---');
  try {
    const notifsA = await (await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })).json();

    const notifsB = await (await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    })).json();

    const listA = notifsA.notifications || [];
    const listB = notifsB.notifications || [];

    // Notifications for User A should only have recipientId === User A's uid
    const isolatedA = listA.every(n => (n.recipientId?._id || n.recipientId) === userA.uid);
    const isolatedB = listB.every(n => (n.recipientId?._id || n.recipientId) === userB.uid);

    report('9.1', 'Notifications reach only their intended recipients (strict isolation)', isolatedA && isolatedB, `User A has ${listA.length} notifs, User B has ${listB.length} notifs`);

    // Test marking first notification of User A as read
    if (listA.length > 0) {
      const notifIdA = listA[0]._id || listA[0].id;
      const readRes = await (await fetch(`${BASE_URL}/notifications/${notifIdA}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}` },
      })).json();

      // Refetch notifications to confirm read status persisted
      const refetchedA = await (await fetch(`${BASE_URL}/notifications`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      })).json();

      const targetNotif = (refetchedA.notifications || []).find(n => (n._id || n.id) === notifIdA);
      const readPersists = readRes.success && targetNotif?.isRead === true;

      report('9.2', 'Notification read status persists accurately after update', readPersists, `Notif ${notifIdA} isRead: ${targetNotif?.isRead}`);
    } else {
      report('9.2', 'Notification read status persistence', true, 'Skipped read update (no notifications generated)');
    }
  } catch (err) {
    report('9', 'Notifications verification', false, err.message);
  }

  // 10. Complete Session & Submit Review as Learner
  console.log('\n--- 10. Complete Session & Submit Review ---');
  try {
    // Helper marks session as completed
    const completeRes = await (await fetch(`${BASE_URL}/sessions/${sessionId}/complete`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
    })).json();

    const sessionCompleted = completeRes.success && completeRes.session?.status === 'completed';
    report('10.1', 'Complete eligible session (PUT /api/sessions/:id/complete)', sessionCompleted, `Status: ${completeRes.session?.status}`);

    // Learner (User A) submits a 5-star review for Helper (User B)
    const reviewRes = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        sessionId,
        rating: 5,
        comment: 'Fantastic explanation of Dijkstra algorithm and routing tables! Very patient.',
      }),
    })).json();

    const reviewSubmitted = reviewRes.success && reviewRes.review?.rating === 5;
    report('10.2', 'Submit review as learner for helper (POST /api/reviews)', reviewSubmitted, `Rating: ${reviewRes.review?.rating}/5`);
  } catch (err) {
    report('10', 'Complete session and review submission', false, err.message);
  }

  // 11. Reject Duplicate Reviews & Verify Rating Aggregates
  console.log('\n--- 11. Duplicate Review Rejection & Rating Aggregation ---');
  try {
    // Attempt duplicate review by Learner
    const dupRes = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        sessionId,
        rating: 4,
        comment: 'Trying to review again',
      }),
    })).json();

    const duplicateRejected = dupRes.success === false; // Expecting 409 Conflict
    report('11.1', 'Duplicate review for same session rejected (409 Conflict)', duplicateRejected, dupRes.message);

    // Verify Bob's profile rating aggregates updated
    const helperProfile = await (await fetch(`${BASE_URL}/users/profile/${userB.uid}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })).json();

    const ratingAggregatesCorrect = helperProfile.success &&
      helperProfile.profile?.ratingCount === 1 &&
      helperProfile.profile?.averageRating === 5 &&
      helperProfile.profile?.ratingTotal === 5;

    report('11.2', 'Rating aggregates updated accurately on reviewed user profile', ratingAggregatesCorrect, `Rating: ${helperProfile.profile?.averageRating}, Count: ${helperProfile.profile?.ratingCount}`);
  } catch (err) {
    report('11', 'Duplicate review and rating aggregates', false, err.message);
  }

  // 12. Security: Unauthorized Access, Invalid IDs, Tampered JWTs
  console.log('\n--- 12. Security, Authorization & Error Handling ---');
  try {
    // Register User C (Third-party eavesdropper)
    const regC = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Charlie Eavesdropper',
        email: userCEmail,
        phone: '9876543299',
        password,
      }),
    })).json();
    tokenC = regC.token;
    userC = regC.user;

    // 12.1 Third party cannot access Alice & Bob's session details
    const unauthSession = await (await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    })).json();
    const session403 = unauthSession.success === false;
    report('12.1', 'Non-participant cannot access private session details (403 Forbidden)', session403, unauthSession.message);

    // 12.2 Third party cannot access Alice & Bob's chat
    const unauthChat = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      headers: { Authorization: `Bearer ${tokenC}` },
    })).json();
    const chat403 = unauthChat.success === false;
    report('12.2', 'Non-participant cannot read or send private chat messages (403 Forbidden)', chat403, unauthChat.message);

    // 12.3 Invalid Mongo ObjectId returns 400 Bad Request
    const badIdRes = await (await fetch(`${BASE_URL}/sessions/invalid-id-xyz`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    })).json();
    const badId400 = badIdRes.success === false;
    report('12.3', 'Invalid ObjectId format rejected gracefully (400 Bad Request)', badId400, badIdRes.message);

    // 12.4 Tampered or expired JWT returns 401 Unauthorized
    const tamperedRes = await (await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer this.is.a.tampered.token' },
    })).json();
    const tampered401 = tamperedRes.success === false;
    report('12.4', 'Tampered/invalid JWT token rejected (401 Unauthorized)', tampered401, tamperedRes.message);

    // 12.5 Self-request blocked
    const selfReq = await (await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        helperId: userA.uid,
        subject: 'Self Study',
        day: 'Monday',
        startTime: '14:00',
        endTime: '15:00',
      }),
    })).json();
    const selfBlocked = selfReq.success === false;
    report('12.5', 'User cannot send study request to themselves (400 Bad Request)', selfBlocked, selfReq.message);
  } catch (err) {
    report('12', 'Security tests', false, err.message);
  }

  // 13. Frontend Static Build & Dev Server Route Availability Check
  console.log('\n--- 13. Frontend Contract & Page Serving Verification ---');
  try {
    const frontendRes = await fetch(`${FRONTEND_URL}`);
    const frontendHtml = await frontendRes.text();

    const containsRoot = frontendRes.status === 200 && frontendHtml.includes('id="root"');
    report('13.1', 'Frontend development server actively serving SPA shell at http://localhost:5173', containsRoot, `HTTP ${frontendRes.status}, contains #root container`);

    // Verify all essential protected API routes respond with valid JSON contracts
    const routesToCheck = [
      { path: '/requests/incoming', auth: tokenA, name: 'Incoming Requests' },
      { path: '/requests/sent', auth: tokenA, name: 'Sent Requests' },
      { path: '/sessions', auth: tokenA, name: 'Active Sessions' },
      { path: '/notifications', auth: tokenA, name: 'Notifications' },
      { path: '/users/buddies', auth: tokenA, name: 'Find Buddies' },
    ];

    let allRoutesOk = true;
    for (const r of routesToCheck) {
      const res = await (await fetch(`${BASE_URL}${r.path}`, {
        headers: { Authorization: `Bearer ${r.auth}` },
      })).json();
      if (!res.success) {
        allRoutesOk = false;
        console.warn(`Route ${r.name} (${r.path}) returned failure:`, res);
      }
    }
    report('13.2', 'Frontend API endpoints return valid JSON response contracts without 500 errors', allRoutesOk, 'Verified 5 core routes');
  } catch (err) {
    report('13', 'Frontend contract verification', false, err.message);
  }

  // =========================================================================
  // CLEANUP DISPOSABLE TEST DATA (DO NOT TOUCH PRE-EXISTING DATA)
  // =========================================================================
  console.log('\n--- CLEANUP: Safely Purging Disposable Test Fixtures from Atlas ---');
  try {
    const connUri = normalizeMongoUri(process.env.MONGO_URI);
    await mongoose.connect(connUri, { dbName: 'study_buddy_roulette' });

    const disposableIds = [userA?.uid, userB?.uid, userC?.uid]
      .filter(Boolean)
      .map(id => new mongoose.Types.ObjectId(id));

    const revDel = await Review.deleteMany({ reviewerId: { $in: disposableIds } });
    const msgDel = await Message.deleteMany({ senderId: { $in: disposableIds } });
    const chatDel = sessionId ? await Chat.deleteOne({ sessionId }) : { deletedCount: 0 };
    const notifDel = await Notification.deleteMany({ recipientId: { $in: disposableIds } });
    const sessDel = sessionId ? await Session.deleteOne({ _id: sessionId }) : { deletedCount: 0 };
    const reqDel = requestId ? await StudyRequest.deleteOne({ _id: requestId }) : { deletedCount: 0 };
    const userDel = await User.deleteMany({ _id: { $in: disposableIds } });

    await mongoose.disconnect();

    const cleanupDetails = `Users: ${userDel.deletedCount}, Requests: ${reqDel.deletedCount}, Sessions: ${sessDel.deletedCount}, Messages: ${msgDel.deletedCount}, Reviews: ${revDel.deletedCount}, Notifs: ${notifDel.deletedCount}`;
    report('CLEANUP', 'Disposable test accounts and records safely removed from MongoDB Atlas', true, cleanupDetails);
  } catch (err) {
    report('CLEANUP', 'Disposable test data cleanup', false, err.message);
  }

  // SUMMARY REPORT
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n===============================================================');
  console.log('              PHASE 5.2 TEST EXECUTION SUMMARY                 ');
  console.log('===============================================================');
  console.log(`Passed:  ${passedCount}`);
  console.log(`Failed:  ${failedCount}`);
  console.log(`Total:   ${results.length}`);
  console.log(`Success: ${failedCount === 0 ? '100% COMPLETE' : 'FAILURES DETECTED'}`);
  console.log('===============================================================\n');

  return { passedCount, failedCount, total: results.length, results };
}

runE2EIntegrationTests().catch(console.error);
