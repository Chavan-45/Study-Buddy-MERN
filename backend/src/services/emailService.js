import crypto from 'crypto';
import { Resend } from 'resend';



/**
 * Checks whether SMTP server credentials and host are fully configured
 */
// Kept under its existing name for compatibility
// with the registration controller.
export function isSmtpConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
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
/**
 * Sends the verification email using Resend's HTTPS API.
 */
export async function sendVerificationEmail(recipientEmail, recipientName, rawToken) {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    const error = new Error('Resend API key is not configured.');
    error.code = 'RESEND_NOT_CONFIGURED';
    throw error;
  }

  const resend = new Resend(apiKey);

  const frontendUrl = (
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    'http://localhost:5173'
  ).replace(/\/+$/, '');

  const verificationUrl =
    `${frontendUrl}/verify-email?token=${encodeURIComponent(rawToken)}`;

  const recipientNameSafe = recipientName || 'Student';

  const text = `Hello ${recipientNameSafe},

Thank you for signing up for Study Buddy Roulette! Please verify your email address using the link below:

${verificationUrl}

This verification link will expire in 24 hours.

If you did not register, you can safely ignore this email.

Best regards,
The Study Buddy Roulette Team`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;border:1px solid #fed7aa;border-radius:12px;background:#fff">
      <h2 style="color:#ea580c">Study Buddy Roulette 🎲</h2>
      <p>Hello <strong>${recipientNameSafe}</strong>,</p>
      <p>Thank you for signing up! Please verify your email address to unlock your account and start discovering study partners.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${verificationUrl}" style="background:#ea580c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">
          Verify Email Address
        </a>
      </p>
      <p style="font-size:13px;color:#64748b">
        If the button doesn't work, copy this link into your browser:
        <a href="${verificationUrl}">${verificationUrl}</a>
      </p>
      <p style="font-size:12px;color:#94a3b8">This link expires in 24 hours.</p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: 'Study Buddy Roulette <onboarding@resend.dev>',
    to: [recipientEmail],
    subject: 'Verify your Study Buddy Roulette email address 🎲',
    text,
    html,
  });

  if (error) {
    console.error('Resend delivery failed:', error.name, error.message);
    const sendError = new Error(`Resend delivery failed: ${error.message}`);
    sendError.code = 'RESEND_DELIVERY_FAILED';
    throw sendError;
  }

  return {
    success: true,
    messageId: data?.id,
  };
}