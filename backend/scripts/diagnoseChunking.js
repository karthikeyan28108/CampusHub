import '../config/env.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { generateEmbedding, cosineSimilarity } from '../services/geminiService.js';

async function diagnose() {
  console.log('================================================================');
  console.log('             DIAGNOSTIC: CHUNK RETRIEVAL ANALYSIS               ');
  console.log('================================================================\n');

  await connectDB();

  // Step 1: Find chunks containing "Karthikeyan" or "24UCS025"
  console.log('--- STEP 1: CHUNK(S) CONTAINING TEAM MEMBER NAME ---');
  const matchingChunks = await KnowledgeChunk.find({
    chunkText: { $regex: /karthikeyan|24ucs025/i }
  }).lean();

  console.log(`Found ${matchingChunks.length} matching chunk(s):\n`);
  for (const chunk of matchingChunks) {
    console.log(`[Chunk ID: ${chunk._id}]`);
    console.log(`Source Type: ${chunk.sourceType}`);
    console.log(`Subject: ${chunk.subject}`);
    console.log(`Chunk Index: ${chunk.chunkIndex}`);
    console.log(`Chunk Text Length: ${chunk.chunkText.length} characters`);
    console.log(`Chunk Text:\n"""\n${chunk.chunkText}\n"""\n`);
  }

  // Also check all projectDoc chunks around chunkIndex 0
  const allProjectDocChunks = await KnowledgeChunk.find({ sourceType: 'projectDoc' }).sort({ chunkIndex: 1 }).lean();
  console.log(`Total projectDoc chunks: ${allProjectDocChunks.length}`);
  console.log('ProjectDoc Chunk Indices & lengths:');
  allProjectDocChunks.forEach(c => {
    const hasName = /karthikeyan/i.test(c.chunkText);
    console.log(`  Index ${c.chunkIndex} (ID: ${c._id}): length=${c.chunkText.length}, hasTeamMemberName=${hasName}`);
  });

  // Step 2: Generate embeddings and compute cosine similarities
  console.log('\n--- STEP 2: EMBEDDING & SIMILARITY COMPARISON ---');
  const phrasingA = 'team member name of the project';
  const phrasingB = 'project team member name';

  console.log(`Generating embedding for Phrasing A: "${phrasingA}"...`);
  const embA = await generateEmbedding(phrasingA);

  console.log(`Generating embedding for Phrasing B: "${phrasingB}"...`);
  const embB = await generateEmbedding(phrasingB);

  const allChunks = await KnowledgeChunk.find({}).lean();
  console.log(`Computing similarities against ${allChunks.length} total knowledge chunks...\n`);

  const scoredA = allChunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(embA, chunk.embedding)
  })).sort((a, b) => b.score - a.score);

  const scoredB = allChunks.map(chunk => ({
    chunk,
    score: cosineSimilarity(embB, chunk.embedding)
  })).sort((a, b) => b.score - a.score);

  console.log('========================================================================================================');
  console.log('TOP 8 CHUNKS FOR PHRASING A: "team member name of the project"');
  console.log('========================================================================================================');
  scoredA.slice(0, 8).forEach((item, idx) => {
    const c = item.chunk;
    const hasName = /karthikeyan/i.test(c.chunkText);
    console.log(`Rank #${idx + 1} | Score: ${item.score.toFixed(4)} | Match? ${hasName ? '>>> YES <<<' : 'No'} | ID: ${c._id} | Type: ${c.sourceType} | Idx: ${c.chunkIndex} | Subj: ${c.subject || 'N/A'}`);
    console.log(`   Snippet: ${c.chunkText.slice(0, 120).replace(/\n/g, ' ')}...\n`);
  });

  console.log('========================================================================================================');
  console.log('TOP 8 CHUNKS FOR PHRASING B: "project team member name"');
  console.log('========================================================================================================');
  scoredB.slice(0, 8).forEach((item, idx) => {
    const c = item.chunk;
    const hasName = /karthikeyan/i.test(c.chunkText);
    console.log(`Rank #${idx + 1} | Score: ${item.score.toFixed(4)} | Match? ${hasName ? '>>> YES <<<' : 'No'} | ID: ${c._id} | Type: ${c.sourceType} | Idx: ${c.chunkIndex} | Subj: ${c.subject || 'N/A'}`);
    console.log(`   Snippet: ${c.chunkText.slice(0, 120).replace(/\n/g, ' ')}...\n`);
  });

  // Where does the target chunk rank in A and B?
  const targetChunk = matchingChunks[0];
  if (targetChunk) {
    const rankA = scoredA.findIndex(item => item.chunk._id.toString() === targetChunk._id.toString()) + 1;
    const rankB = scoredB.findIndex(item => item.chunk._id.toString() === targetChunk._id.toString()) + 1;
    const scoreInA = scoredA.find(item => item.chunk._id.toString() === targetChunk._id.toString())?.score;
    const scoreInB = scoredB.find(item => item.chunk._id.toString() === targetChunk._id.toString())?.score;

    console.log('========================================================================================================');
    console.log(`TARGET CHUNK (ID: ${targetChunk._id}) RANKING SUMMARY:`);
    console.log(`- Phrasing A ("${phrasingA}"): Rank #${rankA} of ${allChunks.length} (Score: ${scoreInA?.toFixed(4)}) - Top 5 cutoff? ${rankA <= 5 ? 'INSIDE top 5' : 'OUTSIDE top 5 (MISSED!)'}`);
    console.log(`- Phrasing B ("${phrasingB}"): Rank #${rankB} of ${allChunks.length} (Score: ${scoreInB?.toFixed(4)}) - Top 5 cutoff? ${rankB <= 5 ? 'INSIDE top 5' : 'OUTSIDE top 5 (MISSED!)'}`);
    console.log('========================================================================================================');
  }

  await mongoose.disconnect();
}

diagnose().catch(err => {
  console.error(err);
  process.exit(1);
});
