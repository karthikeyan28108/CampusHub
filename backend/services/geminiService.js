import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_gemini_api_key_here') {
    return null;
  }
  return key;
};

const getGenAIClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured. Please set a valid Gemini API key in backend/.env.');
  }
  return new GoogleGenerativeAI(apiKey);
};

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONALITY = 768;

/**
 * Generate embedding vector using Gemini gemini-embedding-001
 * with outputDimensionality: 768 for consistent, storage-light vector size.
 * @param {string} text
 * @returns {Promise<number[]>} Array of embedding numbers (768 dimensions)
 */
export const generateEmbedding = async (text) => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text.');
  }

  const genAI = getGenAIClient();
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  
  const result = await model.embedContent({
    content: { parts: [{ text: text.slice(0, 8000) }] },
    outputDimensionality: EMBEDDING_DIMENSIONALITY
  });

  if (!result || !result.embedding || !result.embedding.values) {
    throw new Error('No embedding values returned from Gemini API.');
  }

  return result.embedding.values;
};

export const CHAT_MODEL = 'gemini-3.6-flash';

/**
 * Generate chat response using gemini-3.6-flash (with robust fallbacks to gemini-3.5-flash and gemini-3.1-flash-lite)
 * @param {string} prompt
 * @param {string} systemInstruction
 * @param {boolean} [returnMetadata=false]
 * @returns {Promise<string|object>}
 */
export const generateChatResponse = async (prompt, systemInstruction, returnMetadata = false) => {
  const genAI = getGenAIClient();
  const modelsToTry = [CHAT_MODEL, 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  let lastError = null;
  const fallbackAttempts = [];

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction ? {
          role: 'system',
          parts: [{ text: systemInstruction }]
        } : undefined
      });

      const response = await model.generateContent(prompt);
      const text = response.response.text();
      const isFallback = modelName !== CHAT_MODEL;

      const result = {
        text,
        modelUsed: modelName,
        isFallback,
        primaryModel: CHAT_MODEL,
        fallbackAttempts
      };

      return returnMetadata ? result : text;
    } catch (err) {
      lastError = err;
      const isRateLimit = /429|quota|rate limit|resource_exhausted/i.test(err.message);
      fallbackAttempts.push({
        model: modelName,
        message: err.message,
        isRateLimit
      });
      console.warn(`Gemini generation with ${modelName} failed, trying next candidate:`, err.message);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  throw new Error(`Failed to generate response from Gemini: ${lastError?.message || 'Unknown error'}`);
};

/**
 * Compute cosine similarity between two numeric vectors in pure JavaScript
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Cosine similarity (-1 to 1)
 */
export const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};
