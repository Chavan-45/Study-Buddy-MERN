import mongoose from 'mongoose';
import User from '../models/User.js';
import { calculateProfileCompletion } from '../utils/profileUtils.js';
import { findBestMatches } from '../utils/matchingAlgorithm.js';

const ALLOWED_DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'IT', 'Civil', 'Mechanical', 'Other'];
const ALLOWED_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const ALLOWED_MODES = ['Online', 'Offline', 'Both'];
const ALLOWED_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const ALLOWED_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * @desc    Get current authenticated student's full profile
 * @route   GET /api/users/profile
 * @access  Private
 */
export async function getProfile(req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      profile: req.user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get any student's public profile by user ID / uid
 * @route   GET /api/users/profile/:id
 * @access  Private
 */
export async function getProfileById(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user identifier.',
      });
    }

    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found.',
      });
    }

    const safePublicData = targetUser.toJSON();

    // Hide phone number if student has not enabled sharing and requester is not self
    const isSelf = targetUser._id.toString() === req.user._id.toString();
    if (!isSelf && !targetUser.sharePhoneAfterAcceptance) {
      safePublicData.phone = '';
    }

    return res.status(200).json({
      success: true,
      profile: safePublicData,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update current student profile with validation and completion stats
 * @route   PUT /api/users/profile
 * @access  Private
 */
export async function updateProfile(req, res, next) {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    const updates = req.body || {};

    // 1. Strict Whitelist - Prevent Mass Assignment of Protected Fields
    // (Never allow updating _id, uid, email, password, emailVerified, rating metrics)
    const allowedFields = [
      'name',
      'phone',
      'sharePhoneAfterAcceptance',
      'department',
      'year',
      'bio',
      'canHelp',
      'availability',
      'mode',
      'location',
    ];

    // 2. Validate Allowed Fields
    if (updates.name !== undefined) {
      const cleanName = String(updates.name).trim();
      if (!cleanName) {
        return res.status(400).json({
          success: false,
          message: 'Full name cannot be empty.',
        });
      }
      user.name = cleanName;
    }

    if (updates.phone !== undefined) {
      const cleanPhone = String(updates.phone).trim();
      if (!cleanPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number cannot be empty.',
        });
      }
      user.phone = cleanPhone;
    }

    if (updates.sharePhoneAfterAcceptance !== undefined) {
      user.sharePhoneAfterAcceptance = Boolean(updates.sharePhoneAfterAcceptance);
    }

    if (updates.department !== undefined) {
      if (!ALLOWED_DEPARTMENTS.includes(updates.department)) {
        return res.status(400).json({
          success: false,
          message: `Department must be one of: ${ALLOWED_DEPARTMENTS.join(', ')}.`,
        });
      }
      user.department = updates.department;
    }

    if (updates.year !== undefined) {
      if (!ALLOWED_YEARS.includes(updates.year)) {
        return res.status(400).json({
          success: false,
          message: `Year must be one of: ${ALLOWED_YEARS.join(', ')}.`,
        });
      }
      user.year = updates.year;
    }

    if (updates.bio !== undefined) {
      const cleanBio = String(updates.bio).trim();
      if (cleanBio.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Bio cannot exceed 500 characters.',
        });
      }
      user.bio = cleanBio;
    }

    if (updates.mode !== undefined) {
      if (!ALLOWED_MODES.includes(updates.mode)) {
        return res.status(400).json({
          success: false,
          message: `Study mode must be one of: ${ALLOWED_MODES.join(', ')}.`,
        });
      }
      user.mode = updates.mode;
    }

    if (updates.location !== undefined) {
      user.location = String(updates.location).trim() || 'College Library';
    }

    if (updates.canHelp !== undefined) {
      if (!Array.isArray(updates.canHelp)) {
        return res.status(400).json({
          success: false,
          message: 'canHelp must be an array of skills.',
        });
      }

      for (const item of updates.canHelp) {
        if (!item.subject || !String(item.subject).trim()) {
          return res.status(400).json({
            success: false,
            message: 'Each skill in canHelp must have a subject.',
          });
        }
        if (item.level && !ALLOWED_LEVELS.includes(item.level)) {
          return res.status(400).json({
            success: false,
            message: `Skill level must be one of: ${ALLOWED_LEVELS.join(', ')}.`,
          });
        }
      }

      user.canHelp = updates.canHelp.map((item) => ({
        subject: String(item.subject).trim(),
        level: item.level || 'Intermediate',
      }));
    }

    if (updates.availability !== undefined) {
      if (!Array.isArray(updates.availability)) {
        return res.status(400).json({
          success: false,
          message: 'availability must be an array of time slots.',
        });
      }

      for (const slot of updates.availability) {
        if (!slot.day || !ALLOWED_DAYS.includes(slot.day)) {
          return res.status(400).json({
            success: false,
            message: `Availability day must be one of: ${ALLOWED_DAYS.join(', ')}.`,
          });
        }
        if (!slot.startTime || !slot.endTime) {
          return res.status(400).json({
            success: false,
            message: 'Each availability slot must have a startTime and endTime.',
          });
        }
      }

      user.availability = updates.availability.map((slot) => ({
        day: slot.day,
        startTime: String(slot.startTime).trim(),
        endTime: String(slot.endTime).trim(),
      }));
    }

    // 3. Compute Profile Completion Metrics Server-side
    const completionStats = calculateProfileCompletion({
      name: user.name,
      department: user.department,
      year: user.year,
      bio: user.bio,
      canHelp: user.canHelp,
      availability: user.availability,
      mode: user.mode,
      location: user.location,
    });

    user.profileCompleted = completionStats.isComplete;
    user.completionPercentage = completionStats.percentage;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      profile: user.toJSON(),
      completionStats,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Find potential study buddies using the matching algorithm
 * @route   GET /api/users/buddies
 * @access  Private
 */
export async function getPotentialBuddies(req, res, next) {
  try {
    const currentUserId = req.user._id;

    // Exclude current user and find candidate students who completed profile OR offer canHelp skills
    const candidates = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { profileCompleted: true },
        { 'canHelp.0': { $exists: true } },
      ],
    }).select('-password');

    const {
      subject,
      requiredLevel,
      level,
      day,
      startTime,
      endTime,
      mode,
      location,
    } = req.query;

    const hasCriteria = Boolean(subject && subject.trim());

    if (hasCriteria) {
      const criteria = {
        subject: String(subject).trim(),
        requiredLevel: requiredLevel || level || 'Intermediate',
        day: day || '',
        startTime: startTime || '',
        endTime: endTime || '',
        mode: mode || 'Both',
        location: location || '',
        currentUserId: currentUserId.toString(),
      };

      const rankedMatches = findBestMatches(criteria, candidates);
      const matchedCandidates = rankedMatches.map((m) => m.candidate);

      return res.status(200).json({
        success: true,
        count: rankedMatches.length,
        criteria,
        matches: rankedMatches,
        candidates: matchedCandidates,
        buddies: matchedCandidates,
      });
    }

    // No specific subject criteria: return all eligible candidate profiles
    const safeCandidates = candidates.map((c) => (typeof c.toJSON === 'function' ? c.toJSON() : c));

    return res.status(200).json({
      success: true,
      count: safeCandidates.length,
      candidates: safeCandidates,
      buddies: safeCandidates,
      matches: [],
    });
  } catch (error) {
    next(error);
  }
}
