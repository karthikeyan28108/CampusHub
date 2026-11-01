import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import Note from '../models/Note.js';
import User from '../models/User.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { generateEmbedding } from './geminiService.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Split text into ~800-character chunks with ~100-character overlap
 * @param {string} text
 * @param {number} chunkSize
 * @param {number} overlap
 * @returns {string[]}
 */
export const chunkText = (text, chunkSize = 800, overlap = 100) => {
  if (!text || typeof text !== 'string') return [];
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const chunks = [];
  const step = Math.max(1, chunkSize - overlap);
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }
    if (end === normalized.length) break;
    start += step;
  }

  return chunks;
};

/**
 * Fetch file buffer from remote URL or local storage path
 * @param {string} fileUrl
 * @returns {Promise<Buffer>}
 */
export const fetchFileBuffer = async (fileUrl) => {
  if (!fileUrl) {
    throw new Error('No fileUrl provided');
  }

  // Handle remote HTTP/HTTPS URL (e.g. Cloudinary)
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file from ${fileUrl}: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  // Handle local filesystem path (e.g. /uploads/filename or uploads/filename)
  const cleanPath = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
  const localFilePath = path.isAbsolute(cleanPath) ? cleanPath : path.join(process.cwd(), cleanPath);

  if (fs.existsSync(localFilePath)) {
    return await fs.promises.readFile(localFilePath);
  }

  // Check fallback inside backend/uploads/
  const uploadsFallback = path.join(process.cwd(), 'uploads', path.basename(fileUrl));
  if (fs.existsSync(uploadsFallback)) {
    return await fs.promises.readFile(uploadsFallback);
  }

  throw new Error(`Local file not found at ${localFilePath} or ${uploadsFallback}`);
};

/**
 * Extract raw text from buffer based on file type or extension
 * @param {Buffer} buffer
 * @param {string} fileType
 * @param {string} filename
 * @returns {Promise<string>}
 */
export const extractTextFromBuffer = async (buffer, fileType = '', filename = '') => {
  const isPdf = (fileType && fileType.toLowerCase().includes('pdf')) || (filename && filename.toLowerCase().endsWith('.pdf'));
  const isDocx = (fileType && (fileType.toLowerCase().includes('word') || fileType.toLowerCase().includes('officedocument'))) ||
                (filename && (filename.toLowerCase().endsWith('.docx') || filename.toLowerCase().endsWith('.doc')));

  if (isPdf) {
    let parser = null;
    try {
      parser = new PDFParse({ data: buffer });
      const textResult = await parser.getText();
      return textResult?.text || '';
    } finally {
      if (parser && typeof parser.destroy === 'function') {
        try {
          await parser.destroy();
        } catch (_) {}
      }
    }
  }

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return result?.value || '';
  }

  // Fallback for plain text or markdown files
  try {
    return buffer.toString('utf-8');
  } catch (err) {
    throw new Error(`Unsupported document format for text extraction (${fileType || filename})`);
  }
};

/**
 * Index a single Note into KnowledgeChunks
 * @param {string|mongoose.Types.ObjectId} noteId
 * @param {Buffer|null} [preloadedBuffer=null]
 */
