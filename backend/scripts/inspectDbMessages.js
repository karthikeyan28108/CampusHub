import '../config/env.js';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Message from '../models/Message.js';
import { decrypt } from '../utils/encryption.js';

async function checkEncryptedMessages() {
  console.log('====================================================');
  console.log('       MongoDB `messages` Collection Inspection      ');
  console.log('====================================================\n');

  try {
    await connectDB();
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => mongoose.connection.once('connected', resolve));
    }

    const totalCount = await Message.countDocuments({});
    console.log(`Total messages currently in database: ${totalCount}\n`);

    if (totalCount === 0) {
      console.log('No messages found in database.');
      return;
    }

    // Fetch the 5 most recent raw documents from MongoDB
    const recentMessages = await Message.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    console.log('Inspecting raw MongoDB documents directly (bypass Mongoose):\n');

    recentMessages.forEach((msg, idx) => {
      console.log(`--- Message #${idx + 1} (ID: ${msg._id}) ---`);
      console.log(`  CreatedAt       : ${msg.createdAt}`);
      console.log(`  Sender ID       : ${msg.sender}`);
      console.log(`  Receiver ID     : ${msg.receiver || '(Room / None)'}`);
      console.log(`  Room            : ${msg.room || '(Direct Message)'}`);
      console.log(`  Plaintext 'content' in DB : ${JSON.stringify(msg.content)}`);
      console.log(`  EncryptedContent: ${msg.encryptedContent ? `${msg.encryptedContent.slice(0, 32)}... (${msg.encryptedContent.length} chars)` : 'NULL'}`);
      console.log(`  IV (12-byte)    : ${msg.iv || 'NULL'}`);
      console.log(`  AuthTag (16-byte): ${msg.authTag || 'NULL'}`);

      // Verify encryption integrity
      const isEncrypted = Boolean(msg.encryptedContent && msg.iv && msg.authTag);
      const plaintextLeak = msg.content !== null && msg.content !== undefined && msg.content !== '';

      if (isEncrypted) {
        console.log(`  ✅ Storage Security: Message IS stored encrypted with AES-256-GCM`);
        if (!plaintextLeak) {
          console.log(`  ✅ Data Leak Check : NO plaintext content stored in DB`);
        } else {
          console.log(`  ⚠️ Legacy record: plaintext content also present`);
        }

        try {
          const decryptedText = decrypt({
            iv: msg.iv,
            authTag: msg.authTag,
            ciphertext: msg.encryptedContent
          });
          console.log(`  🔓 Decrypted Result: "${decryptedText}"`);
        } catch (err) {
          console.log(`  ❌ Decryption Failed: ${err.message}`);
        }
      } else {
        console.log(`  ℹ️ Legacy record: stored unencrypted (content: "${msg.content}")`);
      }

      console.log('');
    });

  } catch (error) {
    console.error('Error inspecting messages:', error);
  } finally {
    try {
      await mongoose.connection.close();
      console.log('Database connection closed.');
    } catch (_) {}
    process.exit(0);
  }
}

checkEncryptedMessages();
