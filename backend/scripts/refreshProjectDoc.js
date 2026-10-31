import '../config/env.js';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { indexProjectDocument } from '../services/indexingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runRefresh() {
  console.log('====================================================');
  console.log('  CampusHub RAG Knowledge Base - Project Doc Refresh');
  console.log('====================================================\n');

  try {
    // Connect to database
    await connectDB();
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => mongoose.connection.once('connected', resolve));
    }

    // Check pre-refresh counts
    const preProjectCount = await KnowledgeChunk.countDocuments({ sourceType: 'projectDoc' });
    const preNoteCount = await KnowledgeChunk.countDocuments({ sourceType: 'note' });
    console.log(`Current KnowledgeChunk State:`);
    console.log(`  - "projectDoc" chunks: ${preProjectCount}`);
    console.log(`  - "note" chunks: ${preNoteCount} (MUST be preserved)\n`);

    // Step 1: Delete all existing KnowledgeChunk documents where sourceType === "projectDoc" ONLY
    console.log('Step 1: Deleting existing "projectDoc" chunks ONLY...');
    const deleteResult = await KnowledgeChunk.deleteMany({ sourceType: 'projectDoc' });
    console.log(`  ✅ Deleted ${deleteResult.deletedCount} "projectDoc" chunk(s).`);

    // Verify note chunks were NOT touched
    const postDeleteNoteCount = await KnowledgeChunk.countDocuments({ sourceType: 'note' });
    console.log(`  ✅ Verified "note" chunks intact: ${postDeleteNoteCount} (unmodified).\n`);

    // Step 2: Re-run indexProjectDocument() with the PDF at backend/knowledge-base/project-document.pdf
    const docPath = path.resolve(__dirname, '../knowledge-base/project-document.pdf');
    console.log(`Step 2: Re-indexing Project Document from: ${docPath}...`);
    const indexResult = await indexProjectDocument(docPath);

    if (!indexResult || !indexResult.success) {
      throw new Error(`Project Document indexing failed: ${JSON.stringify(indexResult)}`);
    }
    console.log(`  ✅ Indexing completed: ${indexResult.indexedChunks}/${indexResult.totalChunks} chunk(s) indexed with gemini-embedding-001.\n`);

    // Step 3: Query KnowledgeChunk collection and report counts & sample chunk
    console.log('Step 3: Querying KnowledgeChunk collection after refresh...');
    const finalProjectCount = await KnowledgeChunk.countDocuments({ sourceType: 'projectDoc' });
    const finalNoteCount = await KnowledgeChunk.countDocuments({ sourceType: 'note' });
    console.log(`Final KnowledgeChunk State:`);
    console.log(`  - "projectDoc" chunks: ${finalProjectCount}`);
    console.log(`  - "note" chunks: ${finalNoteCount} (verified untouched)\n`);

    const sampleChunk = await KnowledgeChunk.findOne({ sourceType: 'projectDoc' }).sort({ chunkIndex: 1 });
    
    if (sampleChunk) {
      console.log('----------------------------------------------------');
      console.log(`Sample Chunk (Index: ${sampleChunk.chunkIndex}, Subject: "${sampleChunk.subject}"):`);
      console.log('----------------------------------------------------');
      console.log(sampleChunk.chunkText);
      console.log('----------------------------------------------------');
      console.log(`Embedding Dimensions: ${sampleChunk.embedding ? sampleChunk.embedding.length : 0}`);
    } else {
      console.warn('⚠️ No sample chunk found!');
    }

    console.log('\n====================================================');
    console.log('🎉 Project Document Refresh Completed Successfully!');
    console.log('====================================================\n');

  } catch (error) {
    console.error('\n❌ Error refreshing Project Document knowledge base:', error);
    process.exit(1);
  } finally {
    try {
      await mongoose.connection.close();
      console.log('Database connection closed.');
    } catch (_) {}
    process.exit(0);
  }
}

runRefresh();
