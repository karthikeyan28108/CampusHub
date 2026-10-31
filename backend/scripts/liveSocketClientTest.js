import '../config/env.js';
import { io as ClientIO } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Connection from '../models/Connection.js';

async function runLiveSocketTest() {
  await connectDB();

  // Find two test users
  const userA = await User.findOne({ role: 'student' });
  const userB = await User.findOne({ role: 'student', _id: { $ne: userA._id } });

  console.log(`Testing with User A: ${userA.name} (${userA._id}) and User B: ${userB.name} (${userB._id})`);

  // Ensure an accepted connection exists between them
  let conn = await Connection.findBetweenUsers(userA._id, userB._id);
  if (!conn) {
    const { normalizePair } = await import('../models/Connection.js');
    const { userA: uA, userB: uB } = normalizePair(userA._id, userB._id);
    conn = await Connection.create({
      userA: uA,
      userB: uB,
      status: 'accepted',
      initiatedBy: userA._id,
      firstMessageSent: true,
      isExempt: false
    });
  } else if (conn.status !== 'accepted') {
    conn.status = 'accepted';
    await conn.save();
  }

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

  const SERVER_URL = 'http://localhost:5000';

  console.log('\n======================================================');
  console.log(' TEST 1: Persistent Connection (Single Connect & Reused)');
  console.log('======================================================');

  const connectStart = performance.now();
  const socketA = ClientIO(SERVER_URL, { auth: { token: `Bearer ${tokenA}` } });
  const socketB = ClientIO(SERVER_URL, { auth: { token: `Bearer ${tokenB}` } });

  await Promise.all([
    new Promise((resolve) => socketA.on('connect', resolve)),
    new Promise((resolve) => socketB.on('connect', resolve))
  ]);
  const connectDuration = performance.now() - connectStart;
  console.log(`✅ Both sockets connected in ${connectDuration.toFixed(2)} ms (SocketA ID: ${socketA.id}, SocketB ID: ${socketB.id})`);

  // Send 5 test messages over the persistent connection and measure exact round-trip times
  const roundTripTimes = [];

  for (let i = 1; i <= 5; i++) {
    const msgText = `Live persistent test message #${i}`;
    const t0 = performance.now();

    const receivePromise = new Promise((resolve) => {
      const handler = (msg) => {
        if (msg.content === msgText) {
          socketB.off('new_message', handler);
          resolve(performance.now() - t0);
        }
      };
      socketB.on('new_message', handler);
    });

    socketA.emit('send_message', {
      receiverId: userB._id.toString(),
      content: msgText
    });

    const elapsed = await receivePromise;
    roundTripTimes.push(elapsed);
    console.log(`  Send #${i} over PERSISTENT socket: Round-trip to recipient = ${elapsed.toFixed(2)} ms`);
    await new Promise((r) => setTimeout(r, 100));
  }

  const avgPersistent = roundTripTimes.reduce((a, b) => a + b, 0) / roundTripTimes.length;
  console.log(`\nAverage Round-Trip on PERSISTENT connection: ${avgPersistent.toFixed(2)} ms`);

  console.log('\n======================================================');
  console.log(' TEST 2: Reconnection On Every Send (Simulation)');
  console.log('======================================================');

  const freshConnectTimes = [];
  for (let i = 1; i <= 3; i++) {
    const t0 = performance.now();
    // Simulate what happens if frontend creates a fresh socket on send
    const freshSocket = ClientIO(SERVER_URL, { auth: { token: `Bearer ${tokenA}` }, forceNew: true });
    await new Promise((resolve) => freshSocket.on('connect', resolve));
    const tConnected = performance.now();

    const msgText = `Fresh socket message #${i}`;
    const receivePromise = new Promise((resolve) => {
      const handler = (msg) => {
        if (msg.content === msgText) {
          socketB.off('new_message', handler);
          resolve(performance.now() - t0);
        }
      };
      socketB.on('new_message', handler);
    });

    freshSocket.emit('send_message', {
      receiverId: userB._id.toString(),
      content: msgText
    });

    const totalElapsed = await receivePromise;
    freshSocket.disconnect();

    freshConnectTimes.push({
      connectOnly: tConnected - t0,
      total: totalElapsed
    });
    console.log(`  Send #${i} with FRESH socket: Connect Handshake = ${(tConnected - t0).toFixed(2)} ms | Total Round-trip = ${totalElapsed.toFixed(2)} ms`);
  }

  console.log('\n======================================================');
  console.log(' TEST 3: Concurrent HTTP Requests Timing');
  console.log('======================================================');

  // Measure history endpoint
  const h0 = performance.now();
  const histRes = await fetch(`${SERVER_URL}/api/chat/history/direct/${userB._id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const histJson = await histRes.json();
  const histDuration = performance.now() - h0;
  console.log(`GET /api/chat/history/direct/${userB._id} (${histJson.messages?.length || 0} messages): ${histDuration.toFixed(2)} ms`);

  // Measure connections endpoint
  const c0 = performance.now();
  const connRes = await fetch(`${SERVER_URL}/api/connections`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const connJson = await connRes.json();
  const connDuration = performance.now() - c0;
  console.log(`GET /api/connections (${connJson.connections?.length || 0} connections): ${connDuration.toFixed(2)} ms`);

  // Measure pending connections endpoint
  const p0 = performance.now();
  const pendRes = await fetch(`${SERVER_URL}/api/connections/pending`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const pendJson = await pendRes.json();
  const pendDuration = performance.now() - p0;
  console.log(`GET /api/connections/pending (${pendJson.requests?.length || 0} requests): ${pendDuration.toFixed(2)} ms`);

  socketA.disconnect();
  socketB.disconnect();
  await mongoose.connection.close();
  process.exit(0);
}

runLiveSocketTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
