import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../models/User.js';
import Student from '../models/Student.js';
import RegistrationOtp from '../models/RegistrationOtp.js';
import { sendOtpEmail } from '../services/emailService.js';
import { verifyToken } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Helper to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET || 'campushub_secret',
    { expiresIn: '7d' }
  );
};

// @route   POST /api/auth/register-send-otp
// @desc    Send OTP to email for user registration (checks email uniqueness)
router.post('/register-send-otp', async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Please enter your username / full name.'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Please enter a valid email address.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.toLowerCase().trim();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email format (e.g., user@example.com).'
      });
    }

    // 1. Strict Unique Email Check
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'This email is already registered. Please sign in instead.'
      });
    }

    // 2. Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();

    // 3. Hash OTP before saving
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);

    // 4. Save/update registration OTP record (expires in 10 minutes)
    await RegistrationOtp.findOneAndUpdate(
      { email: cleanEmail },
      {
        email: cleanEmail,
        otpHash,
        attempts: 0,
        verified: false,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    // 5. Send OTP via email
    try {
      await sendOtpEmail(cleanEmail, otp, 5, 'Registration Verification');
    } catch (emailError) {
      console.error('[Auth] Failed to send registration OTP email:', emailError.message);
      return res.status(500).json({
        status: 'error',
        message: 'Could not send verification email. Please check that your email address is correct and try again.'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: `A 6-digit verification code has been sent to ${cleanEmail}.`
    });
  } catch (error) {
    console.error('Error in register-send-otp:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to send registration OTP.'
    });
  }
});

// @route   POST /api/auth/register-verify-otp
// @desc    Verify the registration OTP
router.post('/register-verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and OTP verification code are required.'
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = otp.toString().trim();

    const record = await RegistrationOtp.findOne({ email: cleanEmail });
    if (!record) {
      return res.status(400).json({
        status: 'error',
        message: 'Verification code has expired or was not requested. Please click "Send OTP" again.'
      });
    }

    if (record.attempts >= 5) {
      return res.status(400).json({
        status: 'error',
        message: 'Too many incorrect attempts. Please request a new verification code.'
      });
    }

    const isMatch = await bcrypt.compare(cleanOtp, record.otpHash);
    if (!isMatch) {
      record.attempts += 1;
      await record.save();
      const attemptsRemaining = 5 - record.attempts;
      return res.status(400).json({
        status: 'error',
        message: `Incorrect code. ${attemptsRemaining} attempt(s) remaining.`
      });
    }

    // Mark as verified
    record.verified = true;
    await record.save();

    return res.status(200).json({
      status: 'success',
      message: 'Email verified successfully! Now you can set your password to finish registration.'
    });
  } catch (error) {
    console.error('Error in register-verify-otp:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to verify registration OTP.'
    });
  }
});

// @route   POST /api/auth/register
// @desc    Register a new user after email OTP verification
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a username.'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide an email address.'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long.'
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Check if user already exists
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.status(400).json({
        status: 'error',
        message: 'An account with this email already exists. Please sign in.'
      });
    }

    // 2. Verify that OTP was verified for this email
    const otpRecord = await RegistrationOtp.findOne({ email: cleanEmail });
    if (!otpRecord || !otpRecord.verified) {
      return res.status(400).json({
        status: 'error',
        message: 'Please verify your email using the OTP before setting your password.'
      });
    }

    // 3. Create user (Always regular user/student, never admin via public registration)
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: password,
      role: 'student',
      department: req.body.department || 'General',
      year: req.body.year || 1,
      section: req.body.section || 'A'
    });

    // Clean up OTP record
    await RegistrationOtp.deleteOne({ email: cleanEmail });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      status: 'success',
      message: 'Account registered successfully!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password, rollNumber } = req.body;

    let user = null;

    // 1. If rollNumber is provided (Student Roll Number Login)
    if (rollNumber) {
      const student = await Student.findOne({ rollNumber });
      if (!student) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid roll number or password'
        });
      }

      const isMatch = await bcrypt.compare(password, student.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid roll number or password'
        });
      }

      // Check corresponding User record, create if missing
      user = await User.findOne({ email: student.email });
      if (!user) {
        user = await User.create({
          name: student.fullName,
          email: student.email,
          password: password,
          role: 'student',
          registerNumber: student.rollNumber,
          department: 'General',
          year: 1,
          section: 'A'
        });
      }
    } 
    // 2. If email / username is provided (Students, Faculty, or Single Admin)
    else if (email) {
      const normalizedInput = email.toLowerCase().trim();

      // Find user by email or name
      user = await User.findOne({
        $or: [
          { email: normalizedInput },
          { name: normalizedInput }
        ]
      });

      // Special fallback if user typed 'admin' or 'admin@campushub.edu.com'
      if (!user && (normalizedInput === 'admin' || normalizedInput === 'admin@campushub.edu.com')) {
        user = await User.findOne({ role: 'admin' });
      }

      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password'
        });
      }

      // Compare password
      let isMatch = await user.comparePassword(password);

      // Fallback check against Student collection if user was originally seeded in Student
      if (!isMatch && user.role === 'student') {
        const student = await Student.findOne({ email: user.email });
        if (student && student.passwordHash) {
          isMatch = await bcrypt.compare(password, student.passwordHash);
          if (isMatch) {
            user.password = password;
            await user.save();
          }
        }
      }

      if (!isMatch) {
        return res.status(401).json({
          status: 'error',
          message: 'Invalid email or password'
        });
      }
    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }

    // Check active status
    if (!user.isActive) {
      return res.status(403).json({
        status: 'error',
        message: 'User account is deactivated'
      });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      status: 'success',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        registerNumber: user.registerNumber,
        year: user.year,
        section: user.section,
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (simply client side action, return success)
router.post('/logout', (req, res) => {
  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

// @route   GET /api/auth/me
// @desc    Get current logged in user details
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        registerNumber: user.registerNumber,
        year: user.year,
        section: user.section,
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change password of logged in user
router.put('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide current and new passwords'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        message: 'Incorrect current password'
      });
    }

    // Update password
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    // Sync with Student collection if role is student
    if (user.role === 'student') {
      const student = await Student.findOne({ email: user.email.toLowerCase() });
      if (student) {
        student.passwordHash = await bcrypt.hash(newPassword, 12);
        student.updatedAt = new Date();
        await student.save();
      }
    }

    res.json({
      status: 'success',
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;
