import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Connection, { normalizePair } from '../models/Connection.js';
import { encrypt } from '../utils/encryption.js';

// In-memory presence tracking: userId -> Set of socketIds
const connectedUsers = new Map();

// Diagnostic timing instrumentation counter for next 20 message sends
let timedSendCount = 0;
const MAX_TIMED_SENDS = 20;

const configureSockets = (io) => {
  // Authentication Middleware for Socket.IO connections
  io.use((socket, next) => {
    const authStart = performance.now();
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    if (!token) {
      return next(new Error('Authentication Error: Token is missing'));
    }

    // Handle token format (with or without 'Bearer ')
    const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;

    try {
      const decoded = jwt.verify(tokenString, process.env.JWT_SECRET || 'campushub_secret');
      socket.user = decoded; // Attach user profile info
      socket.authDuration = performance.now() - authStart;
      console.log(`[Socket Handshake Auth] Client "${socket.user.name}" authenticated in ${socket.authDuration.toFixed(3)} ms`);
      next();
    } catch (err) {
      return next(new Error('Authentication Error: Invalid or expired token'));
    }
  });

  // Connection Handler
  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`Realtime Chat client connected: ${socket.user.name} (${userId})`);

    // 1. Join user-specific rooms
    socket.join(userId); // For backward compatibility with direct emissions
    socket.join(`user:${userId}`); // Specifically designated room for notifications

    // 2. Track connection in the online presence map
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);

    // 3. Lookup undelivered messages (delivered: false) and emit pending-notification
    const checkPendingNotifications = async () => {
      try {
        const undelivered = await Message.find({ receiver: userId, delivered: false });
        if (undelivered.length > 0) {
          const counts = {};
          undelivered.forEach(msg => {
            const senderId = msg.sender.toString();
            counts[senderId] = (counts[senderId] || 0) + 1;
          });
          const conversations = Object.keys(counts).map(convId => ({
            conversationId: convId,
            unreadCount: counts[convId]
          }));

          socket.emit('pending-notification', {
            hasUnread: true,
            unreadCount: undelivered.length,
            conversations
          });
        } else {
          socket.emit('pending-notification', {
            hasUnread: false,
            unreadCount: 0,
            conversations: []
          });
        }
      } catch (err) {
        console.error('Error checking pending notifications:', err);
      }
    };

    checkPendingNotifications();

    // Join general/group room
    socket.on('join_room', (roomName) => {
      socket.join(roomName);
      console.log(`Socket ${socket.id} (User: ${socket.user.name}) joined room: ${roomName}`);
    });

    // Leave a room
    socket.on('leave_room', (roomName) => {
      socket.leave(roomName);
      console.log(`Socket ${socket.id} (User: ${socket.user.name}) left room: ${roomName}`);
    });

    // Module-level counter for diagnostic timing instrumentation
    let connLookupDuration = null;

    // Send Message Handler (handles both DM and Room messaging)
    socket.on('send_message', async (data) => {
      const t_eventReceived = performance.now();
      try {
        const { receiverId, room, content } = data;

        if (!content || !content.trim() || (!receiverId && !room)) {
          return;
        }

        let t_targetUser = null;
        let t_connLookup = null;

        // --- DIRECT MESSAGE CONNECTION-REQUEST RULES ---
        if (receiverId) {
          const t_targetUserStart = performance.now();
          const targetUser = await User.findById(receiverId);
          t_targetUser = performance.now() - t_targetUserStart;

          if (!targetUser) {
            socket.emit('error_message', { message: 'Recipient not found.' });
            return;
          }

          const isExempt = socket.user.role !== 'student' || targetUser.role !== 'student';

          // Step 1: Connection status lookup query
          const t_connLookupStart = performance.now();
          let connection = await Connection.findBetweenUsers(userId, receiverId);
          t_connLookup = performance.now() - t_connLookupStart;

          if (isExempt) {
            // Rule 6: Faculty/Admin involved - ensure connection exists
            if (!connection) {
              const { userA, userB } = normalizePair(userId, receiverId);
              connection = await Connection.create({
                userA,
                userB,
                status: 'accepted',
                initiatedBy: userId,
                firstMessageSent: true,
                isExempt: true
              });
            } else if (connection.status === 'blocked') {
              // Rule 4 Silent Block applies even for Faculty/Admin
              if (connection.blockedBy && connection.blockedBy.toString() !== userId.toString()) {
                // Sender is the BLOCKED party: silent success, no DB persist, no emission to blocker
                const fakeMessage = {
                  _id: new mongoose.Types.ObjectId(),
                  sender: {
                    _id: socket.user.id,
                    name: socket.user.name,
                    role: socket.user.role,
                    email: socket.user.email
                  },
                  receiver: receiverId,
                  room: null,
                  content: content.trim(),
                  delivered: true,
                  deliveredAt: new Date(),
                  readAt: null,
                  createdAt: new Date()
                };
                socket.emit('new_message', fakeMessage);
                return;
              } else if (connection.blockedBy && connection.blockedBy.toString() === userId.toString()) {
                socket.emit('error_message', { message: 'You have blocked this user.' });
                return;
              }
            }
          } else {
            // Student-to-Student Flow
            if (!connection) {
              socket.emit('error_message', {
                message: 'No connection exists. Please search by Register Number and send a connection request first.'
              });
              return;
            }

            if (connection.status === 'pending') {
              if (connection.initiatedBy.toString() === userId.toString()) {
                socket.emit('error_message', {
                  message: 'Connection request is pending. You can only send one initial message until the request is accepted.'
                });
                return;
              } else {
                socket.emit('error_message', {
                  message: 'Please accept the incoming connection request to start messaging.'
                });
                return;
              }
            }

            if (connection.status === 'blocked') {
              if (connection.blockedBy && connection.blockedBy.toString() !== userId.toString()) {
                // Rule 4: SILENT BLOCK
                // Current user is the blocked party. Do NOT persist to DB and do NOT deliver to blocker.
                // Echo back to sender so their screen updates normally without error.
                const fakeMessage = {
                  _id: new mongoose.Types.ObjectId(),
                  sender: {
                    _id: socket.user.id,
                    name: socket.user.name,
                    role: socket.user.role,
                    email: socket.user.email
                  },
                  receiver: receiverId,
                  room: null,
                  content: content.trim(),
                  delivered: true,
                  deliveredAt: new Date(),
                  readAt: null,
                  createdAt: new Date()
                };
                socket.emit('new_message', fakeMessage);
                return;
              } else {
                socket.emit('error_message', { message: 'You have blocked this user.' });
                return;
              }
            }

            // If status !== 'accepted'
            if (connection.status !== 'accepted') {
              socket.emit('error_message', { message: 'Connection is not active.' });
              return;
            }
          }
        }

        const t_presenceStart = performance.now();
        let isOnline = false;
        if (receiverId) {
          isOnline = connectedUsers.has(receiverId) && connectedUsers.get(receiverId).size > 0;
        }
        const t_presence = performance.now() - t_presenceStart;

        // Step 2: Encrypt message content at rest using AES-256-GCM
        const plainText = content.trim();
        const t_encryptStart = performance.now();
        const encrypted = encrypt(plainText);
        const t_encrypt = performance.now() - t_encryptStart;

        // Step 3: Save message to database with delivery tracking (storing encryptedContent, iv, authTag)
        const t_saveStart = performance.now();
        const message = await Message.create({
          sender: userId,
          receiver: receiverId || null,
          room: room || null,
          encryptedContent: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          delivered: receiverId ? isOnline : true,
          deliveredAt: (receiverId && isOnline) ? new Date() : (room ? new Date() : null),
          readAt: null
        });
        const t_save = performance.now() - t_saveStart;

        // Immediate DB verification in the exact same process and connection
        const verifyDoc = await Message.findById(message._id).lean();
        console.log(`[DB Verification in-process] 🔍 Querying Message.findById("${message._id}"):`, {
          foundInDb: Boolean(verifyDoc),
          documentId: verifyDoc?._id?.toString(),
          database: mongoose.connection.db.databaseName,
          collection: Message.collection.name,
          createdAt: verifyDoc?.createdAt,
          encryptedContentPreview: verifyDoc?.encryptedContent ? `${verifyDoc.encryptedContent.slice(0, 16)}...` : null
        });

        // Step 4: Populate sender metadata
        const t_populateStart = performance.now();
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name role email');
        const t_populate = performance.now() - t_populateStart;

        // Real-time delivery: emit the original in-memory plaintext directly without decrypt round-trip
        const realtimeMessage = {
          ...populatedMessage.toObject(),
          content: plainText
        };

        // Step 5: The emit itself
        const t_emitStart = performance.now();
        if (receiverId) {
          if (isOnline) {
            // Direct Message: Emit to both sender and receiver rooms in real time
            io.to(receiverId.toString()).to(`user:${receiverId}`).to(userId.toString()).emit('new_message', realtimeMessage);
          } else {
            // Direct Message: Emit only to sender since receiver is offline
            io.to(userId.toString()).emit('new_message', realtimeMessage);
          }
        } else if (room) {
          // Room Message: Emit to all users in the specific channel/room
          io.to(room).emit('new_message', realtimeMessage);
        }
        const t_emit = performance.now() - t_emitStart;
        const t_totalHandler = performance.now() - t_eventReceived;

        timedSendCount++;
        console.log(`\n======================================================`);
        console.log(`⏱️ [REAL 'send_message' PIPELINE BREAKDOWN #${timedSendCount}]`);
        console.log(`  Auth/Handshake verify (cached)      : ${socket.authDuration !== undefined ? `${socket.authDuration.toFixed(3)} ms` : 'N/A'}`);
        console.log(`  (1) Target User Lookup (findById)   : ${t_targetUser !== null ? `${t_targetUser.toFixed(3)} ms` : 'N/A (room)'}`);
        console.log(`  (2) Connection Status Lookup        : ${t_connLookup !== null ? `${t_connLookup.toFixed(3)} ms` : 'N/A (room)'}`);
        console.log(`  (3) Online Presence Map Check       : ${t_presence.toFixed(3)} ms`);
        console.log(`  (4) AES-256-GCM encrypt()           : ${t_encrypt.toFixed(3)} ms`);
        console.log(`  (5) MongoDB Message.create() (.save): ${t_save.toFixed(3)} ms`);
        console.log(`  (6) Sender Populate (.findById)     : ${t_populate.toFixed(3)} ms`);
        console.log(`  (7) Socket.io emit('new_message')   : ${t_emit.toFixed(3)} ms`);
        console.log(`  ------------------------------------------------------`);
        console.log(`  TOTAL REAL Server-Side Latency      : ${t_totalHandler.toFixed(3)} ms`);
        console.log(`======================================================\n`);

        console.log(`[Chat Storage] 🔒 Message encrypted & saved to DB (id: ${message._id}):`, {
          encryptedContent: `${encrypted.ciphertext.slice(0, 16)}...`,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          plaintextStored: false
        });
      } catch (error) {
        console.error('Failed to process and send socket message:', error);
      }
    });

    // Mark as Read Handler
    socket.on('mark-as-read', async (data) => {
      try {
        const { conversationId } = data;
        if (!conversationId) return;

        // Update all unread/undelivered messages from conversationId (sender) to current user (receiver)
        await Message.updateMany(
          { receiver: userId, sender: conversationId, readAt: null },
          {
            $set: {
              delivered: true,
              readAt: new Date()
            }
          }
        );

        // Guarantee deliveredAt is set for any message previously marked as delivered: false
        await Message.updateMany(
          { receiver: userId, sender: conversationId, deliveredAt: null },
          {
            $set: {
              deliveredAt: new Date()
            }
          }
        );

        // Recalculate recipient's total remaining unread messages
        const unreadCount = await Message.countDocuments({ receiver: userId, delivered: false });

        // Emit notification-cleared to all of recipient's active socket connections/tabs
        io.to(`user:${userId}`).emit('notification-cleared', {
          conversationId,
          unreadCount
        });

      } catch (error) {
        console.error('Failed to mark messages as read:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Realtime Chat client disconnected: ${socket.user.name} (${userId})`);
      if (connectedUsers.has(userId)) {
        const sockets = connectedUsers.get(userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          connectedUsers.delete(userId);
        }
      }
    });
  });
};

export default configureSockets;
