import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import mongoose from 'mongoose';
import crypto from 'crypto';
import User from '../src/models/User.js';
import {
  generateVerificationToken,
  hashVerificationToken,
} from '../src/services/emailService.js';
import { normalizeMongoUri } from '../src/config/db.js';

const BASE_URL = 'http://localhost:5000/api';

async function runSecurityHardeningTests() {
  console.log('===============================================================');
  console.log('  STUDY BUDDY ROULETTE — PHASE 5.4 SECURITY HARDENING SUITE    ');
  console.log('===============================================================\n');

  const results = [];
  const report = (id, title, passed, details = '') => {
    results.push({ id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${id}] ${title}${details ? ` -> ${details}` : ''}`);
  };

  const ts = Date.now();
  const aliceEmail = `p54_alice_${ts}@example.com`;
  const bobEmail = `p54_bob_${ts}@example.com`;
  const password = 'TestSecurePassword123!';

  const disposableUserIds = [];

  // Database connection for direct fixture setup and assertions
  const connUri = normalizeMongoUri(process.env.MONGO_URI);
  await mongoose.connect(connUri, { dbName: 'study_buddy_roulette' });

  try {
    // -------------------------------------------------------------
    // Test 1: Email-Link Scanner Safety (GET Request Does Not Consume Token)
    // -------------------------------------------------------------
    console.log('--- 1. Email-Link Scanner Safety (GET Protection) ---');
    const { rawToken: scannerToken, tokenHash: scannerHash, expiresAt: scannerExp } = generateVerificationToken();

    const reg1 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Scanner Target',
        email: aliceEmail,
        phone: '9888800001',
        password,
      }),
    })).json();

    const aliceId = reg1.user?.uid;
    disposableUserIds.push(new mongoose.Types.ObjectId(aliceId));

    // Manually set verification token on Alice
    await User.findByIdAndUpdate(aliceId, {
      verificationTokenHash: scannerHash,
      verificationTokenExpires: scannerExp,
    });

    // Simulate an email scanner visiting the link via GET request
    const scannerGetRes = await fetch(`${BASE_URL}/auth/verify-email?token=${scannerToken}`, {
      method: 'GET',
    });
    const scannerGetData = await scannerGetRes.json();

    // GET must be rejected (405 or 400) and must NOT consume token
    const getRejected = scannerGetRes.status === 405 || scannerGetRes.status === 400;
    const aliceAfterGet = await User.findById(aliceId).select('+verificationTokenHash');
    const tokenNotConsumedByGet = aliceAfterGet.emailVerified === false && !!aliceAfterGet.verificationTokenHash;

    report(
      'SCAN-1',
      'GET verification request rejected (Method Not Allowed / POST required)',
      getRejected,
      `Status: ${scannerGetRes.status}, Message: ${scannerGetData.message}`
    );
    report(
      'SCAN-2',
      'GET request leaves token intact in database without consuming it',
      tokenNotConsumedByGet,
      `emailVerified: ${aliceAfterGet.emailVerified}, token still in DB: ${!!aliceAfterGet.verificationTokenHash}`
    );

    // -------------------------------------------------------------
    // Test 2: Concurrency-Safe Atomic Token Consumption
    // -------------------------------------------------------------
    console.log('\n--- 2. Concurrency-Safe Atomic Token Consumption ---');
    // Launch two SIMULTANEOUS concurrent POST requests with the same valid token
    const [concurrentReq1, concurrentReq2] = await Promise.all([
      fetch(`${BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: scannerToken }),
      }).then(r => r.json()),
      fetch(`${BASE_URL}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: scannerToken }),
      }).then(r => r.json()),
    ]);

    // Exactly one must succeed, and exactly one must fail
    const oneSuccess = (concurrentReq1.success && !concurrentReq2.success) || (!concurrentReq1.success && concurrentReq2.success);
    const oneFailed = (concurrentReq1.success === false) || (concurrentReq2.success === false);

    report(
      'ATOMIC-1',
      'Parallel race condition: exactly ONE simultaneous request can consume the token',
      oneSuccess && oneFailed,
      `Req1: ${concurrentReq1.success ? '200 OK' : '400 Failed'}, Req2: ${concurrentReq2.success ? '200 OK' : '400 Failed'}`
    );

    // Confirm database state after atomic consumption
    const aliceFinal = await User.findById(aliceId).select('+verificationTokenHash +verificationTokenExpires');
    const atomicDbState =
      aliceFinal.emailVerified === true &&
      !aliceFinal.verificationTokenHash &&
      !aliceFinal.verificationTokenExpires;

    report(
      'ATOMIC-2',
      'Account marked verified and token fields cleared safely in MongoDB',
      atomicDbState,
      `emailVerified: ${aliceFinal.emailVerified}, tokenHash: ${aliceFinal.verificationTokenHash}`
    );

    // -------------------------------------------------------------
    // Test 3: Unauthenticated Denial-of-Service Defense
    // -------------------------------------------------------------
    console.log('\n--- 3. Unauthenticated Denial-of-Service Defense ---');
    // Register Bob
    const reg2 = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Defense',
        email: bobEmail,
        phone: '9888800002',
        password,
      }),
    })).json();

    const bobId = reg2.user?.uid;
    disposableUserIds.push(new mongoose.Types.ObjectId(bobId));

    // Bob has an active verification token generated 10 seconds ago
    const { rawToken: bobRawToken, tokenHash: bobTokenHash, expiresAt: bobExp } = generateVerificationToken();
    await User.findByIdAndUpdate(bobId, {
      verificationTokenHash: bobTokenHash,
      verificationTokenExpires: bobExp,
      lastVerificationEmailSentAt: new Date(Date.now() - 10 * 1000), // sent 10s ago
    });

    // Attacker sends an unauthenticated resend request targeting Bob's email
    const attackerRes = await (await fetch(`${BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: bobEmail }), // Unauthenticated
    })).json();

    // 1) Attacker receives generic message (enumeration defense)
    const enumerationDefended = attackerRes.success === true && attackerRes.message?.includes('If an account exists');

    // 2) Crucially: Bob's existing verification token hash was NOT overwritten or invalidated!
    const bobAfterAttacker = await User.findById(bobId).select('+verificationTokenHash');
    const tokenPreservedAgainstDos = bobAfterAttacker.verificationTokenHash === bobTokenHash;

    report(
      'DOS-1',
      'Unauthenticated resend returns generic message preserving user enumeration defense',
      enumerationDefended,
      attackerRes.message
    );
    report(
      'DOS-2',
      'Unauthenticated resend does NOT overwrite or invalidate legitimate active token',
      tokenPreservedAgainstDos,
      'Active token hash preserved in database'
    );

    // 3) Bob can still successfully verify using his original link!
    const bobVerifyRes = await (await fetch(`${BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: bobRawToken }),
    })).json();

    report(
      'DOS-3',
      'Legitimate user can still verify with active token despite unauthenticated spam attempts',
      bobVerifyRes.success === true && bobVerifyRes.user?.emailVerified === true,
      bobVerifyRes.message
    );

    // -------------------------------------------------------------
    // Test 4: Authenticated Rate-Limiting & Secret Safety
    // -------------------------------------------------------------
    console.log('\n--- 4. Authenticated Rate-Limiting & Secret Safety ---');
    // Set Bob unverified with a recent sent timestamp to test authenticated cooldown
    await User.findByIdAndUpdate(bobId, {
      emailVerified: false,
      lastVerificationEmailSentAt: new Date(Date.now() - 15 * 1000), // 15s ago
    });

    const throttledRes = await (await fetch(`${BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${reg2.token}`,
      },
      body: JSON.stringify({ email: bobEmail }),
    })).json();

    const cooldownEnforced = throttledRes.success === false && throttledRes.retryAfterSeconds > 0;
    report(
      'RATE-1',
      'Authenticated owner receives accurate HTTP 429 with retryAfterSeconds',
      cooldownEnforced,
      `retryAfterSeconds: ${throttledRes.retryAfterSeconds}`
    );

    // Secret Safety: Verify User serialization never leaks sensitive internal fields
    const meRes = await (await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${reg2.token}` },
    })).json();

    const leakedSecrets =
      'password' in (meRes.user || {}) ||
      'verificationTokenHash' in (meRes.user || {}) ||
      'verificationTokenExpires' in (meRes.user || {});

    report(
      'SEC-1',
      'User serialization completely strips password hash and verification tokens',
      !leakedSecrets && meRes.success,
      'All internal fields removed from response'
    );
  } finally {
    // -------------------------------------------------------------
    // Teardown & Clean up disposable test fixtures
    // -------------------------------------------------------------
    console.log('\n--- CLEANUP: Purging Phase 5.4 Disposable Test Records from Atlas ---');
    try {
      if (disposableUserIds.length > 0) {
        const delRes = await User.deleteMany({ _id: { $in: disposableUserIds } });
        report('CLEANUP', 'Disposable test accounts removed from Atlas', true, `Deleted ${delRes.deletedCount} users`);
      }
    } catch (cleanErr) {
      report('CLEANUP', 'Disposable cleanup', false, cleanErr.message);
    }
    await mongoose.disconnect();
  }

  // Summary
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;

  console.log('\n===============================================================');
  console.log('              PHASE 5.4 TEST EXECUTION SUMMARY                 ');
  console.log('===============================================================');
  console.log(`Passed:  ${passedCount}`);
  console.log(`Failed:  ${failedCount}`);
  console.log(`Total:   ${results.length}`);
  console.log(`Success: ${failedCount === 0 ? '100% COMPLETE' : 'FAILURES DETECTED'}`);
  console.log('===============================================================\n');

  return { passedCount, failedCount, total: results.length, results };
}

runSecurityHardeningTests().catch(console.error);
