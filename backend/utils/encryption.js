/**
 * ============================================================================
 * SECURITY BOUNDARY NOTICE: SERVER-SIDE ENCRYPTION-AT-REST
 * ============================================================================
 * This module implements symmetric server-side encryption-at-rest using
 * AES-256-GCM. Its primary purpose is to protect stored chat messages in the
 * MongoDB database in the event of an unauthorized database dump, leak, or direct
 * data access.
 *
 * NOTE FOR MAINTAINERS:
 * This is NOT end-to-end encryption (E2EE). The server holds the secret key
 * in environment memory and can read message plaintext during runtime processing
 * (such as routing, moderation, real-time socket delivery, and connection rules).
 * The encryption key must NEVER be transmitted to the frontend, included in client
 * bundles, or exposed through any API response.
 * ============================================================================
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes standard for AES-GCM
const KEY_LENGTH = 32; // 32 bytes = 256 bits

/**
 * Validates that ENCRYPTION_SECRET_KEY is defined in process.env and decodes
 * to exactly 32 bytes (256 bits).
 * Throws a clear descriptive error if missing or invalid.
 *
 * @returns {Buffer} The 32-byte secret key buffer
 */
export function validateEncryptionKey() {
  const rawKey = process.env.ENCRYPTION_SECRET_KEY;
  if (!rawKey) {
    throw new Error(
      'Server Startup Error: ENCRYPTION_SECRET_KEY is not defined in environment variables. ' +
      'Please set a base64-encoded 32-byte key.'
    );
  }

  const keyBuffer = Buffer.from(rawKey, 'base64');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `Server Startup Error: ENCRYPTION_SECRET_KEY must decode to exactly 32 bytes (256 bits) for AES-256-GCM. ` +
      `Received key length is ${keyBuffer.length} bytes.`
    );
  }

  return keyBuffer;
}

/**
 * Helper to get the validated secret key buffer.
 */
function getKeyBuffer() {
  return validateEncryptionKey();
}

/**
 * Encrypts plaintext string using AES-256-GCM.
 *
 * @param {string} plaintext - The plaintext message to encrypt
 * @returns {{ iv: string, authTag: string, ciphertext: string }} Base64-encoded payload
 */
export function encrypt(plaintext) {
  if (typeof plaintext !== 'string') {
    throw new TypeError('Plaintext must be a string');
  }

  const key = getKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return {
    iv: iv.toString('base64'),
    authTag,
    ciphertext
  };
}

/**
 * Decrypts an encrypted payload using AES-256-GCM and verifies the authentication tag.
 * Supports payload with keys: { iv, authTag, ciphertext } or { iv, authTag, encryptedContent }.
 *
 * @param {{ iv: string, authTag: string, ciphertext?: string, encryptedContent?: string }} payload
 * @returns {string} The decrypted plaintext string
 * @throws {Error} If authentication tag fails, data is corrupted, or inputs are invalid
 */
export function decrypt(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new TypeError('Payload must be an object containing iv, authTag, and ciphertext/encryptedContent');
  }

  const ivStr = payload.iv;
  const authTagStr = payload.authTag;
  const ciphertextStr = payload.ciphertext !== undefined ? payload.ciphertext : payload.encryptedContent;

  if (ivStr === undefined || authTagStr === undefined || ciphertextStr === undefined || ivStr === null || authTagStr === null || ciphertextStr === null) {
    throw new Error('Payload is missing required encryption components (iv, authTag, ciphertext/encryptedContent)');
  }

  const key = getKeyBuffer();
  const iv = Buffer.from(ivStr, 'base64');
  const authTag = Buffer.from(authTagStr, 'base64');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length} bytes`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertextStr, 'base64', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

export default {
  validateEncryptionKey,
  encrypt,
  decrypt
};
