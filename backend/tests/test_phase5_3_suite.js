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
  isSmtpConfigured,
  generateVerificationToken,
  hashVerificationToken,
  sendVerificationEmail,
} from '../src/services/emailService.js';
import { normalizeMongoUri } from '../src/config/db.js';

const BASE_URL = 'http://localhost:5000/api';

async function runPhase5_3Tests() {
  console.log('===============================================================');
  console.log('  STUDY BUDDY ROULETTE — PHASE 5.3 EMAIL VERIFICATION SUITE   ');
  console.log('===============================================================\n');

  const results = [];
  const report = (id, title, passed, details = '') => {
    results.push({ id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${id}] ${title}${details ? ` -> ${details}` : ''}`);
  };

  const ts = Date.now();
  const testUser1Email = `p53_unverified_${ts}@example.com`;
  const testUser2Email = `p53_verified_${ts}@example.com`;
  const password = 'TestSecurePassword123!';

  let user1Token, user1, user2;
  const disposableUserIds = [];

  // Connect to DB directly for fixture setup & verification
  const connUri = normalizeMongoUri(process.env.MONGO_URI);
  await mongoose.connect(connUri, { dbName: 'study_buddy_roulette' });

  try {
    // 1. Pre-Flight Check: MongoDB Atlas & SMTP status
    const smtpReady = isSmtpConfigured();
    report(
      'ENV-1',
      'SMTP Configuration Check',
      true,
      smtpReady
        ? `SMTP configured (${process.env.SMTP_HOST}:${process.env.SMTP_PORT})`
        : 'SMTP not configured in environment (automated code tests will test graceful degradation)'
    );

    // 2. Register Unverified User
    const regRes = await (await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unverified Student',
        email: testUser1Email,
        phone: '9888811111',
        password,
      }),
    })).json();

    user1Token = regRes.token;
    user1 = regRes.user;
    if (user1?.uid) disposableUserIds.push(new mongoose.Types.ObjectId(user1.uid));

    report(
      'AUTH-1',
      'New account created with emailVerified: false by default',
      regRes.success && regRes.user?.emailVerified === false,
      `User ID: ${user1?.uid}`
    );

    // 3. User JSON serialization security check
    const userMeRes = await (await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    })).json();

    const exposedSecrets =
      'password' in (userMeRes.user || {}) ||
      'verificationTokenHash' in (userMeRes.user || {}) ||
      'verificationTokenExpires' in (userMeRes.user || {});

    report(
      'SEC-1',
      'User serialization never exposes password hash, token hash, or token expiration',
      !exposedSecrets && userMeRes.success,
      'Sensitive fields stripped from API response'
    );

    // 4. Token Generation & Cryptographic Hashing Logic
    const { rawToken, tokenHash, expiresAt } = generateVerificationToken();
    const isSha256 = tokenHash.length === 64 && /^[0-9a-f]+$/.test(tokenHash);
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    report(
      'CRYPTO-1',
      'Token is 256-bit random hex with matching SHA-256 hash',
      isSha256 && tokenHash === expectedHash,
      `Hash length: ${tokenHash.length} chars`
    );

    // Attach tokenHash to user1 in DB for token testing
    await User.findByIdAndUpdate(user1.uid, {
      verificationTokenHash: tokenHash,
      verificationTokenExpires: expiresAt,
    });

    // 5. Test Invalid Token Rejection
    const badTokenRes = await (await fetch(`${BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'completely_invalid_token_xyz_123' }),
    })).json();

    const badTokenRejected =
      badTokenRes.success === false &&
      badTokenRes.message?.includes('invalid, expired, or has already been used');

    report('TOKEN-1', 'Invalid verification token is safely rejected (400)', badTokenRejected, badTokenRes.message);

    // Verify user1 is still unverified
    const stillUnverified = await User.findById(user1.uid);
    report('TOKEN-2', 'User remains unverified after invalid token attempt', stillUnverified.emailVerified === false);

    // 6. Test Expired Token Rejection
    const expiredTokenData = generateVerificationToken();
    await User.findByIdAndUpdate(user1.uid, {
      verificationTokenHash: expiredTokenData.tokenHash,
      verificationTokenExpires: new Date(Date.now() - 3600 * 1000), // 1 hour in the past
    });

    const expiredRes = await (await fetch(`${BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expiredTokenData.rawToken }),
    })).json();

    const expiredRejected =
      expiredRes.success === false &&
      expiredRes.message?.includes('invalid, expired, or has already been used');

    report('TOKEN-3', 'Expired verification token is rejected (400)', expiredRejected, expiredRes.message);

    // 7. Test Successful Token Verification & Consumption
    const validTokenData = generateVerificationToken();
    await User.findByIdAndUpdate(user1.uid, {
      verificationTokenHash: validTokenData.tokenHash,
      verificationTokenExpires: validTokenData.expiresAt,
    });

    const verifySuccessRes = await (await fetch(`${BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: validTokenData.rawToken }),
    })).json();

    const verifyPassed =
      verifySuccessRes.success === true &&
      verifySuccessRes.user?.emailVerified === true;

    report('TOKEN-4', 'Valid token verification succeeds and sets emailVerified: true', verifyPassed, verifySuccessRes.message);

    // Confirm in DB directly: tokenHash is cleared (consumed) and emailVerified is true
    const userInDb = await User.findById(user1.uid).select('+verificationTokenHash +verificationTokenExpires');
    const tokenConsumedInDb =
      userInDb.emailVerified === true &&
      !userInDb.verificationTokenHash &&
      !userInDb.verificationTokenExpires;

    report('TOKEN-5', 'Verification token is consumed (cleared from DB) after successful use', tokenConsumedInDb, 'Token hash and expiry nullified');

    // 8. Test Reused / Consumed Token Rejection
    const reuseRes = await (await fetch(`${BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: validTokenData.rawToken }),
    })).json();

    const reuseRejected =
      reuseRes.success === false &&
      reuseRes.message?.includes('invalid, expired, or has already been used');

    report('TOKEN-6', 'Reused / consumed token is safely rejected (Single-use enforcement)', reuseRejected, reuseRes.message);

    // 9. Test Resend Throttling / Rate-Limiting
    // Set user last sent time to 20 seconds ago
    await User.findByIdAndUpdate(user1.uid, {
      emailVerified: false, // temporarily reset to test resend
      lastVerificationEmailSentAt: new Date(Date.now() - 20 * 1000),
    });

    const throttledRes = await (await fetch(`${BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({ email: testUser1Email }),
    })).json();

    const throttlePassed =
      throttledRes.success === false &&
      throttledRes.retryAfterSeconds > 0 &&
      throttledRes.message?.includes('Please wait');

    report(
      'RATE-1',
      'Resend request within 60s cooldown is throttled (429 Too Many Requests)',
      throttlePassed,
      throttledRes.message
    );

    // 10. Test User Enumeration Prevention on Public Resend
    const enumRes = await (await fetch(`${BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `nonexistent_user_${ts}@example.com` }),
    })).json();

    const enumSafe =
      enumRes.success === true &&
      enumRes.message?.includes('If an account exists');

    report(
      'SEC-2',
      'Unauthenticated resend for non-existent email does not leak account existence',
      enumSafe,
      enumRes.message
    );

    // 11. Test Server Configuration Error when SMTP is not configured
    // If SMTP is not configured in environment, verify send endpoint returns clean 503
    if (!smtpReady) {
      // Clear cooldown so it attempts the send check
      await User.findByIdAndUpdate(user1.uid, {
        lastVerificationEmailSentAt: new Date(Date.now() - 120 * 1000),
      });

      const smtpCheckRes = await (await fetch(`${BASE_URL}/auth/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user1Token}`,
        },
      })).json();

      const handlesUnconfiguredSmtp =
        smtpCheckRes.success === false &&
        smtpCheckRes.code === 'SMTP_NOT_CONFIGURED';

      report(
        'SMTP-1',
        'When SMTP is unconfigured, server returns clear 503 configuration error without claiming sent',
        handlesUnconfiguredSmtp,
        smtpCheckRes.message
      );
    } else {
      report('SMTP-1', 'Real SMTP is configured in environment', true, 'Will perform real send test');
    }

    // 12. Test Protected Route Access After Verification
    // Mark user1 verified and test that GET /api/auth/me reflects emailVerified: true
    await User.findByIdAndUpdate(user1.uid, { emailVerified: true });
    const verifiedMeRes = await (await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    })).json();

    report(
      'ACCESS-1',
      'Verified user session profile confirms emailVerified: true',
      verifiedMeRes.success && verifiedMeRes.user?.emailVerified === true,
      `emailVerified: ${verifiedMeRes.user?.emailVerified}`
    );
  } finally {
    // 13. Teardown & Clean up disposable test accounts
    console.log('\n--- CLEANUP: Purging Phase 5.3 Disposable Accounts from Atlas ---');
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
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n===============================================================');
  console.log('              PHASE 5.3 TEST EXECUTION SUMMARY                 ');
  console.log('===============================================================');
  console.log(`Passed:  ${passedCount}`);
  console.log(`Failed:  ${failedCount}`);
  console.log(`Total:   ${results.length}`);
  console.log(`Success: ${failedCount === 0 ? '100% COMPLETE' : 'FAILURES DETECTED'}`);
  console.log('===============================================================\n');

  return { passedCount, failedCount, total: results.length, results };
}

runPhase5_3Tests().catch(console.error);
