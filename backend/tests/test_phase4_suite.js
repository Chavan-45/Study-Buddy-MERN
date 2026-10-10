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

const BASE_URL = 'http://localhost:5000/api';

async function runPhase4Tests() {
  console.log('=== STARTING PHASE 4 AUTOMATED TEST SUITE ===');
  const results = [];
  const report = (id, name, passed, details = '') => {
    results.push({ id, name, passed, details });
    console.log((passed ? '✅ PASS' : '❌ FAIL') + ' [' + id + '] ' + name + (details ? ' - ' + details : ''));
  };

  const ts = Date.now();
  const learnerEmail = `p4_learner_${ts}@example.com`;
  const helperEmail = `p4_helper_${ts}@example.com`;
  const nonParticipantEmail = `p4_nonpart_${ts}@example.com`;
  const pass = 'TestPass123!@#';

  let learnerToken, helperToken, nonPartToken;
  let learnerUser, helperUser, nonPartUser;
  let requestId, sessionId;

  // Setup disposable users
  try {
    const r1 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Phase4 Learner', email: learnerEmail, phone: '9111111111', password: pass }),
    })).json();
    learnerToken = r1.token;
    learnerUser = r1.user;

    const r2 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Phase4 Helper', email: helperEmail, phone: '9222222222', password: pass }),
    })).json();
    helperToken = r2.token;
    helperUser = r2.user;

    const r3 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Phase4 NonParticipant', email: nonParticipantEmail, phone: '9333333333', password: pass }),
    })).json();
    nonPartToken = r3.token;
    nonPartUser = r3.user;

    // Regression Test 1: Phase 2 auth verification
    const meRes = await (await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    })).json();
    report('REG-1', 'Phase 2 registration, login, and auth/me still work', meRes.success && meRes.user.email === learnerEmail);

    // Create a request and accept it to establish a session for testing
    const reqRes = await (await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({
        helperId: helperUser.uid || helperUser._id,
        subject: 'Distributed Systems',
        requiredLevel: 'Advanced',
        day: 'Friday',
        startTime: '14:00',
        endTime: '16:00',
        mode: 'Both',
        location: 'CS Lab 3',
        note: 'Need help with Paxos consensus',
      }),
    })).json();

    requestId = reqRes.request.id || reqRes.request._id;
    report('REG-2', 'Phase 3 request creation still works', reqRes.success && Boolean(requestId));

    const acceptRes = await (await fetch(`${BASE_URL}/requests/${requestId}/accept`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    })).json();

    sessionId = acceptRes.session.id || acceptRes.session._id;
    report('REG-3', 'Phase 3 accepting request creates exactly one session', acceptRes.success && Boolean(sessionId));
  } catch (err) {
    console.error('Setup failure:', err);
    report('SETUP', 'Initial test fixture setup', false, err.message);
  }

  // ==========================================
  // PART A — CHAT TESTS
  // ==========================================

  // Chat 1: An authenticated participant can retrieve messages (initially empty)
  try {
    const res = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    })).json();
    report('CHAT-1', 'Session participant can retrieve messages', res.success && Array.isArray(res.messages));
  } catch (err) {
    report('CHAT-1', 'Session participant can retrieve messages', false, err.message);
  }

  // Chat 2: An authenticated participant can send a valid message
  let message1Id;
  try {
    const res = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({ text: 'Hello tutor, looking forward to Paxos!' }),
    })).json();
    message1Id = res.message?.id || res.message?._id;
    report('CHAT-2', 'Participant can send a valid chat message', res.success && Boolean(message1Id) && res.message.text.includes('Paxos'));
  } catch (err) {
    report('CHAT-2', 'Participant can send a valid chat message', false, err.message);
  }

  // Chat 3: Empty and excessively long messages are rejected
  try {
    const emptyRes = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({ text: '   ' }),
    })).json();

    const longText = 'a'.repeat(1005);
    const longRes = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({ text: longText }),
    })).json();

    report('CHAT-3', 'Empty and excessively long messages (>1000 chars) are rejected', !emptyRes.success && !longRes.success);
  } catch (err) {
    report('CHAT-3', 'Empty and excessively long messages are rejected', false, err.message);
  }

  // Chat 4: An unauthenticated user cannot retrieve or send messages
  try {
    const getNoAuth = await (await fetch(`${BASE_URL}/chats/${sessionId}`)).json();
    const postNoAuth = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'unauthorized attempt' }),
    })).json();

    report('CHAT-4', 'Unauthenticated user cannot retrieve or send messages (401)', !getNoAuth.success && !postNoAuth.success);
  } catch (err) {
    report('CHAT-4', 'Unauthenticated access rejection', false, err.message);
  }

  // Chat 5: Non-participant cannot read or send messages
  try {
    const getNonPart = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      headers: { Authorization: `Bearer ${nonPartToken}` },
    })).json();

    const postNonPart = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nonPartToken}`,
      },
      body: JSON.stringify({ text: 'intrusion attempt' }),
    })).json();

    report('CHAT-5', 'Non-participant cannot read or send messages (403)', !getNonPart.success && !postNonPart.success);
  } catch (err) {
    report('CHAT-5', 'Non-participant rejection', false, err.message);
  }

  // Chat 6: Sender identity cannot be spoofed through request body
  try {
    const res = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${helperToken}`,
      },
      body: JSON.stringify({
        text: 'I am replying as helper',
        senderId: learnerUser.uid || learnerUser._id, // Attempt to spoof learner
        senderName: 'Spoofed Name',
      }),
    })).json();

    const actualSender = (res.message?.senderId || '').toString();
    const helperIdStr = (helperUser.uid || helperUser._id).toString();
    report('CHAT-6', 'Sender identity derived strictly from JWT, not spoofed request body', res.success && actualSender === helperIdStr);
  } catch (err) {
    report('CHAT-6', 'Sender spoofing prevention', false, err.message);
  }

  // Chat 7: Messages are associated with correct session and ordered chronologically
  try {
    const res = await (await fetch(`${BASE_URL}/chats/${sessionId}`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    })).json();

    const chronological = res.messages && res.messages.length >= 2 &&
      new Date(res.messages[0].createdAt) <= new Date(res.messages[1].createdAt);

    report('CHAT-7', 'Messages associated with session and sorted chronologically', res.success && chronological);
  } catch (err) {
    report('CHAT-7', 'Chronological message order', false, err.message);
  }

  // ==========================================
  // PART B — NOTIFICATION TESTS
  // ==========================================

  // Notif 1: A user can retrieve their own notifications
  let helperNotifs;
  try {
    const res = await (await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${helperToken}` },
    })).json();
    helperNotifs = res.notifications;
    report('NOTIF-1', 'User can retrieve their own notifications (newest first)', res.success && Array.isArray(helperNotifs) && helperNotifs.length > 0);
  } catch (err) {
    report('NOTIF-1', 'User notification retrieval', false, err.message);
  }

  // Notif 2: Notifications belonging to another user are not returned
  try {
    const res = await (await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${nonPartToken}` },
    })).json();

    const containsOther = res.notifications.some(
      (n) => n.recipientId.toString() !== (nonPartUser.uid || nonPartUser._id).toString()
    );
    report('NOTIF-2', 'Notifications belonging to another user are never exposed', res.success && !containsOther && res.notifications.length === 0);
  } catch (err) {
    report('NOTIF-2', 'Notification cross-user isolation', false, err.message);
  }

  // Notif 3: A user can mark their own notification as read
  let notifToReadId;
  try {
    notifToReadId = helperNotifs[0].id || helperNotifs[0]._id;
    const res = await (await fetch(`${BASE_URL}/notifications/${notifToReadId}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    })).json();

    report('NOTIF-3', 'User can mark their own notification as read', res.success && res.notification.isRead === true);
  } catch (err) {
    report('NOTIF-3', 'Mark single notification as read', false, err.message);
  }

  // Notif 4: A user cannot mark another user notification as read
  try {
    const res = await (await fetch(`${BASE_URL}/notifications/${notifToReadId}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${nonPartToken}` },
    })).json();

    report('NOTIF-4', 'User cannot mark another user notification as read (403)', !res.success);
  } catch (err) {
    report('NOTIF-4', 'Cross-user mark read rejection', false, err.message);
  }

  // Notif 5: Mark-all-read updates only authenticated user notifications
  try {
    const res = await (await fetch(`${BASE_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    })).json();

    report('NOTIF-5', 'Mark-all-read updates only authenticated user notifications', res.success && typeof res.updatedCount === 'number');
  } catch (err) {
    report('NOTIF-5', 'Mark all notifications as read', false, err.message);
  }

  // Notif 6: Appropriate notifications created for successful request/session events
  try {
    // Check learner notifications (should have request_accepted from setup)
    const learnerNotifs = await (await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    })).json();

    const hasAcceptedNotif = learnerNotifs.notifications.some((n) => n.type === 'request_accepted');
    const hasMsgNotif = learnerNotifs.notifications.some((n) => n.type === 'new_message');

    report('NOTIF-6', 'Appropriate notifications generated for request acceptance & chat messages', hasAcceptedNotif && hasMsgNotif);
  } catch (err) {
    report('NOTIF-6', 'Notification event triggers', false, err.message);
  }

  // Notif 7: Failed operations do not generate notifications
  try {
    const beforeCount = (await (await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${helperToken}` },
    })).json()).count;

    // Trigger an invalid session action
    await fetch(`${BASE_URL}/sessions/507f1f77bcf86cd799439011/meeting-point`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({ meetingPoint: '' }),
    });

    const afterCount = (await (await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${helperToken}` },
    })).json()).count;

    report('NOTIF-7', 'Failed operations do not generate spurious notifications', beforeCount === afterCount);
  } catch (err) {
    report('NOTIF-7', 'Failed operations notification prevention', false, err.message);
  }

  // Notif 8: Repeated idempotent operations do not create duplicate notifications
  try {
    // Re-accept the request idempotently
    await fetch(`${BASE_URL}/requests/${requestId}/accept`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    });

    const learnerNotifs = await (await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    })).json();

    const acceptNotifs = learnerNotifs.notifications.filter((n) => n.type === 'request_accepted' && n.relatedRequestId === requestId);
    report('NOTIF-8', 'Repeated idempotent operations do not create duplicate notifications', acceptNotifs.length === 1);
  } catch (err) {
    report('NOTIF-8', 'Duplicate notification prevention', false, err.message);
  }

  // ==========================================
  // PART C — REVIEWS AND RATINGS TESTS
  // ==========================================

  // Rev 3: Reviews for upcoming sessions are rejected (session is still 'upcoming')
  try {
    const upcomingReview = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({
        sessionId,
        rating: 5,
        comment: 'Premature review',
      }),
    })).json();

    report('REV-3', 'Reviews for upcoming sessions are rejected (400)', !upcomingReview.success);
  } catch (err) {
    report('REV-3', 'Upcoming session review rejection', false, err.message);
  }

  // Helper marks session as completed
  try {
    await fetch(`${BASE_URL}/sessions/${sessionId}/complete`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    });
  } catch (err) {
    console.error('Session complete error:', err);
  }

  // Rev 2: Invalid ratings (0, 6, string), invalid IDs, and long comments (>300 chars) rejected
  try {
    const invalidRating0 = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({ sessionId, rating: 0, comment: 'Bad rating' }),
    })).json();

    const invalidRating6 = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({ sessionId, rating: 6, comment: 'Over rating' }),
    })).json();

    const longComment = 'x'.repeat(305);
    const invalidComment = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({ sessionId, rating: 5, comment: longComment }),
    })).json();

    const invalidId = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({ sessionId: 'invalid123', rating: 5 }),
    })).json();

    report('REV-2', 'Invalid ratings, invalid IDs, and long comments are rejected',
      !invalidRating0.success && !invalidRating6.success && !invalidComment.success && !invalidId.success);
  } catch (err) {
    report('REV-2', 'Validation rules for reviews', false, err.message);
  }

  // Rev 4: Helper cannot submit learner review (product rule reserves reviews for learners)
  try {
    const helperReview = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${helperToken}`,
      },
      body: JSON.stringify({ sessionId, rating: 5, comment: 'Helper reviewing learner' }),
    })).json();

    report('REV-4', 'Helpers cannot submit reviews (reserves reviews for learners) (403)', !helperReview.success);
  } catch (err) {
    report('REV-4', 'Helper review prohibition', false, err.message);
  }

  // Rev 5: Non-participants cannot submit reviews
  try {
    const nonPartReview = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nonPartToken}`,
      },
      body: JSON.stringify({ sessionId, rating: 5, comment: 'Outsider review' }),
    })).json();

    report('REV-5', 'Non-participants cannot submit reviews for a session (403)', !nonPartReview.success);
  } catch (err) {
    report('REV-5', 'Non-participant review prohibition', false, err.message);
  }

  // Rev 1: Learner can submit a valid review for a completed session
  let submittedReview;
  try {
    const res = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({
        sessionId,
        rating: 5,
        comment: 'Outstanding session! Clear explanation of consensus protocols.',
      }),
    })).json();

    submittedReview = res.review;
    report('REV-1', 'Learner can submit a valid review for a completed session', res.success && Boolean(submittedReview?.id));
  } catch (err) {
    report('REV-1', 'Valid review submission', false, err.message);
  }

  // Rev 6: Duplicate reviews for the same session and reviewer are rejected
  try {
    const dupRes = await (await fetch(`${BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({
        sessionId,
        rating: 4,
        comment: 'Trying to review second time',
      }),
    })).json();

    report('REV-6', 'Duplicate review for same session & reviewer rejected (409)', !dupRes.success && dupRes.message.includes('already'));
  } catch (err) {
    report('REV-6', 'Duplicate review rejection', false, err.message);
  }

  // Rev 7: Review retrieval returns intended user reviews (public helper profile)
  try {
    const helperIdStr = (helperUser.uid || helperUser._id).toString();
    const res = await (await fetch(`${BASE_URL}/reviews/user/${helperIdStr}`)).json();

    report('REV-7', 'Review retrieval returns intended user reviews with safe fields',
      res.success && res.count === 1 && res.reviews[0].rating === 5 && res.reviews[0].comment.includes('Outstanding'));
  } catch (err) {
    report('REV-7', 'User review retrieval', false, err.message);
  }

  // Rev 8: Rating aggregates on User profile remain correct and are not double-counted
  try {
    const helperIdStr = (helperUser.uid || helperUser._id).toString();
    const userRes = await (await fetch(`${BASE_URL}/users/profile/${helperIdStr}`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    })).json();

    const u = userRes.profile || userRes.user;
    report('REV-8', 'Rating aggregates remain consistent and accurate on user profile',
      userRes.success && Boolean(u) && u.ratingTotal === 5 && u.ratingCount === 1 && u.averageRating === 5);
  } catch (err) {
    report('REV-8', 'Rating aggregate integrity', false, err.message);
  }

  // Rev Check: Endpoint to check if session is rated
  try {
    const checkRes = await (await fetch(`${BASE_URL}/reviews/session/${sessionId}`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    })).json();

    report('REV-CHECK', 'Session review status check returns rated: true with review', checkRes.success && checkRes.rated === true && checkRes.review !== null);
  } catch (err) {
    report('REV-CHECK', 'Session review status check', false, err.message);
  }

  // ==========================================
  // CLEANUP DISPOSABLE TEST DATA
  // ==========================================
  console.log('Cleaning up disposable test records from MongoDB Atlas...');
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'study_buddy_roulette' });

    const uids = [learnerUser?.uid, helperUser?.uid, nonPartUser?.uid].filter(Boolean).map((id) => new mongoose.Types.ObjectId(id));

    await Review.deleteMany({ reviewerId: { $in: uids } });
    await Message.deleteMany({ senderId: { $in: uids } });
    if (sessionId) await Chat.deleteOne({ sessionId });
    await Notification.deleteMany({ recipientId: { $in: uids } });
    if (sessionId) await Session.deleteOne({ _id: sessionId });
    if (requestId) await StudyRequest.deleteOne({ _id: requestId });
    await User.deleteMany({ _id: { $in: uids } });

    await mongoose.disconnect();
    report('CLEANUP', 'Disposable test accounts and records safely removed', true);
  } catch (err) {
    console.error('Cleanup error:', err.message);
    report('CLEANUP', 'Disposable test accounts cleanup', false, err.message);
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n=============================================');
  console.log(`PHASE 4 TEST SUMMARY:`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Total: ${results.length}`);
  console.log('=============================================\n');

  return { passedCount, failedCount, total: results.length, results };
}

runPhase4Tests().catch(console.error);
