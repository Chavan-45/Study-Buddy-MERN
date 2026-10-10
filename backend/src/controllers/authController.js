import User from '../models/User.js';
import { generateToken } from '../middleware/authMiddleware.js';
import {
  isSmtpConfigured,
  generateVerificationToken,
  hashVerificationToken,
  sendVerificationEmail,
} from '../services/emailService.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds rate limit between email requests

/**
 * @desc    Register a new student account
 * @route   POST /api/auth/register
 * @access  Public
 */
/**
 * @desc    Register a new student account
 * @route   POST /api/auth/register
 * @access  Public
 */
export async function register(req, res, next) {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required.',
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.',
      });
    }

    const cleanPhone = (phone || '').trim();

    if (!cleanPhone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required.',
      });
    }

    // Reject duplicate email addresses.
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          'An account with this email address already exists. Please log in instead.',
      });
    }

    // Create an active account without requiring email verification.
    // Password hashing remains handled by the User model.
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: cleanPhone,
      password,
      emailVerified: true,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully. You can now log in.',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user and explicitly select password field
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    // Generic invalid credential message prevents user enumeration
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password. Please verify your credentials.',
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (Requires Bearer JWT)
 */
export async function getMe(req, res, next) {
  try {
    // req.user is loaded from database by protect middleware
    return res.status(200).json({
      success: true,
      user: req.user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Request or resend email verification link with rate limiting
 * @route   POST /api/auth/send-verification, POST /api/auth/resend-verification
 * @access  Public or Protected
 */
export async function sendVerificationEmailHandler(req, res, next) {
  try {
    let targetUser = null;
    const isAuthenticated = Boolean(req.user);

    // 1. Identify target user from authenticated session or request body email
    if (isAuthenticated) {
      targetUser = await User.findById(req.user._id).select(
        '+verificationTokenHash +verificationTokenExpires +lastVerificationEmailSentAt'
      );
    } else if (req.body.email) {
      const normalizedEmail = String(req.body.email).trim().toLowerCase();
      targetUser = await User.findOne({ email: normalizedEmail }).select(
        '+verificationTokenHash +verificationTokenExpires +lastVerificationEmailSentAt'
      );
    }

    // 2. Prevent user enumeration: if unauthenticated and account not found, return generic success
    if (!targetUser) {
      if (isAuthenticated) {
        return res.status(404).json({
          success: false,
          message: 'User account not found.',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email address, a verification link has been sent.',
      });
    }

    // 3. If account is already verified, avoid sending redundant emails
    if (targetUser.emailVerified) {
      if (isAuthenticated) {
        return res.status(400).json({
          success: false,
          message: 'Your email address is already verified.',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email address, a verification link has been sent.',
      });
    }

    // 4. Rate-Limiting & Denial-of-Service Abuse Protection:
    // When unauthenticated, protect the legitimate user from being locked out or having
    // their existing token repeatedly overwritten by a third-party attacker.
    if (targetUser.lastVerificationEmailSentAt) {
      const elapsed = Date.now() - new Date(targetUser.lastVerificationEmailSentAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);

        if (isAuthenticated) {
          // Authenticated owner gets exact cooldown feedback
          return res.status(429).json({
            success: false,
            message: `Please wait ${retryAfterSeconds} seconds before requesting another verification email.`,
            retryAfterSeconds,
          });
        }

        // Unauthenticated request within cooldown: return generic success without
        // modifying the legitimate user's token or resetting timers (neutralizes DoS attack)
        return res.status(200).json({
          success: true,
          message: 'If an account exists with this email address, a verification link has been sent.',
        });
      }
    }

    // 5. Verify SMTP configuration
    if (!isSmtpConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'SMTP email transport is not configured on the server. Please configure SMTP credentials to send verification emails.',
        code: 'SMTP_NOT_CONFIGURED',
      });
    }

    // 6. Generate secure single-use token and save hash in MongoDB
    const { rawToken, tokenHash, expiresAt } = generateVerificationToken();
    targetUser.verificationTokenHash = tokenHash;
    targetUser.verificationTokenExpires = expiresAt;
    targetUser.lastVerificationEmailSentAt = new Date();
    await targetUser.save();

    // 7. Dispatch verification email via Nodemailer
    try {
      await sendVerificationEmail(targetUser.email, targetUser.name, rawToken);
    } catch (smtpError) {
      console.error('SMTP email delivery error:', smtpError.message);
      const isAuthError =
        smtpError.responseCode === 535 ||
        /invalid credentials|authentication failed|auth/i.test(smtpError.message);

      return res.status(502).json({
        success: false,
        message: isAuthError
          ? 'Email authentication failed with the mail provider (SMTP 535 Invalid credentials). Please check SMTP_PASS or Google App Password.'
          : `Failed to deliver verification email: ${smtpError.message}`,
        code: isAuthError ? 'SMTP_AUTH_FAILED' : 'SMTP_DELIVERY_FAILED',
        errorDetails: smtpError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification email has been sent. Please check your inbox and spam folder.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Validate and consume email verification token (POST only, atomic single-use)
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
export async function verifyEmailHandler(req, res, next) {
  try {
    const token = req.body?.token;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A verification token is required.',
      });
    }

    // 1. Hash the incoming raw token using SHA-256
    const tokenHash = hashVerificationToken(token);

    // 2. Concurrency-Safe Atomic Consumption:
    // Atomically find, mark verified, and unset the token fields in a single MongoDB operation.
    // This guarantees that exactly one simultaneous request can succeed and consume the token.
    const user = await User.findOneAndUpdate(
      {
        verificationTokenHash: tokenHash,
        verificationTokenExpires: { $gt: new Date() },
      },
      {
        $set: { emailVerified: true },
        $unset: {
          verificationTokenHash: 1,
          verificationTokenExpires: 1,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This verification link is invalid, expired, or has already been used.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Your email address has been verified successfully! You now have full access to Study Buddy Roulette.',
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}
