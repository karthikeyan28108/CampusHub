import '../config/env.js';
import http from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../app.js';
import User from '../models/User.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';

async function retest() {
  console.log('================================================================');
  console.log('       POST-FIX RE-TEST: VERIFYING BOTH QUESTION PHRASINGS      ');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/campushub');

  // Verify target chunk in DB
  const targetChunk = await KnowledgeChunk.findOne({
    sourceType: 'projectDoc',
    chunkIndex: 0
  }).lean();

  if (!targetChunk) {
    throw new Error('Target chunk 0 not found in database!');
  }
  console.log(`Target Chunk ID: ${targetChunk._id}`);
  console.log(`Target Chunk Snippet: "${targetChunk.chunkText.slice(0, 150).replace(/\n/g, ' ')}..."\n`);

  const student = await User.findOne({ role: 'student' }).lean();
  const token = jwt.sign(
    { id: student._id.toString(), role: student.role },
    process.env.JWT_SECRET || 'jwtsecret',
    { expiresIn: '1h' }
  );

  const server = http.createServer(app);
  const PORT = 5056;
  await new Promise((resolve) => server.listen(PORT, resolve));
  const url = `http://localhost:${PORT}/api/chatbot/ask`;

  const phrasings = [
    'team member name of the project',
    'project team member name'
  ];

  const results = [];

  for (const q of phrasings) {
    console.log(`----------------------------------------------------------------`);
    console.log(`Testing Question: "${q}"`);
    console.log(`----------------------------------------------------------------`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question: q })
    });

    const data = await res.json();
    const retrievedIds = data.diagnostic?.retrievedChunkIds || [];
    const targetRetrieved = retrievedIds.includes(targetChunk._id.toString());
    const answerContainsName = /karthikeyan/i.test(data.answer) || /24ucs025/i.test(data.answer);

    console.log(`Status: ${res.status}`);
    console.log(`Model Used: ${data.diagnostic?.modelUsed} (${data.diagnostic?.isFallback ? 'FALLBACK' : 'PRIMARY'})`);
    console.log(`Retrieved Chunk IDs (${retrievedIds.length}):`, retrievedIds);
    console.log(`Did it retrieve the target chunk? ${targetRetrieved ? '✅ YES' : '❌ NO'}`);
    console.log(`Answer Text:\n"""\n${data.answer}\n"""`);
    console.log(`Does answer contain "Karthikeyan" / "24UCS025"? ${answerContainsName ? '✅ YES' : '❌ NO'}\n`);

    results.push({
      question: q,
      targetRetrieved,
      answerContainsName,
      modelUsed: data.diagnostic?.modelUsed,
      answer: data.answer
    });
  }

  server.close();
  await mongoose.disconnect();

  console.log('================================================================');
  console.log('                       FINAL VERIFICATION                       ');
  console.log('================================================================');
  const allPass = results.every(r => r.targetRetrieved && r.answerContainsName);
  results.forEach((r, idx) => {
    console.log(`Phrasing ${idx + 1} ("${r.question}"):`);
    console.log(`  - Target Chunk Retrieved: ${r.targetRetrieved ? 'PASS' : 'FAIL'}`);
    console.log(`  - Correct Name in Answer: ${r.answerContainsName ? 'PASS' : 'FAIL'}`);
  });
  console.log(`Overall Result: ${allPass ? '🎉 ALL CHECKS PASSED!' : '❌ CHECKS FAILED'}`);
  console.log('================================================================\n');

  if (!allPass) {
    process.exit(1);
  }
}

retest().catch(err => {
  console.error(err);
  process.exit(1);
});
