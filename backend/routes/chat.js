import express from 'express';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';
import { decrypt } from '../utils/encryption.js';

const router = express.Router();

/**
 * Formats a message document by decrypting ciphertext at rest,
 * while safely handling corrupted messages or legacy unencrypted records.
 */
const formatMessage = (msgDoc) => {
  const msgObj = msgDoc.toObject ? msgDoc.toObject() : { ...msgDoc };
  if (msgObj.encryptedContent && msgObj.iv && msgObj.authTag) {
    try {
      msgObj.content = decrypt({
        iv: msgObj.iv,
        authTag: msgObj.authTag,
        ciphertext: msgObj.encryptedContent
      });
    } catch (err) {
      console.warn(`[Encryption] Failed to decrypt message ${msgObj._id}:`, err.message);
      msgObj.content = '[unable to decrypt]';
    }
  } else if (!msgObj.content) {
    msgObj.content = '';
  }
  return msgObj;
};

// @route   GET /api/chat/users
// @desc    Get list of all users to chat with (excluding current logged in user)
router.get('/users', verifyToken, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('name role email department registerNumber year');
    res.json({
      status: 'success',
      users
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/chat/history/direct/:userId
// @desc    Get conversation history between current user and target user
router.get('/history/direct/:userId', verifyToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.userId;

    // (a) Diagnostic timing: MongoDB query (.find + .populate + .sort)
    const queryStart = performance.now();
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: targetUserId },
        { sender: targetUserId, receiver: currentUserId }
      ]
    })
    .populate('sender', 'name role email')
    .sort({ createdAt: 1 });
    const queryDuration = performance.now() - queryStart;

    // (b) Diagnostic timing: Loop decrypting each fetched message
    const decryptStart = performance.now();
    const decryptedMessages = messages.map(formatMessage);
    const decryptDuration = performance.now() - decryptStart;

    console.log(`\n⏱️ [Diagnostic Timing] Message-History Fetch (Direct DM)`);
    console.log(`  Target User ID               : ${targetUserId}`);
    console.log(`  Total Messages Fetched       : ${messages.length}`);
    console.log(`  (a) MongoDB query execution  : ${queryDuration.toFixed(3)} ms`);
    console.log(`  (b) Decryption loop execution: ${decryptDuration.toFixed(3)} ms`);
    console.log(`  -----------------------------------------`);
    console.log(`  Measured fetch operations sum: ${(queryDuration + decryptDuration).toFixed(3)} ms\n`);

    res.json({
      status: 'success',
      messages: decryptedMessages
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/chat/history/room/:roomName
// @desc    Get conversation history for a room
router.get('/history/room/:roomName', verifyToken, async (req, res) => {
  try {
    const { roomName } = req.params;

    // (a) Diagnostic timing: MongoDB query (.find + .populate + .sort)
    const queryStart = performance.now();
    const messages = await Message.find({ room: roomName })
      .populate('sender', 'name role email')
      .sort({ createdAt: 1 });
    const queryDuration = performance.now() - queryStart;

    // (b) Diagnostic timing: Loop decrypting each fetched message
    const decryptStart = performance.now();
    const decryptedMessages = messages.map(formatMessage);
    const decryptDuration = performance.now() - decryptStart;

    console.log(`\n⏱️ [Diagnostic Timing] Message-History Fetch (Room: ${roomName})`);
    console.log(`  Total Messages Fetched       : ${messages.length}`);
    console.log(`  (a) MongoDB query execution  : ${queryDuration.toFixed(3)} ms`);
    console.log(`  (b) Decryption loop execution: ${decryptDuration.toFixed(3)} ms`);
    console.log(`  -----------------------------------------`);
    console.log(`  Measured fetch operations sum: ${(queryDuration + decryptDuration).toFixed(3)} ms\n`);

    res.json({
      status: 'success',
      messages: decryptedMessages
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;
