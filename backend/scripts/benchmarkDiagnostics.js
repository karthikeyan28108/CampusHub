import '../config/env.js';
import connectDB from '../config/db.js';
import mongoose from 'mongoose';
import Connection from '../models/Connection.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { encrypt, decrypt } from '../utils/encryption.js';

async function runBenchmark() {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once('connected', resolve));
  }

  console.log('=====================================================');
  console.log(' 1. Connection & Message Collection Index Status');
  console.log('=====================================================');
  const connIndexes = await Connection.collection.indexes();
  console.log('Connection indexes:', JSON.stringify(connIndexes, null, 2));

  const msgIndexes = await Message.collection.indexes();
  console.log('Message indexes:', JSON.stringify(msgIndexes, null, 2));

  const existingMsgCount = await Message.countDocuments();
  console.log(`Current Message documents in DB: ${existingMsgCount}`);

  let userA = await User.findOne({ role: 'student' });
  let userB = await User.findOne({ role: 'student', _id: { $ne: userA._id } });

  if (!userA || !userB) {
    console.error('Not enough users found to benchmark.');
    process.exit(1);
  }

  console.log(`\nBenchmarking with UserA (${userA.name}) and UserB (${userB.name})`);

  console.log('\n=====================================================');
  console.log(' 2. Message-Send Path Instrumentation (20 Message Sends)');
  console.log('=====================================================');

  const sendTimings = [];
  const createdMsgIds = [];

  for (let i = 1; i <= 20; i++) {
    const text = `Diagnostic benchmark message #${i} - Testing encryption and DB overhead`;

    // (a) Connection status lookup query
    const t0 = performance.now();
    const conn = await Connection.findBetweenUsers(userA._id, userB._id);
    const lookupDuration = performance.now() - t0;

    // (b) AES-256-GCM encrypt
    const t1 = performance.now();
    const encrypted = encrypt(text);
    const encryptDuration = performance.now() - t1;

    // (c) MongoDB message .save() / create
    const t2 = performance.now();
    const message = await Message.create({
      sender: userA._id,
      receiver: userB._id,
      room: null,
      encryptedContent: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      delivered: true,
      deliveredAt: new Date(),
      readAt: null
    });
    const saveDuration = performance.now() - t2;

    createdMsgIds.push(message._id);
    sendTimings.push({
      run: i,
      lookupMs: lookupDuration,
      encryptMs: encryptDuration,
      saveMs: saveDuration,
      totalMs: lookupDuration + encryptDuration + saveDuration
    });

    console.log(`Send #${String(i).padStart(2, '0')}: ConnectionLookup = ${lookupDuration.toFixed(3).padStart(7)}ms | Encrypt = ${encryptDuration.toFixed(3).padStart(6)}ms | MongoSave = ${saveDuration.toFixed(3).padStart(7)}ms | Total = ${(lookupDuration + encryptDuration + saveDuration).toFixed(3).padStart(7)}ms`);
  }

  const avgLookup = sendTimings.reduce((s, r) => s + r.lookupMs, 0) / sendTimings.length;
  const avgEncrypt = sendTimings.reduce((s, r) => s + r.encryptMs, 0) / sendTimings.length;
  const avgSave = sendTimings.reduce((s, r) => s + r.saveMs, 0) / sendTimings.length;
  const avgTotal = sendTimings.reduce((s, r) => s + r.totalMs, 0) / sendTimings.length;

  console.log('-----------------------------------------------------');
  console.log(`20-Send Averages:`);
  console.log(`  (a) Connection status lookup : ${avgLookup.toFixed(3)} ms  (${((avgLookup / avgTotal) * 100).toFixed(1)}% of total)`);
  console.log(`  (b) AES-256-GCM encrypt()    : ${avgEncrypt.toFixed(3)} ms  (${((avgEncrypt / avgTotal) * 100).toFixed(1)}% of total)`);
  console.log(`  (c) MongoDB Message.create() : ${avgSave.toFixed(3)} ms  (${((avgSave / avgTotal) * 100).toFixed(1)}% of total)`);
  console.log(`  -----------------------------------------`);
  console.log(`  Total Message-Send operations: ${avgTotal.toFixed(3)} ms`);

  console.log('\n=====================================================');
  console.log(' 3. Message-History Fetch Path Instrumentation');
  console.log('=====================================================');

  // Time MongoDB query
  const q0 = performance.now();
  const messages = await Message.find({
    $or: [
      { sender: userA._id, receiver: userB._id },
      { sender: userB._id, receiver: userA._id }
    ]
  })
  .populate('sender', 'name role email')
  .sort({ createdAt: 1 });
  const queryDuration = performance.now() - q0;

  // Time Decryption loop
  const d0 = performance.now();
  const decrypted = messages.map(m => {
    const obj = m.toObject();
    if (obj.encryptedContent && obj.iv && obj.authTag) {
      try {
        obj.content = decrypt({
          iv: obj.iv,
          authTag: obj.authTag,
          ciphertext: obj.encryptedContent
        });
      } catch (err) {
        obj.content = '[error]';
      }
    }
    return obj;
  });
  const decryptDuration = performance.now() - d0;

  console.log(`History Fetch Test (${messages.length} messages in conversation):`);
  console.log(`  (a) MongoDB query (.find + .populate + .sort): ${queryDuration.toFixed(3)} ms (${((queryDuration / (queryDuration + decryptDuration)) * 100).toFixed(1)}%)`);
  console.log(`  (b) Decryption loop for all ${messages.length} messages  : ${decryptDuration.toFixed(3)} ms (${((decryptDuration / (queryDuration + decryptDuration)) * 100).toFixed(1)}%)`);
  console.log(`  -----------------------------------------`);
  console.log(`  Total History Fetch execution: ${(queryDuration + decryptDuration).toFixed(3)} ms`);

  console.log('\n=====================================================');
  console.log(' 4. Scalability Diagnostic: Decryption vs DB Fetch Scaling');
  console.log('=====================================================');

  // Measure per-message decryption cost
  const singleEnc = encrypt("Hello world test message for per-message timing");
  const numTrials = 1000;
  const decStart = performance.now();
  for (let k = 0; k < numTrials; k++) {
    decrypt({ iv: singleEnc.iv, authTag: singleEnc.authTag, ciphertext: singleEnc.ciphertext });
  }
  const perMsgDecryptMs = (performance.now() - decStart) / numTrials;
  console.log(`Per-message decryption time: ${perMsgDecryptMs.toFixed(4)} ms (~${(perMsgDecryptMs * 1000).toFixed(1)} µs)`);
  console.log(`Estimated time to decrypt 50 messages : ${(perMsgDecryptMs * 50).toFixed(3)} ms`);
  console.log(`Estimated time to decrypt 500 messages: ${(perMsgDecryptMs * 500).toFixed(3)} ms`);

  // Cleanup benchmark created messages
  await Message.deleteMany({ _id: { $in: createdMsgIds } });
  console.log('\nCleaned up benchmark test messages from database.');

  await mongoose.connection.close();
  process.exit(0);
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
