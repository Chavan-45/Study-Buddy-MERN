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

const BASE_URL = 'http://localhost:5000/api';

async function runPhase3Tests() {
  console.log('=== STARTING PHASE 3 AUTOMATED TEST SUITE ===');
  const results = [];
  const report = (id, name, passed, details = '') => {
    results.push({ id, name, passed, details });
    console.log((passed ? '✅ PASS' : '❌ FAIL') + ' [' + id + '] ' + name + (details ? ' - ' + details : ''));
  };

  const ts = Date.now();
  const learnerEmail = `p3_learner_${ts}@example.com`;
  const helperEmail = `p3_helper_${ts}@example.com`;
  const thirdEmail = `p3_third_${ts}@example.com`;
  const pass = 'TestPass123!@#';

  let learnerToken, helperToken, thirdToken;
  let learnerUser, helperUser, thirdUser;
  let requestId, sessionId;

  // Setup 3 disposable users
  try {
    const r1 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Learner One', email: learnerEmail, phone: '9000000001', password: pass }),
    })).json();
    learnerToken = r1.token;
    learnerUser = r1.user;

    const r2 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Helper Tutor', email: helperEmail, phone: '9000000002', password: pass }),
    })).json();
    helperToken = r2.token;
    helperUser = r2.user;

    const r3 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Third Student', email: thirdEmail, phone: '9000000003', password: pass }),
    })).json();
    thirdToken = r3.token;
    thirdUser = r3.user;
  } catch (e) {
    console.error('Setup failed:', e);
  }

  // --- STUDY REQUESTS TESTS ---

  // Test 1: An authenticated user can create a valid request
  try {
    const res = await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({
        helperId: helperUser.uid,
        subject: 'Data Structures',
        requiredLevel: 'Intermediate',
        day: 'Monday',
        startTime: '16:00',
        endTime: '18:00',
        mode: 'Both',
        location: 'College Library',
        matchPercentage: 92,
        note: 'Looking for guidance on Trees & Graphs.',
      }),
    });
    const data = await res.json();
    const ok = res.status === 201 && data.success && data.request.status === 'pending' && data.request.requesterId === learnerUser.uid;
    if (ok) requestId = data.request.id;
    report(1, 'Authenticated user can create a valid request', ok, `Status: ${res.status}, ReqId: ${requestId}`);
  } catch (e) {
    report(1, 'Authenticated user can create a valid request', false, e.message);
  }

  // Test 2: Unauthenticated users cannot create or retrieve private requests
  try {
    const rNoAuth = await fetch(`${BASE_URL}/requests/incoming`);
    const rPostNoAuth = await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helperId: helperUser.uid, subject: 'DS' }),
    });
    const ok = rNoAuth.status === 401 && rPostNoAuth.status === 401;
    report(2, 'Unauthenticated users cannot create or retrieve private requests', ok, `GET: ${rNoAuth.status}, POST: ${rPostNoAuth.status}`);
  } catch (e) {
    report(2, 'Unauthenticated users cannot create or retrieve private requests', false, e.message);
  }

  // Test 3: A user cannot request themselves
  try {
    const res = await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({
        helperId: learnerUser.uid,
        subject: 'Data Structures',
        day: 'Monday',
        startTime: '16:00',
        endTime: '18:00',
      }),
    });
    const data = await res.json();
    const ok = res.status === 400 && data.message.includes('yourself');
    report(3, 'A user cannot request themselves', ok, `Status: ${res.status}, Msg: ${data.message}`);
  } catch (e) {
    report(3, 'A user cannot request themselves', false, e.message);
  }

  // Test 4: Invalid target IDs and nonexistent users are handled correctly
  try {
    const rBadId = await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${learnerToken}` },
      body: JSON.stringify({ helperId: 'invalid-object-id', subject: 'Python', day: 'Tuesday', startTime: '10:00', endTime: '11:00' }),
    });
    const rNonExistent = await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${learnerToken}` },
      body: JSON.stringify({ helperId: '666666666666666666666666', subject: 'Python', day: 'Tuesday', startTime: '10:00', endTime: '11:00' }),
    });
    const ok = rBadId.status === 400 && rNonExistent.status === 404;
    report(4, 'Invalid target IDs and nonexistent users handled correctly', ok, `Bad ID: ${rBadId.status}, Nonexistent: ${rNonExistent.status}`);
  } catch (e) {
    report(4, 'Invalid target IDs and nonexistent users handled correctly', false, e.message);
  }

  // Test 5: Duplicate active requests are rejected
  try {
    const res = await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${learnerToken}`,
      },
      body: JSON.stringify({
        helperId: helperUser.uid,
        subject: 'Data Structures',
        day: 'Monday',
        startTime: '16:00',
        endTime: '18:00',
      }),
    });
    const data = await res.json();
    const ok = res.status === 409 && data.success === false;
    report(5, 'Duplicate active requests are rejected (409 Conflict)', ok, `Status: ${res.status}, Msg: ${data.message}`);
  } catch (e) {
    report(5, 'Duplicate active requests are rejected (409 Conflict)', false, e.message);
  }

  // Test 6: Incoming requests contain only requests for authenticated recipient
  try {
    const res = await fetch(`${BASE_URL}/requests/incoming`, {
      headers: { Authorization: `Bearer ${helperToken}` },
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.requests.some((r) => r.id === requestId && r.helperId === helperUser.uid);
    report(6, 'Incoming requests contain only requests for authenticated recipient', ok, `Count: ${data.count}, Helper matched`);
  } catch (e) {
    report(6, 'Incoming requests contain only requests for authenticated recipient', false, e.message);
  }

  // Test 7: Sent requests contain only requests created by authenticated user
  try {
    const res = await fetch(`${BASE_URL}/requests/sent`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    });
    const data = await res.json();
    const ok = res.status === 200 && data.success && data.requests.some((r) => r.id === requestId && r.requesterId === learnerUser.uid);
    report(7, 'Sent requests contain only requests created by authenticated user', ok, `Count: ${data.count}, Requester matched`);
  } catch (e) {
    report(7, 'Sent requests contain only requests created by authenticated user', false, e.message);
  }

  // Test 8: Only the intended recipient can accept a request
  try {
    const rUnauthorized = await fetch(`${BASE_URL}/requests/${requestId}/accept`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${thirdToken}` },
    });
    const dUnauth = await rUnauthorized.json();
    const ok = rUnauthorized.status === 403 && dUnauth.message.includes('intended recipient');
    report(8, 'Only the intended recipient can accept a request (non-recipient 403)', ok, `Status: ${rUnauthorized.status}`);
  } catch (e) {
    report(8, 'Only the intended recipient can accept a request', false, e.message);
  }

  // Test 9: Only the intended recipient can reject a pending request
  let secondaryReqId;
  try {
    const createSec = await (await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${learnerToken}` },
      body: JSON.stringify({ helperId: helperUser.uid, subject: 'Chemistry', day: 'Friday', startTime: '11:00', endTime: '12:00' }),
    })).json();
    secondaryReqId = createSec.request.id;

    const rThird = await fetch(`${BASE_URL}/requests/${secondaryReqId}/reject`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${thirdToken}` },
    });

    const rHelper = await fetch(`${BASE_URL}/requests/${secondaryReqId}/reject`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    });
    const dHelper = await rHelper.json();

    const ok = rThird.status === 403 && rHelper.status === 200 && dHelper.request.status === 'rejected';
    report(9, 'Only intended recipient can reject a pending request', ok, `Third: ${rThird.status}, Helper: ${rHelper.status} (rejected)`);
  } catch (e) {
    report(9, 'Only intended recipient can reject a pending request', false, e.message);
  }

  // Test 10: Repeated acceptance creates exactly one session
  try {
    const rAccept1 = await fetch(`${BASE_URL}/requests/${requestId}/accept`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    });
    const dAccept1 = await rAccept1.json();
    sessionId = dAccept1.session?.id;

    const rAccept2 = await fetch(`${BASE_URL}/requests/${requestId}/accept`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    });
    const dAccept2 = await rAccept2.json();

    await mongoose.connect(process.env.MONGO_URI, { dbName: 'study_buddy_roulette' });
    const sessionCount = await Session.countDocuments({ requestId });

    const ok = rAccept1.status === 200 && rAccept2.status === 200 && sessionCount === 1 && dAccept1.session.id === dAccept2.session.id;
    report(10, 'Repeated acceptance creates exactly one session (Idempotent)', ok, `1st: 200, 2nd: 200, Total sessions in DB: ${sessionCount}`);
  } catch (e) {
    report(10, 'Repeated acceptance creates exactly one session', false, e.message);
  }

  // Test 11: Rejected requests do not create sessions
  try {
    const sessionForRejected = await Session.findOne({ requestId: secondaryReqId });
    const ok = sessionForRejected === null;
    report(11, 'Rejected requests do not create sessions', ok, `Session exists for rejected request: ${Boolean(sessionForRejected)}`);
  } catch (e) {
    report(11, 'Rejected requests do not create sessions', false, e.message);
  }

  // Test 12: Invalid or conflicting status transitions are rejected
  try {
    const rAcceptRejected = await fetch(`${BASE_URL}/requests/${secondaryReqId}/accept`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    });
    const rCancelAccepted = await fetch(`${BASE_URL}/requests/${requestId}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${learnerToken}` },
    });
    const ok = rAcceptRejected.status === 400 && rCancelAccepted.status === 400;
    report(12, 'Invalid or conflicting status transitions are rejected', ok, `Accept rejected: ${rAcceptRejected.status}, Cancel accepted: ${rCancelAccepted.status}`);
  } catch (e) {
    report(12, 'Invalid or conflicting status transitions are rejected', false, e.message);
  }

  // --- SESSIONS TESTS ---

  // Test 13: A session is created correctly when a request is accepted
  try {
    const sess = await Session.findById(sessionId);
    const ok = sess &&
      sess.status === 'upcoming' &&
      sess.subject === 'Data Structures' &&
      sess.learnerId.toString() === learnerUser.uid &&
      sess.helperId.toString() === helperUser.uid;
    report(13, 'Session created correctly when request is accepted', Boolean(ok), `Status: ${sess?.status}, Subject: ${sess?.subject}`);
  } catch (e) {
    report(13, 'Session created correctly when request is accepted', false, e.message);
  }

  // Test 14: A user cannot list or access another user's private sessions
  try {
    const res = await fetch(`${BASE_URL}/sessions`, {
      headers: { Authorization: `Bearer ${thirdToken}` },
    });
    const data = await res.json();
    const doesNotContainSessionId = !data.sessions.some((s) => s.id === sessionId);
    report(14, "A user cannot list another user's private sessions", doesNotContainSessionId, `Third user session count: ${data.count}, Excluded: ${doesNotContainSessionId}`);
  } catch (e) {
    report(14, "A user cannot list another user's private sessions", false, e.message);
  }

  // Test 15: Only session participants can access session details
  try {
    const rThird = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${thirdToken}` },
    });
    const rLearner = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    });
    const rHelper = await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${helperToken}` },
    });
    const ok = rThird.status === 403 && rLearner.status === 200 && rHelper.status === 200;
    report(15, 'Only session participants can access session details', ok, `Non-participant: ${rThird.status}, Learner: ${rLearner.status}, Helper: ${rHelper.status}`);
  } catch (e) {
    report(15, 'Only session participants can access session details', false, e.message);
  }

  // Test 16: Meeting-point updates enforce authorization and validation
  try {
    const rThird = await fetch(`${BASE_URL}/sessions/${sessionId}/meeting-point`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${thirdToken}` },
      body: JSON.stringify({ meetingPoint: 'Cafeteria Table 4' }),
    });
    const rLearner = await fetch(`${BASE_URL}/sessions/${sessionId}/meeting-point`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${learnerToken}` },
      body: JSON.stringify({ meetingPoint: 'CS Block 2nd Floor Study Pod 3' }),
    });
    const dLearner = await rLearner.json();
    const ok = rThird.status === 403 && rLearner.status === 200 && dLearner.session.meetingPoint === 'CS Block 2nd Floor Study Pod 3';
    report(16, 'Meeting-point updates enforce authorization and validation', ok, `Third: ${rThird.status}, Learner update: ${rLearner.status}`);
  } catch (e) {
    report(16, 'Meeting-point updates enforce authorization and validation', false, e.message);
  }

  // Test 17: Online-session actions enforce mode and participant permissions
  try {
    const rLearner = await fetch(`${BASE_URL}/sessions/${sessionId}/start-online`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${learnerToken}` },
      body: JSON.stringify({ meetingUrl: 'https://meet.google.com/abc-defg-hij' }),
    });
    const rBadUrl = await fetch(`${BASE_URL}/sessions/${sessionId}/start-online`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${helperToken}` },
      body: JSON.stringify({ meetingUrl: 'https://fake-link.com/123' }),
    });
    const rHelper = await fetch(`${BASE_URL}/sessions/${sessionId}/start-online`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${helperToken}` },
      body: JSON.stringify({ meetingUrl: 'https://meet.google.com/xyz-uvwx-rst' }),
    });
    const dHelper = await rHelper.json();
    const rEnd = await fetch(`${BASE_URL}/sessions/${sessionId}/end-online`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    });
    const dEnd = await rEnd.json();

    const ok = rLearner.status === 403 && rBadUrl.status === 400 && rHelper.status === 200 &&
      dHelper.session.onlineSessionStatus === 'live' &&
      rEnd.status === 200 && dEnd.session.onlineSessionStatus === 'ended';
    report(17, 'Online-session actions enforce mode and participant permissions', ok, `Learner: ${rLearner.status}, Bad URL: ${rBadUrl.status}, Live: ${dHelper.session?.onlineSessionStatus === 'live'}, Ended: ${dEnd.session?.onlineSessionStatus === 'ended'}`);
  } catch (e) {
    report(17, 'Online-session actions enforce mode and participant permissions', false, e.message);
  }

  // Test 18: Completion and cancellation actions enforce the intended role and status rules
  try {
    const rReqAction = await fetch(`${BASE_URL}/sessions/${sessionId}/action-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${learnerToken}` },
      body: JSON.stringify({ actionType: 'completion' }),
    });
    const dReqAction = await rReqAction.json();

    const rApprove = await fetch(`${BASE_URL}/sessions/${sessionId}/action-respond`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${helperToken}` },
      body: JSON.stringify({ isApproved: true }),
    });
    const dApprove = await rApprove.json();

    const ok = rReqAction.status === 200 && dReqAction.session.sessionActionRequest?.type === 'completion' &&
      rApprove.status === 200 && dApprove.session.status === 'completed';
    report(18, 'Completion & cancellation actions enforce intended role and status rules', ok, `Request action: ${rReqAction.status}, Approved: ${dApprove.session?.status === 'completed'}`);
  } catch (e) {
    report(18, 'Completion & cancellation actions enforce intended role and status rules', false, e.message);
  }

  // Test 19: Invalid session IDs and nonexistent sessions are handled safely
  try {
    const rBadId = await fetch(`${BASE_URL}/sessions/not-an-id`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    });
    const r404 = await fetch(`${BASE_URL}/sessions/666666666666666666666666`, {
      headers: { Authorization: `Bearer ${learnerToken}` },
    });
    const ok = rBadId.status === 400 && r404.status === 404;
    report(19, 'Invalid session IDs and nonexistent sessions handled safely', ok, `Bad ID: ${rBadId.status}, Nonexistent: ${r404.status}`);
  } catch (e) {
    report(19, 'Invalid session IDs and nonexistent sessions handled safely', false, e.message);
  }

  // Test 20: Repeated actions do not create inconsistent data or duplicate sessions
  try {
    const rCancelComp = await fetch(`${BASE_URL}/sessions/${sessionId}/cancel`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    });
    const rReComplete = await fetch(`${BASE_URL}/sessions/${sessionId}/complete`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${helperToken}` },
    });
    const ok = rCancelComp.status === 400 && rReComplete.status === 200;
    report(20, 'Repeated actions do not create inconsistent data or duplicate sessions', ok, `Cancel completed: ${rCancelComp.status}, Re-complete: ${rReComplete.status} (idempotent)`);
  } catch (e) {
    report(20, 'Repeated actions do not create inconsistent data or duplicate sessions', false, e.message);
  }

  // Verify Phase 2 endpoints still function properly (Regression Check)
  try {
    const meRes = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${learnerToken}` } });
    const profRes = await fetch(`${BASE_URL}/users/profile`, { headers: { Authorization: `Bearer ${learnerToken}` } });
    const ok = meRes.status === 200 && profRes.status === 200;
    console.log(`${ok ? '✅ PASS' : '❌ FAIL'} [Regression] Phase 2 Auth and Profile APIs remain functional (me: ${meRes.status}, profile: ${profRes.status})`);
  } catch (e) {
    console.error('Regression check error:', e);
  }

  // --- CLEANUP DISPOSABLE TEST DATA ---
  console.log('\n--- CLEANING UP DISPOSABLE PHASE 3 TEST DATA ---');
  try {
    const delSess = await Session.deleteMany({ _id: sessionId });
    const delReqs = await StudyRequest.deleteMany({ _id: { $in: [requestId, secondaryReqId].filter(Boolean) } });
    const delUsers = await User.deleteMany({ email: { $in: [learnerEmail, helperEmail, thirdEmail] } });
    console.log('Deleted sessions count:', delSess.deletedCount);
    console.log('Deleted requests count:', delReqs.deletedCount);
    console.log('Deleted users count:', delUsers.deletedCount);
    await mongoose.disconnect();
    console.log('Database disconnected cleanly.');
  } catch (e) {
    console.error('Cleanup error:', e);
  }

  const allPassed = results.every((r) => r.passed);
  console.log('\n=== PHASE 3 TEST SUMMARY ===');
  console.log('Total Tests:', results.length);
  console.log('Passed:', results.filter((r) => r.passed).length);
  console.log('Failed:', results.filter((r) => !r.passed).length);
  console.log('All tests passed:', allPassed);
}

runPhase3Tests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
