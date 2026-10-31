import express from 'express';
import mongoose from 'mongoose';
import Connection, { normalizePair } from '../models/Connection.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { verifyToken } from '../middleware/auth.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const router = express.Router();

/**
 * @route   GET /api/connections
 * @desc    Get current user's accepted connections for the chat sidebar
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Retrieve connections where status is 'accepted' and current user is a participant
    const connections = await Connection.find({
      status: 'accepted',
      $or: [{ userA: currentUserId }, { userB: currentUserId }]
    })
    .populate('userA', 'name email role department registerNumber year section profilePicture')
    .populate('userB', 'name email role department registerNumber year section profilePicture')
    .sort({ updatedAt: -1 });

    const formatted = connections.map(conn => {
      const isUserA = conn.userA._id.toString() === currentUserId;
      const otherUser = isUserA ? conn.userB : conn.userA;
      return {
        _id: conn._id,
        status: conn.status,
        isExempt: conn.isExempt,
        user: otherUser,
        updatedAt: conn.updatedAt
      };
    });

    return res.json({
      status: 'success',
      count: formatted.length,
      connections: formatted
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/connections/pending
 * @desc    Get incoming pending connection requests for the current user
 */
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const pendingConnections = await Connection.find({
      status: 'pending',
      initiatedBy: { $ne: currentUserId },
      $or: [{ userA: currentUserId }, { userB: currentUserId }]
    })
    .populate('userA', 'name email role department registerNumber year section profilePicture')
    .populate('userB', 'name email role department registerNumber year section profilePicture')
    .populate('initiatedBy', 'name email role department registerNumber year section profilePicture')
    .sort({ createdAt: -1 });

    // Batch query introductory messages using a single aggregation pipeline instead of N individual queries
    if (pendingConnections.length === 0) {
      return res.json({
        status: 'success',
        count: 0,
        requests: []
      });
    }

    const senderObjectIds = pendingConnections.map(conn => 
      new mongoose.Types.ObjectId(conn.initiatedBy._id || conn.initiatedBy)
    );

    const latestMessages = await Message.aggregate([
      {
        $match: {
          sender: { $in: senderObjectIds },
          receiver: new mongoose.Types.ObjectId(currentUserId)
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$sender',
          firstMsg: { $first: '$$ROOT' }
        }
      }
    ]);

    // Fast O(1) map of senderId -> firstMessage document
    const messageMap = new Map();
    for (const item of latestMessages) {
      messageMap.set(item._id.toString(), item.firstMsg);
    }

    const formatted = pendingConnections.map((conn) => {
      const isUserA = conn.userA._id.toString() === currentUserId;
      const requester = isUserA ? conn.userB : conn.userA;
      const senderKey = (conn.initiatedBy._id || conn.initiatedBy).toString();
      const firstMessage = messageMap.get(senderKey);

      let firstMessageContent = '';
      if (firstMessage) {
        if (firstMessage.encryptedContent && firstMessage.iv && firstMessage.authTag) {
          try {
            firstMessageContent = decrypt({
              iv: firstMessage.iv,
              authTag: firstMessage.authTag,
              ciphertext: firstMessage.encryptedContent
            });
          } catch (err) {
            console.warn('[Encryption] Failed to decrypt pending firstMessage:', err.message);
            firstMessageContent = '[unable to decrypt]';
          }
        } else {
          firstMessageContent = firstMessage.content || '';
        }
      }

      return {
        _id: conn._id,
        status: conn.status,
        requester,
        initiatedBy: conn.initiatedBy,
        firstMessage: firstMessageContent,
        createdAt: conn.createdAt
      };
    });

    return res.json({
      status: 'success',
      count: formatted.length,
      requests: formatted
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/connections/request
 * @desc    Send a connection request with one free message (or fresh request after a block)
 */
router.post('/request', verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { targetUserId, message } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        status: 'error',
        message: 'Target user ID is required.'
      });
    }

    if (targetUserId.toString() === currentUserId.toString()) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot connect with yourself.'
      });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'An introductory first message is required with the request.'
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        status: 'error',
        message: 'Target user not found.'
      });
    }

    const currentUser = await User.findById(currentUserId);
    const isExempt = currentUser.role !== 'student' || targetUser.role !== 'student';

    const { userA, userB } = normalizePair(currentUserId, targetUserId);
    let connection = await Connection.findOne({ userA, userB });

    if (isExempt) {
      // Rule 6: Faculty/Admin involved - auto-accepted immediately
      if (!connection) {
        connection = await Connection.create({
          userA,
          userB,
          status: 'accepted',
          initiatedBy: currentUserId,
          firstMessageSent: true,
          isExempt: true
        });
      } else {
        connection.status = 'accepted';
        connection.isExempt = true;
        connection.blockedBy = null;
        await connection.save();
      }

      const plainIntro = message.trim();
      const encIntro = encrypt(plainIntro);

      const firstMsg = await Message.create({
        sender: currentUserId,
        receiver: targetUserId,
        encryptedContent: encIntro.ciphertext,
        iv: encIntro.iv,
        authTag: encIntro.authTag,
        delivered: false
      });

      const firstMsgWithPlaintext = {
        ...firstMsg.toObject(),
        content: plainIntro
      };

      const io = req.app.get('io');
      if (io) {
        io.to(targetUserId.toString()).to(`user:${targetUserId}`).emit('new_message', {
          ...firstMsgWithPlaintext,
          sender: {
            _id: currentUser._id,
            name: currentUser.name,
            role: currentUser.role,
            email: currentUser.email
          }
        });
      }

      return res.status(201).json({
        status: 'success',
        message: 'Direct conversation started.',
        connection,
        initialMessage: firstMsgWithPlaintext
      });
    }

    // Student-to-Student Flow
    if (connection) {
      if (connection.status === 'accepted') {
        return res.status(400).json({
          status: 'error',
          message: 'You already have an active connection with this student.'
        });
      }

      if (connection.status === 'pending') {
        if (connection.initiatedBy.toString() === currentUserId.toString()) {
          return res.status(400).json({
            status: 'error',
            message: 'You have already sent a connection request. Waiting for the student to accept.'
          });
        } else {
          return res.status(400).json({
            status: 'error',
            message: 'This student has already sent you a connection request. Please check your Requests tab.'
          });
        }
      }

      if (connection.status === 'blocked') {
        // Rule 5: Fresh request after block - reuse same document, reset state
        connection.status = 'pending';
        connection.initiatedBy = currentUserId;
        connection.blockedBy = null;
        connection.firstMessageSent = true;
        await connection.save();
      }
    } else {
      // Brand new connection
      connection = await Connection.create({
        userA,
        userB,
        status: 'pending',
        initiatedBy: currentUserId,
        firstMessageSent: true,
        isExempt: false
      });
    }

    // Persist the introductory single message (encrypted at rest)
    const plainIntro = message.trim();
    const encIntro = encrypt(plainIntro);

    const firstMsg = await Message.create({
      sender: currentUserId,
      receiver: targetUserId,
      encryptedContent: encIntro.ciphertext,
      iv: encIntro.iv,
      authTag: encIntro.authTag,
      delivered: false
    });

    const firstMsgWithPlaintext = {
      ...firstMsg.toObject(),
      content: plainIntro
    };

    // Real-time Socket.IO notification to recipient
    const io = req.app.get('io');
    if (io) {
      io.to(targetUserId.toString()).to(`user:${targetUserId}`).emit('connectionRequest', {
        connectionId: connection._id,
        requester: {
          _id: currentUser._id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          department: currentUser.department,
          registerNumber: currentUser.registerNumber,
          profilePicture: currentUser.profilePicture
        },
        message: firstMsgWithPlaintext
      });
    }

    return res.status(201).json({
      status: 'success',
      message: 'Connection request and first message sent successfully.',
      connection,
      initialMessage: firstMsgWithPlaintext
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/connections/:id/accept
 * @desc    Accept an incoming connection request (Rule 3)
 */
router.post('/:id/accept', verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const connection = await Connection.findById(req.params.id);

    if (!connection) {
      return res.status(404).json({
        status: 'error',
        message: 'Connection request not found.'
      });
    }

    const isParticipant = connection.userA.toString() === currentUserId.toString() ||
                          connection.userB.toString() === currentUserId.toString();

    if (!isParticipant) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not a participant in this connection.'
      });
    }

    if (connection.status === 'accepted') {
      return res.json({
        status: 'success',
        message: 'Connection is already accepted.',
        connection
      });
    }

    if (connection.status === 'blocked') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot accept a blocked connection.'
      });
    }

    if (connection.initiatedBy.toString() === currentUserId.toString()) {
      return res.status(400).json({
        status: 'error',
        message: 'You cannot accept your own connection request.'
      });
    }

    connection.status = 'accepted';
    connection.blockedBy = null;
    await connection.save();

    // Notify requester in real time
    const io = req.app.get('io');
    if (io) {
      const acceptingUser = await User.findById(currentUserId).select('name email role department registerNumber profilePicture');
      io.to(connection.initiatedBy.toString()).to(`user:${connection.initiatedBy}`).emit('connectionAccepted', {
        connectionId: connection._id,
        acceptedBy: acceptingUser
      });
    }

    return res.json({
      status: 'success',
      message: 'Connection request accepted. Two-way messaging unlocked.',
      connection
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/connections/:id/block
 * @desc    Block a connection (Rule 4: Silent block, ends connection)
 */
router.post('/:id/block', verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const connection = await Connection.findById(req.params.id);

    if (!connection) {
      return res.status(404).json({
        status: 'error',
        message: 'Connection not found.'
      });
    }

    const isParticipant = connection.userA.toString() === currentUserId.toString() ||
                          connection.userB.toString() === currentUserId.toString();

    if (!isParticipant) {
      return res.status(403).json({
        status: 'error',
        message: 'You are not a participant in this connection.'
      });
    }

    connection.status = 'blocked';
    connection.blockedBy = currentUserId;
    await connection.save();

    // Rule 4: Silent block - NO socket event is sent to the blocked user!

    return res.json({
      status: 'success',
      message: 'User has been blocked.',
      connectionId: connection._id
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;
