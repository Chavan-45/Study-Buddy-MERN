import nodemailer from 'nodemailer';
import crypto from 'crypto';

/**
 * Returns sanitized SMTP configuration parameters
 * Strips accidental quotes, leading/trailing whitespace, and internal spaces in app passwords
 */
export function getSanitizedSmtpConfig() {
  const host = (process.env.SMTP_HOST || '').trim();
  const rawPort = String(process.env.SMTP_PORT || '587').trim();
  const port = parseInt(rawPort, 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  let user = (process.env.SMTP_USER || '').trim();
  user = user.replace(/^['"]|['"]$/g, '');

  let pass = (process.env.SMTP_PASS || '').trim();
  pass = pass.replace(/^['"]|['"]$/g, '').replace(/\s+/g, '');

  return { host, port, secure, user, pass };
}

/**
 * Checks whether SMTP server credentials and host are fully configured
 */
export function isSmtpConfigured() {
  const config = getSanitizedSmtpConfig();
  return Boolean(config.host && config.user && config.pass);
}

/**
 * Creates and returns a configured Nodemailer transport
 * Preserves standard TLS validation (never disables certificate verification)
 */
export function createEmailTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  const { host, port, secure, user, pass } = getSanitizedSmtpConfig();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Performs a safe SMTP connection & authentication check via Nodemailer's verify()
 * Never exposes credentials and does not dispatch any email.
 */
export async function verifySmtpConnection() {
  if (!isSmtpConfigured()) {
    return {
      configured: false,
      authenticated: false,
      message: 'SMTP credentials or host are missing from environment.',
    };
  }

  const transporter = createEmailTransporter();
  try {
    await transporter.verify();
    return {
      configured: true,
      authenticated: true,
      message: 'SMTP authentication and connection verified successfully.',
    };
  } catch (error) {
    const isAuthError =
      error.responseCode === 535 ||
      /invalid credentials|authentication failed|auth/i.test(error.message);

    return {
      configured: true,
      authenticated: false,
      code: isAuthError ? 'SMTP_AUTH_FAILED' : 'SMTP_CONNECTION_FAILED',
      responseCode: error.responseCode,
      message: error.message,
    };
  }
}

/**
 * Generates an unguessable 256-bit cryptographically secure verification token
 * Returns:
 * - rawToken: Sent ONLY to the recipient's email address (never stored plain in database)
 * - tokenHash: Cryptographic SHA-256 hash stored in MongoDB
 * - expiresAt: 24-hour expiration timestamp
 */
export function generateVerificationToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours validity

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

/**
 * Hashes a raw verification token using SHA-256
 */
export function hashVerificationToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return '';
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Dispatches an email containing the verification link
 * Throws an explicit configuration error if SMTP is unavailable
 */
export async function sendVerificationEmail(recipientEmail, recipientName, rawToken) {
  if (!isSmtpConfigured()) {
    const error = new Error('SMTP email transport is not configured on the server.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const transporter = createEmailTransporter();
  const frontendUrl = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const verificationUrl = `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const sender = process.env.EMAIL_FROM || '"Study Buddy Roulette" <noreply@studybuddyroulette.edu>';

  const mailOptions = {
    from: sender,
    to: recipientEmail,
    subject: 'Verify your Study Buddy Roulette email address 🎲',
    text: `Hello ${recipientName || 'Student'},\n\nThank you for signing up for Study Buddy Roulette! Please verify your university email address by clicking the link below:\n\n${verificationUrl}\n\nThis verification link will expire in 24 hours.\n\nIf you did not register, you can safely ignore this email.\n\nBest regards,\nThe Study Buddy Roulette Team`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; border: 1px solid #fed7aa; border-radius: 12px; background-color: #ffffff;">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <h2 style="color: #ea580c; margin: 0; font-size: 22px;">Study Buddy Roulette 🎲</h2>
        </div>
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">
          Hello <strong>${recipientName || 'Student'}</strong>,
        </p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
          Thank you for signing up! Please verify your email address to unlock your account and start discovering study partners across campus.
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${verificationUrl}" style="background-color: #ea580c; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          If the button above does not work, copy and paste this URL into your browser:<br/>
          <a href="${verificationUrl}" style="color: #ea580c; word-break: break-all;">${verificationUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">
          This link will expire in 24 hours. If you did not create an account on Study Buddy Roulette, please disregard this email.
        </p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  return {
    success: true,
    messageId: info.messageId,
  };
}
