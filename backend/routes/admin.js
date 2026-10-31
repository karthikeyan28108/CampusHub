import express from 'express';
import User from '../models/User.js';
import Note from '../models/Note.js';
import Placement from '../models/Placement.js';
import Event from '../models/Event.js';
import EventRegistration from '../models/EventRegistration.js';
import Payment from '../models/Payment.js';
import Message from '../models/Message.js';
import Connection from '../models/Connection.js';
import AdminAuditLog from '../models/AdminAuditLog.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { decrypt } from '../utils/encryption.js';

const router = express.Router();

// @route   GET /api/admin/stats
// @desc    Get dashboard metrics, revenue reports, and recent activities feed (Admin only)
router.get('/stats', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // 1. Aggregations (Counts)
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalFaculty = await User.countDocuments({ role: 'faculty' });
    const totalNotes = await Note.countDocuments();
    const totalPlacements = await Placement.countDocuments();
    const totalEvents = await Event.countDocuments();
    const totalRegistrations = await EventRegistration.countDocuments();

    // 2. Payments aggregation
    const successfulPayments = await Payment.countDocuments({ status: 'Completed' });
    const failedPayments = await Payment.countDocuments({ status: 'Failed' });
    
    const revenueResult = await Payment.aggregate([
      { $match: { status: 'Completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // 3. Activity Feed: Retrieve latest 5 entries from each module
    const recentNotes = await Note.find()
      .populate('uploadedBy', 'name role')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentPlacements = await Placement.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentEvents = await Event.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Assemble into unified feed list, sorted chronologically
    const activityFeed = [
      ...recentNotes.map(n => ({
        id: n._id,
        type: 'Note',
        title: n.title,
        creator: n.uploadedBy?.name || 'Unknown',
        role: n.uploadedBy?.role || 'user',
        time: n.createdAt
      })),
      ...recentPlacements.map(p => ({
        id: p._id,
        type: 'Placement',
        title: `${p.companyName} (${p.jobRole})`,
        creator: p.createdBy?.name || 'Admin',
        role: 'admin',
        time: p.createdAt
      })),
      ...recentEvents.map(e => ({
        id: e._id,
        type: 'Event',
        title: e.title,
        creator: e.createdBy?.name || 'Organizer',
        role: 'organizer',
        time: e.createdAt
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time))
     .slice(0, 10); // Limit to top 10 items overall

    res.json({
      status: 'success',
      metrics: {
        totalStudents,
        totalFaculty,
        totalNotes,
        totalPlacements,
        totalEvents,
        totalRegistrations,
        successfulPayments,
        failedPayments,
        totalRevenue
      },
      activityFeed
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   POST /api/admin/messages/oversight
// @desc    Admin-only: Look up decrypted direct message history between two users by registerNumber for moderation
router.post('/messages/oversight', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { registerNumberA, registerNumberB, reason } = req.body;

    if (!registerNumberA || typeof registerNumberA !== 'string' || !registerNumberA.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'registerNumberA is required and must be a valid string.'
      });
    }

    if (!registerNumberB || typeof registerNumberB !== 'string' || !registerNumberB.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'registerNumberB is required and must be a valid string.'
      });
    }

    const regA = registerNumberA.trim();
    const regB = registerNumberB.trim();

    if (regA.toLowerCase() === regB.toLowerCase()) {
      return res.status(400).json({
        status: 'error',
        message: 'registerNumberA and registerNumberB must be different users.'
      });
    }

    // 1. Look up User A by exact registerNumber
    const userA = await User.findOne({ registerNumber: regA });
    if (!userA) {
      return res.status(404).json({
        status: 'error',
        message: `User with register number "${regA}" not found.`
      });
    }

    // 2. Look up User B by exact registerNumber
    const userB = await User.findOne({ registerNumber: regB });
    if (!userB) {
      return res.status(404).json({
        status: 'error',
        message: `User with register number "${regB}" not found.`
      });
    }

    // 3. Find Connection document between these two users (reusing static helper Connection.findBetweenUsers)
    // Note: Connection presence or status does NOT block message oversight review.
    const connection = await Connection.findBetweenUsers(userA._id, userB._id);
    const connectionStatus = connection ? connection.status : 'not_connected';

    // 4. Query all messages between userA and userB in both directions, sorted oldest to newest
    const messages = await Message.find({
      $or: [
        { sender: userA._id, receiver: userB._id },
        { sender: userB._id, receiver: userA._id }
      ]
    })
      .populate('sender', 'name registerNumber email role department')
      .populate('receiver', 'name registerNumber email role department')
      .sort({ createdAt: 1 });

    // 5. Decrypt each message safely using decrypt() from encryption utility
    const decryptedMessages = messages.map((msg) => {
      const msgObj = msg.toObject ? msg.toObject() : { ...msg };
      let text = '';

      if (msgObj.encryptedContent && msgObj.iv && msgObj.authTag) {
        try {
          text = decrypt({
            iv: msgObj.iv,
            authTag: msgObj.authTag,
            ciphertext: msgObj.encryptedContent
          });
        } catch (err) {
          console.warn(`[Admin Oversight] Failed to decrypt message ${msgObj._id}:`, err.message);
          text = '[unable to decrypt]';
        }
      } else if (msgObj.content) {
        text = msgObj.content;
      }

      return {
        _id: msgObj._id,
        sender: {
          _id: msgObj.sender?._id || msgObj.sender,
          name: msgObj.sender?.name || 'Unknown',
          registerNumber: msgObj.sender?.registerNumber || '',
          email: msgObj.sender?.email || '',
          role: msgObj.sender?.role || '',
          department: msgObj.sender?.department || ''
        },
        receiver: {
          _id: msgObj.receiver?._id || msgObj.receiver,
          name: msgObj.receiver?.name || 'Unknown',
          registerNumber: msgObj.receiver?.registerNumber || '',
          email: msgObj.receiver?.email || '',
          role: msgObj.receiver?.role || '',
          department: msgObj.receiver?.department || ''
        },
        content: text,
        createdAt: msgObj.createdAt
      };
    });

    // 6. Mandatory Audit Logging: record who looked up whose messages and why before returning
    await AdminAuditLog.create({
      adminId: req.user.id,
      targetUserA: userA._id,
      targetUserB: userB._id,
      action: 'message_oversight_lookup',
      reason: (reason && typeof reason === 'string' && reason.trim()) ? reason.trim() : 'Moderation / Safety Review',
      messageCount: decryptedMessages.length,
      timestamp: new Date()
    });

    // 7. Return clean JSON response
    res.json({
      status: 'success',
      userA: {
        id: userA._id,
        name: userA.name,
        registerNumber: userA.registerNumber,
        email: userA.email,
        role: userA.role,
        department: userA.department
      },
      userB: {
        id: userB._id,
        name: userB.name,
        registerNumber: userB.registerNumber,
        email: userB.email,
        role: userB.role,
        department: userB.department
      },
      connectionStatus,
      connection: connection ? {
        id: connection._id,
        status: connection.status,
        initiatedBy: connection.initiatedBy,
        blockedBy: connection.blockedBy,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt
      } : null,
      messages: decryptedMessages
    });
  } catch (error) {
    console.error('[Admin Oversight] Error processing oversight lookup:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/admin/messages/oversight/logs
// @desc    Admin-only: Retrieve past oversight audit logs
router.get('/messages/oversight/logs', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const logs = await AdminAuditLog.find()
      .populate('adminId', 'name email role')
      .populate('targetUserA', 'name registerNumber email role')
      .populate('targetUserB', 'name registerNumber email role')
      .sort({ timestamp: -1, createdAt: -1 })
      .limit(100);

    res.json({
      status: 'success',
      logs
    });
  } catch (error) {
    console.error('[Admin Oversight] Error fetching oversight logs:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;

