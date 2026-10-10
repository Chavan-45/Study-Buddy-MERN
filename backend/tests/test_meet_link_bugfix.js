import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Session from '../src/models/Session.js';
import StudyRequest from '../src/models/StudyRequest.js';
import Notification from '../src/models/Notification.js';
import { normalizeMongoUri } from '../src/config/db.js';
import { validateGoogleMeetUrl } from '../src/controllers/sessionController.js';

const BASE_URL = 'http://localhost:5000/api';

async function runMeetLinkRegressionSuite() {
  console.log('===============================================================');
  console.log('   STUDY BUDDY ROULETTE — GOOGLE MEET LINK RESTORATION TESTS   ');
  console.log('===============================================================\n');

  const results = [];
  const report = (code, title, passed, details = '') => {
    results.push({ code, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${code}] ${title}${details ? ` -> ${details}` : ''}`);
  };

  const ts = Date.now();
  const learnerEmail = `meet_test_learner_${ts}@example.com`;
  const tutorEmail = `meet_test_tutor_${ts}@example.com`;
  const thirdEmail = `meet_test_third_${ts}@example.com`;
  const disposableEmails = [learnerEmail, tutorEmail, thirdEmail];
  const disposableUserIds = [];
  const createdSessionIds = [];
  const createdRequestIds = [];

  try {
    // -------------------------------------------------------------------------
    // 1. UNIT TESTS: GOOGLE MEET URL VALIDATION (HTTPS & meet.google.com)
    // -------------------------------------------------------------------------
    console.log('--- 1. Unit Tests: validateGoogleMeetUrl ---');

    report('U.1', 'Valid HTTPS Google Meet URL accepted',
      validateGoogleMeetUrl('https://meet.google.com/abc-defg-hij'));

    report('U.2', 'Valid URL with query params accepted',
      validateGoogleMeetUrl('https://meet.google.com/abc-defg-hij?authuser=0'));

    report('U.3', 'Non-HTTPS (HTTP) URL rejected',
      !validateGoogleMeetUrl('http://meet.google.com/abc-defg-hij'));

    report('U.4', 'Unrelated domain (Zoom) rejected',
      !validateGoogleMeetUrl('https://zoom.us/j/123456789'));

    report('U.5', 'Non-meet Google domain (google.com/drive) rejected',
      !validateGoogleMeetUrl('https://google.com/drive'));

    report('U.6', 'Empty path (https://meet.google.com/) rejected',
      !validateGoogleMeetUrl('https://meet.google.com/'));

    report('U.7', 'Malformed string rejected',
      !validateGoogleMeetUrl('not-a-valid-url'));

    // -------------------------------------------------------------------------
    // 2. INTEGRATION TESTS WITH DISPOSABLE ACCOUNTS
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Integration Tests: Meeting Link API Flow ---');

    const testPassword = 'Password123!Secure';

    // Register Learner
    const regLearner = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Learner User',
        email: learnerEmail,
        phone: '9876500001',
        password: testPassword,
      }),
    })).json();

    // Register Tutor
    const regTutor = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tutor User',
        email: tutorEmail,
        phone: '9876500002',
        password: testPassword,
      }),
    })).json();

    // Register Third Party
    const regThird = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Third Party User',
        email: thirdEmail,
        phone: '9876500003',
        password: testPassword,
      }),
    })).json();

    const tokenLearner = regLearner.token;
    const tokenTutor = regTutor.token;
    const tokenThird = regThird.token;
    const learnerId = regLearner.user?.uid || regLearner.user?._id;
    const tutorId = regTutor.user?.uid || regTutor.user?._id;
    const thirdId = regThird.user?.uid || regThird.user?._id;
    disposableUserIds.push(learnerId, tutorId, thirdId);

    // Setup Tutor Profile with Online mode & Python skill
    await fetch(`${BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTutor}`,
      },
      body: JSON.stringify({
        name: 'Tutor User',
        department: 'CSE',
        year: '4th Year',
        bio: 'Senior Python and Algorithms tutor.',
        mode: 'Online',
        location: 'Online',
        canHelp: [{ subject: 'Python', level: 'Advanced' }],
        availability: [{ day: 'Tuesday', startTime: '15:00', endTime: '18:00' }],
      }),
    });

    // Setup Learner Profile
    await fetch(`${BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenLearner}`,
      },
      body: JSON.stringify({
        name: 'Learner User',
        department: 'CSE',
        year: '2nd Year',
        bio: 'Learning Python from scratch.',
        mode: 'Online',
        location: 'Online',
        canHelp: [{ subject: 'Java', level: 'Beginner' }],
        availability: [{ day: 'Tuesday', startTime: '15:00', endTime: '18:00' }],
      }),
    });

    // Learner creates an Online study request to Tutor
    const reqRes = await (await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenLearner}`,
      },
      body: JSON.stringify({
        helperId: tutorId,
        subject: 'Python',
        day: 'Tuesday',
        startTime: '15:00',
        endTime: '17:00',
        mode: 'Online',
        message: 'Looking forward to our online Python study session!',
      }),
    })).json();

    const requestId = reqRes.request?.id || reqRes.request?._id;
    createdRequestIds.push(requestId);

    // Tutor accepts the request -> creates an upcoming online session
    const acceptRes = await (await fetch(`${BASE_URL}/requests/${requestId}/accept`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenTutor}` },
    })).json();

    const sessionId = acceptRes.session?.id || acceptRes.session?._id;
    createdSessionIds.push(sessionId);

    report('SETUP', 'Created online study session between Learner and Tutor',
      acceptRes.success && !!sessionId, `Session ID: ${sessionId}`);

    // TEST 1 & 8: Sessions without a link show empty meetingUrl (not-started state)
    const initialSession = await (await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${tokenLearner}` },
    })).json();

    const isNotStarted = initialSession.success &&
      (!initialSession.session?.meetingUrl || initialSession.session.meetingUrl === '');

    report('TEST-1', 'Initial online session has no saved meeting link (not started state)',
      isNotStarted, `meetingUrl: "${initialSession.session?.meetingUrl || ''}"`);

    // TEST 3: Invalid URLs and unrelated domains are rejected
    const badDomainRes = await (await fetch(`${BASE_URL}/sessions/${sessionId}/meeting-link`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTutor}`,
      },
      body: JSON.stringify({ meetingUrl: 'https://zoom.us/j/999888777' }),
    })).json();

    const nonHttpsRes = await (await fetch(`${BASE_URL}/sessions/${sessionId}/meeting-link`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTutor}`,
      },
      body: JSON.stringify({ meetingUrl: 'http://meet.google.com/abc-defg-hij' }),
    })).json();

    const malformedRes = await (await fetch(`${BASE_URL}/sessions/${sessionId}/meeting-link`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTutor}`,
      },
      body: JSON.stringify({ meetingUrl: 'not-a-valid-url' }),
    })).json();

    const rejectionsWork = badDomainRes.success === false &&
      nonHttpsRes.success === false &&
      malformedRes.success === false;

    report('TEST-3', 'Invalid URLs and non-Meet domains rejected with 400 Bad Request',
      rejectionsWork, `Zoom: ${badDomainRes.message}, Non-HTTPS: ${nonHttpsRes.message}`);

    // TEST 2: Tutor can save a valid Google Meet link via PUT /api/sessions/:id/meeting-link
    const validMeetUrl = 'https://meet.google.com/abc-defg-hij';
    const saveRes = await (await fetch(`${BASE_URL}/sessions/${sessionId}/meeting-link`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTutor}`,
      },
      body: JSON.stringify({ meetingUrl: validMeetUrl }),
    })).json();

    const saveSuccess = saveRes.success && saveRes.session?.meetingUrl === validMeetUrl;
    report('TEST-2', 'Tutor saves valid Google Meet link via PUT /api/sessions/:id/meeting-link',
      saveSuccess, `Saved URL: ${saveRes.session?.meetingUrl}`);

    // TEST 4 & 5: Both users see the updated session state after saving
    const learnerGet = await (await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${tokenLearner}` },
    })).json();

    const tutorGet = await (await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${tokenTutor}` },
    })).json();

    const bothSeeLink = learnerGet.session?.meetingUrl === validMeetUrl &&
      tutorGet.session?.meetingUrl === validMeetUrl;

    report('TEST-4', 'Learner retrieves the saved Google Meet URL from authoritative API',
      learnerGet.session?.meetingUrl === validMeetUrl, `Learner sees: ${learnerGet.session?.meetingUrl}`);

    report('TEST-5', 'Both users see synchronized meeting link and status',
      bothSeeLink, `Status: ${learnerGet.session?.onlineSessionStatus}`);

    // TEST 6: Learner cannot edit or change the link through the API (403 Forbidden)
    const learnerTamper = await (await fetch(`${BASE_URL}/sessions/${sessionId}/meeting-link`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenLearner}`,
      },
      body: JSON.stringify({ meetingUrl: 'https://meet.google.com/tamper-link-now' }),
    })).json();

    const learnerForbidden = learnerTamper.success === false;
    report('TEST-6', 'Learner cannot add or edit meeting link (403 Forbidden)',
      learnerForbidden, `Response: ${learnerTamper.message}`);

    // TEST 7: Non-participant (User C) cannot view or modify the session
    const thirdView = await (await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${tokenThird}` },
    })).json();

    const thirdEdit = await (await fetch(`${BASE_URL}/sessions/${sessionId}/meeting-link`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenThird}`,
      },
      body: JSON.stringify({ meetingUrl: 'https://meet.google.com/third-party-hck' }),
    })).json();

    const thirdBlocked = thirdView.success === false && thirdEdit.success === false;
    report('TEST-7', 'Non-participant cannot view or modify session (403 Forbidden)',
      thirdBlocked, `View: ${thirdView.message}, Edit: ${thirdEdit.message}`);

    // TEST 9: Offline sessions reject online meeting link updates
    // Create an offline request and session
    const reqOffline = await (await fetch(`${BASE_URL}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenLearner}`,
      },
      body: JSON.stringify({
        helperId: tutorId,
        subject: 'Python',
        day: 'Tuesday',
        startTime: '15:00',
        endTime: '17:00',
        mode: 'Offline',
        location: 'College Library',
      }),
    })).json();
    const offlineReqId = reqOffline.request?.id || reqOffline.request?._id;
    createdRequestIds.push(offlineReqId);

    const acceptOffline = await (await fetch(`${BASE_URL}/requests/${offlineReqId}/accept`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenTutor}` },
    })).json();
    const offlineSessId = acceptOffline.session?.id || acceptOffline.session?._id;
    createdSessionIds.push(offlineSessId);

    const offlineLinkAttempt = await (await fetch(`${BASE_URL}/sessions/${offlineSessId}/meeting-link`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTutor}`,
      },
      body: JSON.stringify({ meetingUrl: validMeetUrl }),
    })).json();

    const offlineRejected = offlineLinkAttempt.success === false;
    report('TEST-9', 'Offline sessions reject meeting link updates (400 Bad Request)',
      offlineRejected, `Message: ${offlineLinkAttempt.message}`);

    // TEST 10: Session lifecycle preserved: saving link does NOT mark session completed
    const finalSessionCheck = await (await fetch(`${BASE_URL}/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${tokenTutor}` },
    })).json();

    const lifecyclePreserved = finalSessionCheck.session?.status === 'upcoming';
    report('TEST-10', 'Session status remains "upcoming" after saving link (not auto-completed)',
      lifecyclePreserved, `Status: ${finalSessionCheck.session?.status}`);

    // TEST 11: Backward compatibility: PUT /api/sessions/:id/start-online works identically
    const startOnlineCall = await (await fetch(`${BASE_URL}/sessions/${sessionId}/start-online`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTutor}`,
      },
      body: JSON.stringify({ meetingUrl: 'https://meet.google.com/updated-link-xyz' }),
    })).json();

    const startOnlineWorks = startOnlineCall.success && startOnlineCall.session?.meetingUrl === 'https://meet.google.com/updated-link-xyz';
    report('TEST-11', 'Backward-compatible PUT /api/sessions/:id/start-online updates link successfully',
      startOnlineWorks, `Updated URL: ${startOnlineCall.session?.meetingUrl}`);

  } catch (err) {
    console.error('Test error:', err);
    report('ERR', 'Unexpected test failure', false, err.message);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP DISPOSABLE TEST DATA FROM ATLAS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Cleaning Up Disposable Test Records ---');
    try {
      const connUri = normalizeMongoUri(process.env.MONGO_URI);
      await mongoose.connect(connUri, { dbName: 'study_buddy_roulette' });

      if (createdSessionIds.length > 0) {
        await Session.deleteMany({ _id: { $in: createdSessionIds } });
      }
      if (createdRequestIds.length > 0) {
        await StudyRequest.deleteMany({ _id: { $in: createdRequestIds } });
      }
      if (disposableEmails.length > 0) {
        await User.deleteMany({ email: { $in: disposableEmails } });
      }
      if (disposableUserIds.length > 0) {
        await Notification.deleteMany({ recipientId: { $in: disposableUserIds } });
      }
      console.log('🧹 Cleaned up all disposable test users, sessions, and requests.');
      await mongoose.disconnect();
    } catch (cleanErr) {
      console.warn('Cleanup error:', cleanErr.message);
    }
  }

  // Summary
  console.log('\n===============================================================');
  console.log('                   TEST SUITE SUMMARY                          ');
  console.log('===============================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`Total Checks: ${results.length} | Passed: ${results.filter((r) => r.passed).length} | Failed: ${results.filter((r) => !r.passed).length}`);
  if (allPassed) {
    console.log('🎉 ALL GOOGLE MEET LINK TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('⚠️ SOME TESTS FAILED.');
    process.exitCode = 1;
  }
}

runMeetLinkRegressionSuite();
