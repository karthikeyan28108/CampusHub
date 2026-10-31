import '../config/env.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io as ClientIO } from 'socket.io-client';
import User from '../models/User.js';
import Connection from '../models/Connection.js';
import Message from '../models/Message.js';
import { encrypt } from '../utils/encryption.js';

async function runVerification() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/campushub');

  console.log('===========================================================');
  console.log(' CampusHub Diagnostic & Optimization Verification Suite   ');
  console.log('===========================================================\n');

  // 1. Pick test users
  const userA = await User.findOne({ role: 'student' });
  const userB = await User.findOne({ role: 'student', _id: { $ne: userA._id } });

  console.log(`Test Student A: ${userA.name} (${userA.registerNumber})`);
  console.log(`Test Student B: ${userB.name} (${userB.registerNumber})\n`);

  const tokenA = jwt.sign(
    { id: userA._id.toString(), email: userA.email, role: userA.role, name: userA.name },
    process.env.JWT_SECRET || 'campushub_secret',
    { expiresIn: '1h' }
  );

  const tokenB = jwt.sign(
    { id: userB._id.toString(), email: userB.email, role: userB.role, name: userB.name },
    process.env.JWT_SECRET || 'campushub_secret',
    { expiresIn: '1h' }
  );

  const API_URL = 'http://localhost:5000';

  // --- TEST 1: Optimized /connections/pending Batched Aggregation ---
  console.log('--- TEST 1: Verifying Optimized /connections/pending Endpoint ---');
  const t0 = performance.now();
  const pendingRes = await fetch(`${API_URL}/api/connections/pending`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const pendingData = await pendingRes.json();
  const pendingTime = performance.now() - t0;

  console.log(`Status: ${pendingRes.status}`);
  console.log(`Response status: ${pendingData.status}`);
  console.log(`Count: ${pendingData.count} pending requests`);
  console.log(`Latency: ${pendingTime.toFixed(2)} ms (Single aggregation query)\n`);

  if (pendingRes.status !== 200) {
    throw new Error(`/connections/pending returned ${pendingRes.status}: ${JSON.stringify(pendingData)}`);
  }

  // --- TEST 2: Active Chat Message Sending via Live Socket ---
  console.log('--- TEST 2: Sending Messages via Live Socket.IO Server ---');
  const socketA = ClientIO(API_URL, { auth: { token: `Bearer ${tokenA}` } });
  await new Promise(r => socketA.on('connect', r));
  console.log(`Socket connected (ID: ${socketA.id})`);

  for (let i = 1; i <= 5; i++) {
    const msgPromise = new Promise((resolve) => {
      socketA.once('new_message', resolve);
    });

    const sendT0 = performance.now();
    socketA.emit('send_message', {
      receiverId: userB._id.toString(),
      content: `Verification message #${i} at ${new Date().toISOString()}`
    });

    const received = await msgPromise;
    const elapsed = performance.now() - sendT0;
    console.log(`  Message #${i} round-trip: ${elapsed.toFixed(2)} ms (ID: ${received._id})`);
    await new Promise(r => setTimeout(r, 100));
  }

  socketA.disconnect();
  console.log('✅ Socket messages sent and verified.\n');

  await mongoose.connection.close();
  process.exit(0);
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
