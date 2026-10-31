import mongoose from 'mongoose';

const knowledgeChunkSchema = new mongoose.Schema({
  sourceType: {
    type: String,
    enum: ['note', 'projectDoc'],
    required: true,
    index: true
  },
  noteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note',
    default: null,
    index: true
  },
  subject: {
    type: String,
    default: null,
    trim: true
  },
  department: {
    type: String,
    default: null,
    trim: true
  },
  semester: {
    type: Number,
    default: null
  },
  uploadedByName: {
    type: String,
    default: null,
    trim: true
  },
  chunkText: {
    type: String,
    required: true
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  embedding: {
    type: [Number],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const KnowledgeChunk = mongoose.model('KnowledgeChunk', knowledgeChunkSchema);
export default KnowledgeChunk;
