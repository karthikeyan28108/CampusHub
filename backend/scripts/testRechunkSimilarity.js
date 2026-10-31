import '../config/env.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { generateEmbedding, cosineSimilarity } from '../services/geminiService.js';

async function test() {
  await connectDB();

  const phrasingA = 'team member name of the project';
  const phrasingB = 'project team member name';

  const embA = await generateEmbedding(phrasingA);
  const embB = await generateEmbedding(phrasingB);

  const cleanHeader = `FINAL YEAR PROJECT REFERENCE DOCUMENT
CampusHub Academic and Campus Collaboration System — Overview
TEAM MEMBER PROJECT GUIDE
V. Karthikeyan (24UCS025) K. Devikala M.C.A.,
BSc Computer Science 'A' Department of Computer Science`;

  const embNew = await generateEmbedding(cleanHeader);

  console.log('Phrasing A vs Clean Header:', cosineSimilarity(embA, embNew));
  console.log('Phrasing B vs Clean Header:', cosineSimilarity(embB, embNew));

  const allChunks = await KnowledgeChunk.find({}).lean();
  const oldChunk = await KnowledgeChunk.findOne({ sourceType: 'projectDoc', chunkIndex: 0 }).lean();
  const otherChunks = allChunks.filter(c => c._id.toString() !== oldChunk._id.toString());

  const simListA = [...otherChunks.map(c => ({ id: c._id, subj: c.subject, score: cosineSimilarity(embA, c.embedding), isTarget: false })), { id: 'CLEAN_HEADER', subj: 'Project Header', score: cosineSimilarity(embA, embNew), isTarget: true }].sort((a, b) => b.score - a.score);

  const simListB = [...otherChunks.map(c => ({ id: c._id, subj: c.subject, score: cosineSimilarity(embB, c.embedding), isTarget: false })), { id: 'CLEAN_HEADER', subj: 'Project Header', score: cosineSimilarity(embB, embNew), isTarget: true }].sort((a, b) => b.score - a.score);

  console.log('\n--- CLEAN HEADER RANKING ---');
  const rankA = simListA.findIndex(i => i.isTarget) + 1;
  const rankB = simListB.findIndex(i => i.isTarget) + 1;
  console.log(`Rank in Phrasing A ("${phrasingA}"): #${rankA} of ${simListA.length} (Score: ${simListA[rankA - 1].score.toFixed(4)})`);
  console.log(`Rank in Phrasing B ("${phrasingB}"): #${rankB} of ${simListB.length} (Score: ${simListB[rankB - 1].score.toFixed(4)})`);

  await mongoose.disconnect();
}

test().catch(console.error);
