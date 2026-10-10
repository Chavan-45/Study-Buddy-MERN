import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import {
  isSmtpConfigured,
  getSanitizedSmtpConfig,
  verifySmtpConnection,
} from '../src/services/emailService.js';

async function runDiagnostic() {
  console.log('====================================================');
  console.log('   SAFE SMTP DIAGNOSTIC — STUDY BUDDY ROULETTE       ');
  console.log('====================================================\n');

  console.log('1. Environment Configuration Presence:');
  console.log('   - SMTP_HOST:', process.env.SMTP_HOST || '(not set)');
  console.log('   - SMTP_PORT:', process.env.SMTP_PORT || '(not set)');
  console.log('   - SMTP_SECURE:', process.env.SMTP_SECURE || '(not set)');
  console.log('   - SMTP_USER present:', Boolean(process.env.SMTP_USER));
  if (process.env.SMTP_USER) {
    const user = process.env.SMTP_USER.trim();
    const parts = user.split('@');
    const masked = parts.length === 2 ? parts[0].slice(0, 2) + '***@' + parts[1] : '***';
    console.log('   - SMTP_USER masked:', masked);
    console.log('   - SMTP_USER length:', user.length);
  }
  console.log('   - SMTP_PASS present:', Boolean(process.env.SMTP_PASS));
  if (process.env.SMTP_PASS) {
    const rawPass = process.env.SMTP_PASS;
    console.log('   - SMTP_PASS raw length:', rawPass.length);
    console.log('   - SMTP_PASS starts/ends with quotes:', /^['"]/.test(rawPass) || /['"]$/.test(rawPass));
    console.log('   - SMTP_PASS has leading/trailing whitespace:', rawPass !== rawPass.trim());
    console.log('   - SMTP_PASS has internal spaces:', /\s/.test(rawPass));
    console.log('   - SMTP_PASS has newlines:', /[\r\n]/.test(rawPass));
  }

  console.log('\n2. Sanitized Settings Applied by emailService:');
  const sanitized = getSanitizedSmtpConfig();
  console.log('   - Host:', sanitized.host);
  console.log('   - Port:', sanitized.port);
  console.log('   - Secure:', sanitized.secure);
  console.log('   - Pass sanitized length:', sanitized.pass.length);
  console.log('   - isSmtpConfigured():', isSmtpConfigured());

  console.log('\n3. Safe Authentication & Connection Verification:');
  console.log('   (Verifying credentials via Nodemailer without dispatching real emails...)');
  const result = await verifySmtpConnection();
  if (result.authenticated) {
    console.log('   ✅ SMTP AUTHENTICATION SUCCEEDED!');
    console.log('   Details:', result.message);
  } else {
    console.log('   ❌ SMTP AUTHENTICATION FAILED!');
    console.log('   Code:', result.code);
    console.log('   ResponseCode:', result.responseCode);
    console.log('   Details:', result.message);
  }
  console.log('\n====================================================');
  process.exit(result.authenticated ? 0 : 1);
}

runDiagnostic().catch((err) => {
  console.error('Fatal diagnostic error:', err.message);
  process.exit(1);
});
