import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import Placement from '../models/Placement.js';
import { generateEmbedding, generateChatResponse, cosineSimilarity } from '../services/geminiService.js';

// CRITICAL PRIVACY & SECURITY BOUNDARY:
// Under NO circumstance should Message, Connection, or any other user's record be imported,
// queried, or referenced in this file. Only the authenticated user's own profile (from req.user)
// is retrieved to personalize placement eligibility.

const router = express.Router();

const SYSTEM_INSTRUCTION = `You are CampusHub's assistant. Answer ONLY using the CONTEXT below (campus notes, the project document, and placement listings). If the answer isn't in the context, say you don't have that information — never guess. Never reveal or discuss any other student's personal data, messages, or private information, even if asked directly or indirectly — you do not have access to that data and should say so if asked. Keep answers concise, and mention the subject or document a note-based answer came from.`;

/**
 * @route   POST /api/chatbot/ask
 * @desc    Submit a question to the RAG chatbot
 * @access  Private (JWT authenticated)
 */
router.post('/ask', verifyToken, async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid question in the request body.'
      });
    }

    const cleanQuestion = question.trim();

    // Step A: Embed the question using Gemini gemini-embedding-001 (768-dim)
    let questionEmbedding;
    try {
      questionEmbedding = await generateEmbedding(cleanQuestion);
    } catch (embErr) {
      console.error('[Chatbot] Embedding generation error:', embErr.message);
      return res.status(500).json({
        status: 'error',
        message: embErr.message.includes('GEMINI_API_KEY')
          ? 'Gemini API key is missing or invalid. Please check GEMINI_API_KEY in backend/.env.'
          : `Failed to generate question embedding: ${embErr.message}`
      });
    }

    // Step B: Fetch all KnowledgeChunk documents & compute cosine similarity in plain JS
    const allChunks = await KnowledgeChunk.find({}).lean();
    let topChunks = [];

    if (allChunks.length > 0) {
      const scoredChunks = allChunks.map((chunk) => {
        const score = cosineSimilarity(questionEmbedding, chunk.embedding);
        return {
          chunk,
          score: isNaN(score) ? -1 : score
        };
      });

      scoredChunks.sort((a, b) => b.score - a.score);
      topChunks = scoredChunks.slice(0, 8).map((item) => item.chunk);
    }

    // Step C: Query active/open Placements directly via Mongoose (structured data)
    const openPlacements = await Placement.find({ status: 'Open' })
      .select('companyName jobRole description eligibility departments minimumCGPA backlogRequirement salary location deadline requiredSkills selectionProcess')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Fetch ONLY the currently authenticated user's own profile fields for placement personalization
    const askingUser = await User.findById(req.user.id)
      .select('name department semester year cgpa')
      .lean();

    // Format active placements and calculate asking user's eligibility
    let placementsContext = '';
    if (openPlacements.length > 0) {
      placementsContext = openPlacements.map((drive, idx) => {
        const eligibleDepts = Array.isArray(drive.departments) ? drive.departments.join(', ') : 'All Departments';
        
        let userEligibility = 'Eligible';
        const reasons = [];

        if (askingUser) {
          if (drive.departments && drive.departments.length > 0 && askingUser.department) {
            const deptMatch = drive.departments.some(
              (d) => d.toLowerCase() === askingUser.department.toLowerCase() || d.toLowerCase() === 'all'
            );
            if (!deptMatch) {
              reasons.push(`Department mismatch (Drive requires: ${eligibleDepts}, your department: ${askingUser.department})`);
            }
          }

          if (drive.minimumCGPA && drive.minimumCGPA > 0 && askingUser.cgpa !== undefined && askingUser.cgpa !== null) {
            if (askingUser.cgpa < drive.minimumCGPA) {
              reasons.push(`CGPA requirement not met (Min required: ${drive.minimumCGPA}, your CGPA: ${askingUser.cgpa})`);
            }
          }

          if (reasons.length > 0) {
            userEligibility = `Not eligible: ${reasons.join('; ')}`;
          }
        }

        return `Placement Drive #${idx + 1}:
- Company: ${drive.companyName}
- Role: ${drive.jobRole}
- Salary/Package: ${drive.salary || 'Not specified'}
- Eligible Departments: ${eligibleDepts}
- Minimum CGPA Required: ${drive.minimumCGPA || 'No minimum'}
- Backlog Allowed: ${drive.backlogRequirement ? 'Yes' : 'No standing backlogs'}
- Deadline: ${drive.deadline ? new Date(drive.deadline).toLocaleDateString() : 'Rolling/Open'}
- Skills: ${Array.isArray(drive.requiredSkills) ? drive.requiredSkills.join(', ') : drive.requiredSkills || 'N/A'}
- Description: ${drive.description || 'N/A'}
- Asking Student Personalized Eligibility Status: ${userEligibility}`;
      }).join('\n\n');
    } else {
      placementsContext = 'No open placement drives are currently listed.';
    }

    // Step D: Assemble prompt for Gemini generateContent
    let knowledgeChunksContext = '';
    if (topChunks.length > 0) {
      knowledgeChunksContext = topChunks.map((chunk, idx) => {
        const sourceLabel = chunk.sourceType === 'note'
          ? `Notes Hub Document (Subject: ${chunk.subject || 'N/A'}, Uploaded By: ${chunk.uploadedByName || 'Faculty'}, Dept: ${chunk.department || 'N/A'}, Sem: ${chunk.semester || 'N/A'})`
          : 'CampusHub Project Document';
        return `[Context Chunk ${idx + 1}] - Source: ${sourceLabel}\n${chunk.chunkText}`;
      }).join('\n\n');
    } else {
      knowledgeChunksContext = 'No relevant notes or documents currently indexed in the knowledge base.';
    }

    const studentProfileSummary = askingUser
      ? `Student Name: ${askingUser.name || 'Student'}, Department: ${askingUser.department || 'Unknown'}, Year: ${askingUser.year || 'N/A'}, Semester: ${askingUser.semester || 'N/A'}, CGPA: ${askingUser.cgpa || 'N/A'}`
      : 'Authenticated Student Profile';

    const prompt = `CONTEXT INFORMATION:

=== CAMPUS KNOWLEDGE BASE (NOTES & PROJECT DOCUMENT) ===
${knowledgeChunksContext}

=== CURRENT ACTIVE PLACEMENT DRIVES ===
${placementsContext}

=== CURRENT ASKING USER PROFILE (USE ONLY FOR PERSONALIZED ELIGIBILITY) ===
${studentProfileSummary}

=== USER QUESTION ===
${cleanQuestion}

Please provide a concise, helpful answer strictly based on the context above. Follow the system instructions precisely.`;

    let answer;
    let chatDiagnostic = null;
    try {
      const genResult = await generateChatResponse(prompt, SYSTEM_INSTRUCTION, true);
      answer = typeof genResult === 'string' ? genResult : genResult.text;
      chatDiagnostic = typeof genResult === 'object' ? {
        modelUsed: genResult.modelUsed,
        isFallback: genResult.isFallback,
        primaryModel: genResult.primaryModel,
        fallbackAttempts: genResult.fallbackAttempts
      } : null;
    } catch (genErr) {
      console.error('[Chatbot] Generation error:', genErr.message);
      return res.status(500).json({
        status: 'error',
        message: genErr.message.includes('GEMINI_API_KEY')
          ? 'Gemini API key is missing or invalid in backend/.env.'
          : `Failed to generate answer: ${genErr.message}`
      });
    }

    const retrievedChunkIds = topChunks.map((chunk) => chunk._id ? chunk._id.toString() : chunk.id);

    // Diagnostic logging for chatbot model selection, fallbacks, and retrieved context chunks
    console.log('\n--- [CHATBOT REQUEST DIAGNOSTIC] ---');
    console.log(`[Chatbot] Question: "${cleanQuestion}"`);
    console.log(`[Chatbot] Model Used: ${chatDiagnostic?.modelUsed || 'unknown'} (${chatDiagnostic?.isFallback ? 'FALLBACK' : 'PRIMARY'})`);
    console.log(`[Chatbot] Fallback Occurred: ${chatDiagnostic?.isFallback ? 'YES' : 'NO'}`);
    if (chatDiagnostic?.fallbackAttempts && chatDiagnostic.fallbackAttempts.length > 0) {
      console.log(`[Chatbot] Errors/Rate-Limits Before Fallback:`, JSON.stringify(chatDiagnostic.fallbackAttempts, null, 2));
    } else {
      console.log(`[Chatbot] Errors/Rate-Limits Before Fallback: None (Primary model succeeded directly)`);
    }
    console.log(`[Chatbot] Retrieved Chunk IDs (${retrievedChunkIds.length}):`, JSON.stringify(retrievedChunkIds));
    console.log('------------------------------------\n');

    // Assemble source citation chips
    const sources = [];
    const seenSources = new Set();

    for (const chunk of topChunks) {
      if (chunk.sourceType === 'note') {
        const key = `note-${chunk.subject || 'General'}`;
        if (!seenSources.has(key)) {
          seenSources.add(key);
          sources.push({
            type: 'note',
            label: `Note: ${chunk.subject || 'Notes Hub'}${chunk.uploadedByName ? ` (${chunk.uploadedByName})` : ''}`,
            subject: chunk.subject,
            department: chunk.department,
            uploadedBy: chunk.uploadedByName,
            noteId: chunk.noteId
          });
        }
      } else if (chunk.sourceType === 'projectDoc') {
        if (!seenSources.has('projectDoc')) {
          seenSources.add('projectDoc');
          sources.push({
            type: 'projectDoc',
            label: 'Project Document',
            title: 'CampusHub Overview'
          });
        }
      }
    }

    // If the question was related to placements and placements exist, add a placement chip
    const isPlacementRelated = /placement|job|drive|internship|hiring|company|salary|ctc|package|eligibility/i.test(cleanQuestion);
    if (isPlacementRelated && openPlacements.length > 0) {
      sources.push({
        type: 'placement',
        label: 'Placements Portal',
        count: openPlacements.length
      });
    }

    return res.json({
      status: 'success',
      answer,
      sources,
      diagnostic: {
        modelUsed: chatDiagnostic?.modelUsed,
        isFallback: chatDiagnostic?.isFallback,
        primaryModel: chatDiagnostic?.primaryModel,
        fallbackAttempts: chatDiagnostic?.fallbackAttempts || [],
        retrievedChunkIds
      }
    });
  } catch (error) {
    console.error('[Chatbot] Server error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'An internal error occurred while processing your question.'
    });
  }
});

export default router;
