import '../config/env.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Note from '../models/Note.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { indexNote, indexProjectDocument } from '../services/indexingService.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBackfill() {
  console.log('====================================================');
  console.log('       CampusHub RAG Knowledge Base Backfill        ');
  console.log('====================================================\n');

  try {
    await connectDB();
    // Wait for connection readyState if needed
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => mongoose.connection.once('connected', resolve));
    }

    // Purge any existing chunks to ensure all embeddings are compatible with gemini-embedding-001 (768-dim)
    console.log('Clearing existing KnowledgeChunk collection to remove incompatible old embeddings...');
    await KnowledgeChunk.deleteMany({});
    console.log('Knowledge base collection cleared.\n');

    // 1. Backfill all Notes
    const notes = await Note.find({});
    console.log(`Found ${notes.length} note(s) in Notes Hub to index.`);

    let indexedNotes = 0;
    let failedNotes = 0;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      console.log(`\n[${i + 1}/${notes.length}] Indexing note: "${note.title}" (Subject: ${note.subject}, ID: ${note._id})...`);
      
      const result = await indexNote(note._id);
      if (result && result.success) {
        indexedNotes++;
      } else {
        failedNotes++;
      }

      // Delay between notes to respect API limits
      await sleep(500);
    }

    console.log(`\nNotes indexing completed: ${indexedNotes} succeeded, ${failedNotes} failed/skipped.`);

    // 2. Index the Project Document
    console.log('\nIndexing reference Project Document (project-document.pdf)...');
    const docResult = await indexProjectDocument();
    if (docResult && docResult.success) {
      console.log(`Project Document indexed successfully: ${docResult.indexedChunks} chunks.`);
    } else {
      console.warn(`Project Document indexing finished with status:`, docResult);
    }

    console.log('\n====================================================');
    console.log('       Backfill Process Completed Successfully!      ');
    console.log('====================================================');
  } catch (error) {
    console.error('Fatal error during backfill:', error);
  } finally {
    try {
      await mongoose.connection.close();
      console.log('Database connection closed.');
    } catch (_) {}
    process.exit(0);
  }
}

runBackfill();
