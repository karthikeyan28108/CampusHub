import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import Student from '../models/Student.js';
import User from '../models/User.js';
import { sendOtpEmail, sendPasswordChangedEmail } from '../services/emailService.js';
import { forgotPasswordIpLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validateRequest.js';

const router = express.Router();

// Helper to format minutes remaining
const getMinutesRemaining = (windowStart) => {
  const elapsedMs = Date.now() - new Date(windowStart).getTime();
  const remainingMs = 15 * 60 * 1000 - elapsedMs;
  return Math.ceil(remainingMs / 1000 / 60);
};

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset OTP (max 3 attempts per IP and per email in 15 mins)
 */
router.post(
  '/forgot-password',
  forgotPasswordIpLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email address.')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email } = req.body;
      const genericMessage = 'If that email is registered, an OTP has been sent.';

      // Look up user by email
      const user = await User.findOne({ email: email.toLowerCase() });

      // Dynamic sync for registered student users not yet in Student database
      let student = await Student.findOne({ email: email.toLowerCase() });
      if (user && user.role === 'student' && !student) {
        student = await Student.create({
          rollNumber: user.registerNumber || 'TEST_' + Date.now(),
          fullName: user.name,
          email: user.email,
          passwordHash: user.password
        });
      }

      // Account existence is not leaked to client
      if (!user) {
        return res.status(200).json({
          status: 'success',
          message: genericMessage
        });
      }

      // Check email-based rate limit
      if (user.forgotPasswordWindowStart) {
        const elapsedMs = Date.now() - user.forgotPasswordWindowStart.getTime();
        
        if (elapsedMs < 15 * 60 * 1000) {
          if (user.forgotPasswordAttempts >= 3) {
            const minutesLeft = getMinutesRemaining(user.forgotPasswordWindowStart);
            return res.status(429).json({
              status: 'error',
              message: `Too many requests. Please try again in ${minutesLeft} minutes.`
            });
          }
          user.forgotPasswordAttempts += 1;
        } else {
          user.forgotPasswordAttempts = 1;
          user.forgotPasswordWindowStart = new Date();
        }
      } else {
        user.forgotPasswordAttempts = 1;
        user.forgotPasswordWindowStart = new Date();
      }

      // Generate secure 6-digit OTP
      const otp = crypto.randomInt(100000, 1000000).toString();

      // Hash OTP with bcrypt before storage
      const salt = await bcrypt.genSalt(12);
      const otpHash = await bcrypt.hash(otp, salt);

      // Save the OTP details directly to the User record
      user.resetOTP = otpHash;
      user.resetOTPExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
      user.resetOTPAttempts = 0; // Reset validation attempts
      user.resetOTPVerified = false;
      await user.save();

      // Send OTP via email
      try {
        await sendOtpEmail(user.email, otp, 5);
      } catch (emailErr) {
        console.error('[PasswordReset] Failed to send reset OTP email:', emailErr.message);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to send OTP email. Please try again later.'
        });
      }

      return res.status(200).json({
        status: 'success',
        message: genericMessage
      });

    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify the reset OTP code (max 5 incorrect attempts)
 */
router.post(
  '/verify-otp',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email address.'),
    body('otp')
      .isLength({ min: 6, max: 6 })
      .withMessage('Please enter a valid 6-digit verification code.')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email, otp } = req.body;

      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });

      console.log(`[VerifyOTP Diagnostics] User found: ${!!user}`);
      if (user) {
        console.log(`[VerifyOTP Diagnostics] resetOTP: ${user.resetOTP}`);
        console.log(`[VerifyOTP Diagnostics] resetOTPExpires: ${user.resetOTPExpires}`);
        console.log(`[VerifyOTP Diagnostics] Current time: ${new Date()}`);
        console.log(`[VerifyOTP Diagnostics] Comparison: ${user.resetOTPExpires ? (user.resetOTPExpires < new Date()) : 'N/A'}`);
      }

      // Reject if no user or no OTP details
      if (!user || !user.resetOTP || !user.resetOTPExpires) {
        return res.status(400).json({
          status: 'error',
          message: 'This code has expired. Please request a new one. (Reason: Missing OTP details)'
        });
      }

      // Reject if expired
      if (user.resetOTPExpires < new Date()) {
        return res.status(400).json({
          status: 'error',
          message: 'This code has expired. Please request a new one. (Reason: Expiration check failed)'
        });
      }

      // Reject if too many failed attempts
      if (user.resetOTPAttempts >= 5) {
        return res.status(400).json({
          status: 'error',
          message: 'Too many incorrect attempts. Please request a new code.'
        });
      }

      // Compare submitted OTP against hashed OTP
      const isMatch = await bcrypt.compare(otp, user.resetOTP);

      if (!isMatch) {
        user.resetOTPAttempts += 1;
        await user.save();

        if (user.resetOTPAttempts >= 5) {
          return res.status(400).json({
            status: 'error',
            message: 'Too many incorrect attempts. Please request a new code.'
          });
        }

        const attemptsRemaining = 5 - user.resetOTPAttempts;
        return res.status(400).json({
          status: 'error',
          message: `Incorrect code. ${attemptsRemaining} attempts remaining.`
        });
      }

      // On success, mark verified
      user.resetOTPVerified = true;
      await user.save();

      return res.status(200).json({
        status: 'success',
        message: 'OTP verified successfully.'
      });

    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Set new password using verified OTP session
 */
router.post(
  '/reset-password',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email address.'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long.')
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { email, newPassword } = req.body;

      // Find user
      const user = await User.findOne({ email: email.toLowerCase() });

      if (!user || !user.resetOTPVerified || user.resetOTPExpires < new Date()) {
        return res.status(400).json({
          status: 'error',
          message: 'This code has expired. Please request a new one.'
        });
      }

      // Enforce strict password validation rules identical to client
      if (newPassword.length < 8) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must be at least 8 characters long.'
        });
      }
      if (!/[A-Z]/.test(newPassword)) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must include at least one uppercase letter.'
        });
      }
      if (!/[a-z]/.test(newPassword)) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must include at least one lowercase letter.'
        });
      }
      if (!/[0-9]/.test(newPassword)) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must include at least one number.'
        });
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
        return res.status(400).json({
          status: 'error',
          message: 'Password must include at least one special character.'
        });
      }

      // Compare new password against current password
      const isSame = await bcrypt.compare(newPassword, user.password);
      if (isSame) {
        return res.status(400).json({
          status: 'error',
          message: 'New password must be different from your current password.'
        });
      }

      // Update User record (pre-save hook will hash the password)
      user.password = newPassword;
      user.resetOTP = null;
      user.resetOTPExpires = null;
      user.resetOTPAttempts = 0;
      user.resetOTPVerified = false;
      await user.save();

      // Sync/update corresponding Student record if it exists
      const student = await Student.findOne({ email: email.toLowerCase() });
      if (student) {
        // Hash for Student (cost 12 to match original student password seeding)
        const studentHash = await bcrypt.hash(newPassword, 12);
        student.passwordHash = studentHash;
        student.updatedAt = new Date();
        await student.save();
      }

      // Send confirmation email
      sendPasswordChangedEmail(user.email);

      return res.status(200).json({
        status: 'success',
        message: 'Your password has been reset successfully. Redirecting to login…'
      });

    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: error.message
      });
    }
  }
);

export default router;