export const indexNote = async (noteId, preloadedBuffer = null) => {
  try {
    console.log(`[RAG Indexer] Starting indexing for noteId: ${noteId}`);
    const note = await Note.findById(noteId).populate('uploadedBy', 'name role');
    if (!note) {
      console.warn(`[RAG Indexer] Note not found for id: ${noteId}`);
      return { success: false, reason: 'Note not found' };
    }

    if (!preloadedBuffer && !note.fileUrl) {
      console.warn(`[RAG Indexer] Note ${noteId} has no fileUrl`);
      return { success: false, reason: 'No fileUrl' };
    }

    const buffer = preloadedBuffer || await fetchFileBuffer(note.fileUrl);
    const extractedText = await extractTextFromBuffer(buffer, note.fileType, note.fileUrl);

    if (!extractedText || extractedText.trim().length === 0) {
      console.warn(`[RAG Indexer] No text could be extracted from note ${noteId}`);
      return { success: false, reason: 'No text extracted' };
    }

    const uploaderName = note.uploadedBy?.name || 'Faculty Member';

    // Include title, subject, uploader name and description context in the indexed text
    const fullText = `Title: ${note.title}\nSubject: ${note.subject}\nDepartment: ${note.department}\nSemester: ${note.semester}\nUploaded By: ${uploaderName}\nDescription: ${note.description}\n\nContent:\n${extractedText}`;
    const chunks = chunkText(fullText, 800, 100);

    if (chunks.length === 0) {
      return { success: false, reason: 'No chunks generated' };
    }

    // Remove existing chunks for this note to prevent duplicates
    await KnowledgeChunk.deleteMany({ noteId: note._id });

    let indexedCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        // Delay 250ms to respect Gemini free-tier rate limits
        if (i > 0) {
          await sleep(250);
        }

        const embedding = await generateEmbedding(chunk);
        await KnowledgeChunk.create({
          sourceType: 'note',
          noteId: note._id,
          subject: note.subject,
          department: note.department,
          semester: note.semester,
          uploadedByName: uploaderName,
          chunkText: chunk,
          chunkIndex: i,
          embedding
        });
        indexedCount++;
      } catch (chunkError) {
        console.error(`[RAG Indexer] Error embedding chunk ${i} for note ${noteId}:`, chunkError.message);
      }
    }

    console.log(`[RAG Indexer] Successfully indexed note ${noteId}: ${indexedCount}/${chunks.length} chunks saved`);
    return { success: true, indexedChunks: indexedCount, totalChunks: chunks.length };
  } catch (error) {
    console.error(`[RAG Indexer] Indexing failed for note ${noteId}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Index the reference Project Document at backend/knowledge-base/project-document.pdf
 */
export const indexProjectDocument = async (customPath = null) => {
  try {
    const docPath = customPath || path.join(process.cwd(), 'knowledge-base', 'project-document.pdf');
    console.log(`[RAG Indexer] Checking Project Document at: ${docPath}`);

    if (!fs.existsSync(docPath)) {
      console.warn(`[RAG Indexer] Project document PDF not found at: ${docPath}`);
      return { success: false, reason: 'Project document file not found' };
    }

    const buffer = await fs.promises.readFile(docPath);
    const extractedText = await extractTextFromBuffer(buffer, 'application/pdf', 'project-document.pdf');

    if (!extractedText || extractedText.trim().length === 0) {
      console.warn(`[RAG Indexer] No text could be extracted from project document`);
      return { success: false, reason: 'No text extracted' };
    }

    // Isolate document title/metadata header (title, team member, project guide)
    // so key facts aren't diluted inside a larger body paragraph
    const headerMatch = extractedText.match(/([\s\S]*?)(?=1\.\s+Project Description)/i);
    let chunks = [];

    if (headerMatch && headerMatch[1].trim().length > 20) {
      const headerChunk = headerMatch[1].replace(/--\s*\d+\s*of\s*\d+\s*--/g, '').trim();
      const bodyText = extractedText.slice(headerMatch[0].length);
      const bodyChunks = chunkText(bodyText, 800, 100);
      chunks = [headerChunk, ...bodyChunks];
    } else {
      chunks = chunkText(extractedText, 800, 100);
    }

    if (chunks.length === 0) {
      return { success: false, reason: 'No chunks generated' };
    }

    // Clear prior projectDoc chunks
    await KnowledgeChunk.deleteMany({ sourceType: 'projectDoc' });

    let indexedCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        if (i > 0) {
          await sleep(250);
        }

        const embedding = await generateEmbedding(chunk);
        await KnowledgeChunk.create({
          sourceType: 'projectDoc',
          noteId: null,
          subject: 'CampusHub Project Overview',
          department: null,
          semester: null,
          chunkText: chunk,
          chunkIndex: i,
          embedding
        });
        indexedCount++;
      } catch (chunkError) {
        console.error(`[RAG Indexer] Error embedding chunk ${i} for Project Document:`, chunkError.message);
      }
    }

    console.log(`[RAG Indexer] Successfully indexed Project Document: ${indexedCount}/${chunks.length} chunks saved`);
    return { success: true, indexedChunks: indexedCount, totalChunks: chunks.length };
  } catch (error) {
    console.error(`[RAG Indexer] Project Document indexing failed:`, error.message);
    return { success: false, error: error.message };
  }
};
