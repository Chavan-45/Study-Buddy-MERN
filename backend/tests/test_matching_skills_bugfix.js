import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import { normalizeMongoUri } from '../src/config/db.js';
import {
  normalizeString,
  getSubjectString,
  isSubjectMatch,
  calculateSubjectScore,
  calculateAvailabilityScore,
  calculateModeScore,
  calculateLocationScore,
  findBestMatches,
} from '../src/utils/matchingAlgorithm.js';

const BASE_URL = 'http://localhost:5000/api';

async function runMatchingBugfixRegressionSuite() {
  console.log('===============================================================');
  console.log('  STUDY BUDDY ROULETTE — MATCHING SKILLS BUGFIX REGRESSION     ');
  console.log('===============================================================\n');

  const results = [];
  const report = (code, title, passed, details = '') => {
    results.push({ code, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${code}] ${title}${details ? ` -> ${details}` : ''}`);
  };

  const ts = Date.now();
  const disposableEmails = [];
  const disposableUserIds = [];

  try {
    // -------------------------------------------------------------------------
    // UNIT TESTS FOR MATCHING ALGORITHM
    // -------------------------------------------------------------------------
    console.log('--- 1. Unit Tests for Matching Algorithm & Skill Normalization ---');

    // Unit 1: Normalization collapses multiple spaces and trims
    const normTest = normalizeString('   Data    Structures   ') === 'data structures';
    report('U.1', 'normalizeString trims and collapses multiple spaces', normTest);

    // Unit 2: Case & whitespace invariance
    const matchCaseSpace = isSubjectMatch('  pYtHoN  ', 'PYTHON');
    report('U.2', 'isSubjectMatch handles casing and surrounding whitespace', matchCaseSpace);

    // Unit 3: Academic aliases and acronyms
    const matchDSA = isSubjectMatch('Data Structures', 'Data Structures & Algorithms');
    const matchML = isSubjectMatch('ML', 'Machine Learning');
    const matchNode = isSubjectMatch('Node.js', 'NodeJS');
    const matchCpp = isSubjectMatch('c++', 'cpp');
    report('U.3', 'isSubjectMatch matches academic aliases (DSA, ML, Node.js, C++)', matchDSA && matchML && matchNode && matchCpp);

    // Unit 4: Negative match — Unrelated skills must NOT match
    const noMatchJavaJS = !isSubjectMatch('Java', 'JavaScript');
    const noMatchPyCivil = !isSubjectMatch('Python', 'Civil Engineering');
    report('U.4', 'Unrelated skills do not match (Java != JavaScript, Python != Civil)', noMatchJavaJS && noMatchPyCivil);

    // Unit 5: calculateSubjectScore returns consistent object shape
    const nullScore = calculateSubjectScore(null, []);
    const shapeValid = nullScore.score === 0 && nullScore.matchedSkill === null;
    report('U.5', 'calculateSubjectScore returns consistent object shape on invalid input', shapeValid);

    // Unit 6: calculateAvailabilityScore returns consistent object shape
    const nullAvail = calculateAvailabilityScore(null, []);
    const availShapeValid = nullAvail.score === 0 && nullAvail.slotMatch === null;
    report('U.6', 'calculateAvailabilityScore returns consistent object shape on invalid input', availShapeValid);

    // -------------------------------------------------------------------------
    // INTEGRATION TESTS WITH DISPOSABLE ACCOUNTS ON LIVE ATLAS DB
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Integration Tests: Matching API Flow (End-to-End) ---');

    const user1Email = `match_test_user1_${ts}@example.com`;
    const user2Email = `match_test_user2_${ts}@example.com`;
    const user3Email = `match_test_user3_${ts}@example.com`;
    disposableEmails.push(user1Email, user2Email, user3Email);

    const testPassword = 'Password123!Secure';

    // Register User 1 (Learner)
    const regRes1 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User One Learner',
        email: user1Email,
        phone: '9876543201',
        password: testPassword,
      }),
    })).json();

    // Register User 2 (Helper with matching skill 'Computer Networks' / 'CN')
    const regRes2 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User Two Helper',
        email: user2Email,
        phone: '9876543202',
        password: testPassword,
      }),
    })).json();

    // Register User 3 (Helper with unrelated skill 'Civil Engineering')
    const regRes3 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User Three Unrelated',
        email: user3Email,
        phone: '9876543203',
        password: testPassword,
      }),
    })).json();

    const token1 = regRes1.token;
    const token2 = regRes2.token;
    const token3 = regRes3.token;
    const id1 = regRes1.user?._id || regRes1.user?.uid;
    const id2 = regRes2.user?._id || regRes2.user?.uid;
    const id3 = regRes3.user?._id || regRes3.user?.uid;
    disposableUserIds.push(id1, id2, id3);

    // Setup User 1 Profile
    await fetch(`${BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`,
      },
      body: JSON.stringify({
        name: 'User One Learner',
        department: 'CSE',
        year: '3rd Year',
        bio: 'Looking for study partners in networking.',
        mode: 'Both',
        location: 'College Library',
        canHelp: [{ subject: 'Python', level: 'Intermediate' }],
        availability: [{ day: 'Monday', startTime: '16:00', endTime: '19:00' }],
      }),
    });

    // Setup User 2 Profile (canHelp: 'Computer Networks', intermediate, Monday 16:00-19:00)
    const updateRes2 = await (await fetch(`${BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token2}`,
      },
      body: JSON.stringify({
        name: 'User Two Helper',
        department: 'CSE',
        year: '4th Year',
        bio: 'Experienced tutor in Computer Networks and protocols.',
        mode: 'Both',
        location: 'College Library',
        canHelp: [{ subject: 'Computer Networks', level: 'Advanced' }],
        availability: [{ day: 'Monday', startTime: '16:00', endTime: '19:00' }],
      }),
    })).json();

    // Setup User 3 Profile (canHelp: 'Civil Engineering', Monday 16:00-19:00)
    await fetch(`${BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token3}`,
      },
      body: JSON.stringify({
        name: 'User Three Unrelated',
        department: 'Civil',
        year: '2nd Year',
        bio: 'Civil engineering tutor and student.',
        mode: 'Both',
        location: 'College Library',
        canHelp: [{ subject: 'Civil Engineering', level: 'Advanced' }],
        availability: [{ day: 'Monday', startTime: '16:00', endTime: '19:00' }],
      }),
    });

    report('PRE', 'Registered and configured 3 test profiles in Atlas', true);

    // TEST A: Two profiles with same skill and compatible preferences produce a match
    const searchResA = await (await fetch(`${BASE_URL}/users/buddies?subject=Computer%20Networks&day=Monday&startTime=16:00&endTime=19:00&mode=Both`, {
      headers: { Authorization: `Bearer ${token1}` },
    })).json();

    const hasUser2A = searchResA.success &&
      Array.isArray(searchResA.candidates) &&
      searchResA.candidates.some((c) => (c.uid || c._id) === id2) &&
      Array.isArray(searchResA.buddies) &&
      searchResA.buddies.some((b) => (b.uid || b._id) === id2);

    report(
      'TEST-A',
      'Two profiles with same skill and compatible preferences produce a match',
      hasUser2A,
      `Candidates count: ${searchResA.count}, Found User 2: ${hasUser2A}`
    );

    // TEST B: Skills differing in capitalization or surrounding spaces match
    const searchResB = await (await fetch(`${BASE_URL}/users/buddies?subject=%20%20computer%20%20networks%20%20`, {
      headers: { Authorization: `Bearer ${token1}` },
    })).json();

    const hasUser2B = searchResB.success &&
      searchResB.candidates.some((c) => (c.uid || c._id) === id2);

    report(
      'TEST-B',
      'Skills differing in capitalization and surrounding spaces match correctly',
      hasUser2B,
      `Found User 2 on '%20%20computer%20%20networks%20%20': ${hasUser2B}`
    );

    // TEST C: Unrelated skills do not receive an incorrect skill match
    const searchResC = await (await fetch(`${BASE_URL}/users/buddies?subject=Civil%20Engineering`, {
      headers: { Authorization: `Bearer ${token1}` },
    })).json();

    const user2InC = searchResC.candidates.some((c) => (c.uid || c._id) === id2);
    const user3InC = searchResC.candidates.some((c) => (c.uid || c._id) === id3);
    report(
      'TEST-C',
      'Unrelated skills do not receive an incorrect match (User 2 not returned for Civil Engineering)',
      !user2InC && user3InC,
      `User 2 excluded: ${!user2InC}, User 3 included: ${user3InC}`
    );

    // TEST D: Current user must never appear in their own results
    const searchResD = await (await fetch(`${BASE_URL}/users/buddies?subject=Python`, {
      headers: { Authorization: `Bearer ${token1}` }, // User 1 has Python in canHelp
    })).json();

    const user1InOwnResults = searchResD.candidates.some((c) => (c.uid || c._id) === id1);
    report(
      'TEST-D',
      'Current user never appears in their own search results (no self-matching)',
      !user1InOwnResults,
      `User 1 in results: ${user1InOwnResults}`
    );

    // TEST E: Existing location, availability, mode filters work as intended
    // Search with Online mode when helper is strictly Offline (test mode conflict)
    // Create candidate 4 who is strictly Offline
    const user4Email = `match_test_offline_${ts}@example.com`;
    disposableEmails.push(user4Email);
    const regRes4 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User Four Offline',
        email: user4Email,
        phone: '9876543204',
        password: testPassword,
      }),
    })).json();
    const token4 = regRes4.token;
    const id4 = regRes4.user?._id || regRes4.user?.uid;
    disposableUserIds.push(id4);

    await fetch(`${BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token4}`,
      },
      body: JSON.stringify({
        name: 'User Four Offline',
        department: 'CSE',
        year: '2nd Year',
        bio: 'In-person offline study only in the library.',
        mode: 'Offline',
        location: 'College Library',
        canHelp: [{ subject: 'Computer Networks', level: 'Advanced' }],
        availability: [{ day: 'Monday', startTime: '16:00', endTime: '19:00' }],
      }),
    });

    // When User 1 searches strictly 'Online', offline-only User 4 should be excluded, but User 2 (mode: Both) should match
    const searchResE = await (await fetch(`${BASE_URL}/users/buddies?subject=Computer%20Networks&mode=Online`, {
      headers: { Authorization: `Bearer ${token1}` },
    })).json();

    const user2InOnline = searchResE.candidates.some((c) => (c.uid || c._id) === id2);
    const user4InOnline = searchResE.candidates.some((c) => (c.uid || c._id) === id4);

    report(
      'TEST-E',
      'Mode filter excludes incompatible mode candidates (Offline-only excluded from Online search)',
      user2InOnline && !user4InOnline,
      `User 2 (Both) included: ${user2InOnline}, User 4 (Offline) excluded: ${!user4InOnline}`
    );

    // TEST F: Unauthenticated request must remain unauthorized (401)
    const unauthRes = await fetch(`${BASE_URL}/users/buddies?subject=Python`);
    const is401 = unauthRes.status === 401;
    report('TEST-F', 'Unauthenticated request to GET /api/users/buddies returns 401 Unauthorized', is401, `Status: ${unauthRes.status}`);

    // TEST G: Matching responses must not expose sensitive user fields
    let noExposedSecrets = true;
    const sampleCandidate = searchResA.candidates[0];
    if (sampleCandidate) {
      if ('password' in sampleCandidate || sampleCandidate.password) noExposedSecrets = false;
      if ('verificationTokenHash' in sampleCandidate) noExposedSecrets = false;
      if ('verificationTokenExpires' in sampleCandidate) noExposedSecrets = false;
    }

    report(
      'TEST-G',
      'Matching responses do not expose sensitive fields (password, tokens)',
      noExposedSecrets,
      `Password/Token absent: ${noExposedSecrets}`
    );

    // TEST H: Backend returns both 'candidates' and 'buddies' properties
    const hasBothArrays = Array.isArray(searchResA.candidates) &&
      Array.isArray(searchResA.buddies) &&
      searchResA.candidates.length === searchResA.buddies.length;

    report(
      'TEST-H',
      'Backend response provides both candidates and buddies keys for frontend compatibility',
      hasBothArrays,
      `Candidates length: ${searchResA.candidates?.length}, Buddies length: ${searchResA.buddies?.length}`
    );

  } catch (err) {
    console.error('Test suite error:', err);
    report('ERR', 'Unexpected test failure', false, err.message);
  } finally {
    // -------------------------------------------------------------------------
    // CLEANUP DISPOSABLE TEST DATA FROM ATLAS
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Cleaning Up Disposable Test Records ---');
    try {
      const connUri = normalizeMongoUri(process.env.MONGO_URI);
      await mongoose.connect(connUri, { dbName: 'study_buddy_roulette' });
      if (disposableEmails.length > 0) {
        const deleteRes = await User.deleteMany({ email: { $in: disposableEmails } });
        console.log(`🧹 Cleaned up ${deleteRes.deletedCount} disposable test user records.`);
      }
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
    console.log('🎉 ALL REGRESSION TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error('⚠️ SOME TESTS FAILED.');
    process.exitCode = 1;
  }
}

runMatchingBugfixRegressionSuite();
