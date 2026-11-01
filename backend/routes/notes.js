import express from 'express';
import Note from '../models/Note.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { upload, uploadFileToStorage } from '../services/storage.js';
import { indexNote } from '../services/indexingService.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// @route   POST /api/notes
// @desc    Upload a new note (Faculty/Admin only)
router.post('/', verifyToken, requireRole('faculty', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const { title, description, subject, department, year, semester } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Please upload a file'
      });
    }

    // Pre-read file buffer before uploadFileToStorage unlinks the local temporary file
    let fileBuffer = null;
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fileBuffer = await fs.promises.readFile(req.file.path);
      } catch (_) {}
    } else if (req.file?.buffer) {
      fileBuffer = req.file.buffer;
    }

    // Upload to Cloudinary or get local fallback path
    const uploadResult = await uploadFileToStorage(req.file);

    const note = await Note.create({
      title,
      description,
      fileUrl: uploadResult.url,
      fileType: uploadResult.fileType || req.file.mimetype,
      subject,
      department,
      year: Number(year),
      semester: Number(semester),
      uploadedBy: req.user.id
    });

    // Populate uploadedBy info
    const populatedNote = await Note.findById(note._id).populate('uploadedBy', 'name role email');

    // Asynchronously index the note using preloaded buffer (immune to Cloudinary access restrictions)
    indexNote(note._id, fileBuffer).catch((indexingError) => {
      console.error(`[Background Indexing Error] Note ${note._id}:`, indexingError.message);
    });

    res.status(201).json({
      status: 'success',
      note: populatedNote
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/notes
// @desc    Get notes list with filtering options
router.get('/', verifyToken, async (req, res) => {
  try {
    const { department, year, semester, subject, search } = req.query;
    
    const filter = {};
    
    if (department) filter.department = department;
    if (year) filter.year = Number(year);
    if (semester) filter.semester = Number(semester);
    if (subject) filter.subject = new RegExp(subject, 'i'); // case-insensitive substring
    
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') }
      ];
    }

    const notes = await Note.find(filter)
      .populate('uploadedBy', 'name role email')
      .sort({ createdAt: -1 });

    res.json({
      status: 'success',
      count: notes.length,
      notes
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   GET /api/notes/:id
// @desc    Get details of a single note
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).populate('uploadedBy', 'name role email');
    if (!note) {
      return res.status(404).json({
        status: 'error',
        message: 'Note not found'
      });
    }
    
    res.json({
      status: 'success',
      note
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// @route   DELETE /api/notes/:id
// @desc    Delete a note (Note owner or Admin only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        status: 'error',
        message: 'Note not found'
      });
    }

    // Role check: Only owner of the note or an admin can delete it
    if (note.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        status: 'error',
        message: 'Forbidden: You can only delete notes you have uploaded.'
      });
    }

    // If local file, delete it from disk
    if (note.fileUrl.startsWith('/uploads/')) {
      const filename = path.basename(note.fileUrl);
      const localFilePath = path.join('uploads', filename);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    }

    await note.deleteOne();

    // Clean up indexed knowledge chunks for the deleted note
    await KnowledgeChunk.deleteMany({ noteId: note._id }).catch((err) => {
      console.warn(`[KnowledgeChunk cleanup error] Note ${note._id}:`, err.message);
    });

    res.json({
      status: 'success',
      message: 'Note deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;
