import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Generate a signed JSON Web Token (JWT)
 * @param {string} userId - User's MongoDB ObjectId string
 * @returns {string} - Signed JWT
 */
export function generateToken(userId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured in environment variables.');
  }

  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * Middleware to protect routes and verify JWT authentication
 */
export async function protect(req, res, next) {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized: No bearer token provided.',
        });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user from database excluding password hash
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized: User with this token no longer exists.',
        });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('JWT Authentication failed:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized: Invalid or expired token.',
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: Authorization header missing Bearer token.',
    });
  }
}

/**
 * Optional authentication middleware:
 * Attaches req.user if a valid Bearer token is provided, but does not block requests if absent/invalid
 */
export async function optionalAuth(req, res, next) {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          req.user = user;
        }
      }
    } catch {
      // Non-blocking for optional auth
    }
  }
  next();
}

