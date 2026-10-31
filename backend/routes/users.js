import express from 'express';
import User from '../models/User.js';
import Connection from '../models/Connection.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   GET /api/users/search?registerNumber=...
 * @desc    Exact-match Student search by registerNumber only (Student-to-Student flow)
 */
router.get('/search', verifyToken, async (req, res) => {
  try {
    const rawRegNum = req.query.registerNumber;
    if (!rawRegNum || typeof rawRegNum !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide an exact register number.'
      });
    }

    const regNum = rawRegNum.trim();
    if (!regNum) {
      return res.status(400).json({
        status: 'error',
        message: 'Register number cannot be empty.'
      });
    }

    // Exact full register-number match only (case-insensitive full-string match, no partials)
    const escaped = regNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exactRegex = new RegExp(`^${escaped}$`, 'i');

    const matchedStudent = await User.findOne({
      registerNumber: exactRegex,
      role: 'student',
      _id: { $ne: req.user.id }
    }).select('name role email department registerNumber year section profilePicture');

    if (!matchedStudent) {
      return res.status(404).json({
        status: 'error',
        message: 'No student found with that register number.'
      });
    }

    // Look up existing connection status if any
    const connection = await Connection.findBetweenUsers(req.user.id, matchedStudent._id);

    return res.json({
      status: 'success',
      user: matchedStudent,
      connection: connection ? {
        id: connection._id,
        status: connection.status,
        initiatedBy: connection.initiatedBy,
        blockedBy: connection.blockedBy,
        isExempt: connection.isExempt
      } : null
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/users/directory
 * @desc    Unrestricted directory of campus users (Faculty and Admin only)
 */
router.get('/directory', verifyToken, requireRole('faculty', 'admin'), async (req, res) => {
  try {
    const rawUsers = await User.find({ _id: { $ne: req.user.id }, isActive: { $ne: false } })
      .select('name role email department registerNumber year section profilePicture')
      .sort({ name: 1, createdAt: 1 });

    // Deduplicate campus users so each member appears uniquely:
    // - Students deduplicated by registerNumber
    // - Faculty/Admin deduplicated by normalized name + department + role
    const seen = new Set();
    const uniqueUsers = [];

    for (const u of rawUsers) {
      let dedupeKey;
      if (u.role === 'student' && u.registerNumber && u.registerNumber.trim()) {
        dedupeKey = `student:${u.registerNumber.trim().toUpperCase()}`;
      } else if (u.name && u.role) {
        dedupeKey = `${u.role}:${u.name.trim().toLowerCase()}:${(u.department || '').trim().toLowerCase()}`;
      } else {
        dedupeKey = u._id.toString();
      }

      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        uniqueUsers.push(u);
      }
    }

    return res.json({
      status: 'success',
      count: uniqueUsers.length,
      users: uniqueUsers
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;
