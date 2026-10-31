import '../config/env.js';
import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';

async function sendOne() {
  await connectDB();
  const userA = await User.findOne({ role: 'student' });
  const userB = await User.findOne({ role: 'student', _id: { $ne: userA._id } });

  const token = jwt.sign(
    { id: userA._id.toString(), email: userA.email, role: userA.role, name: userA.name },
    process.env.JWT_SECRET || 'campushub_secret',
    { expiresIn: '1h' }
  );

  const socket = ClientIO('http://localhost:5000', { auth: { token: `Bearer ${token}` } });
  await new Promise(resolve => socket.on('connect', resolve));

  const content = 'Live verification test message ' + new Date().toISOString();

  const msgPromise = new Promise(resolve => {
    socket.on('new_message', (msg) => {
      resolve(msg);
    });
  });

  socket.emit('send_message', {
    receiverId: userB._id.toString(),
    content
  });

  const received = await msgPromise;
  console.log('Client received new_message:', {
    _id: received._id,
    content: received.content,
    createdAt: received.createdAt
  });

  socket.disconnect();
  await mongoose.connection.close();
  process.exit(0);
}

sendOne().catch(console.error);
