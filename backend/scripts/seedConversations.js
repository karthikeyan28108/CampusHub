import dns from 'dns';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import User from '../models/User.js';
import Message from '../models/Message.js';
import Connection, { normalizePair } from '../models/Connection.js';
import { encrypt } from '../utils/encryption.js';

async function seedConversations() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is not configured.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log('MongoDB Connected successfully!');

  // Retrieve student users
  const bharathi = await User.findOne({ registerNumber: '24ucs001' });
  const abinaya = await User.findOne({ registerNumber: '24ucs002' });
  const gayathiri = await User.findOne({ registerNumber: '24ucs003' });
  const gopiga = await User.findOne({ registerNumber: '24ucs004' });
  const harini = await User.findOne({ registerNumber: '24ucs005' });
  const kamala = await User.findOne({ registerNumber: '24ucs006' });

  if (!bharathi || !abinaya || !gayathiri || !gopiga || !harini || !kamala) {
    throw new Error('Could not find all required student users. Make sure seedUsersAndHubs.js ran.');
  }

  console.log('Found student accounts for pairs.');

  const now = Date.now();
  const minutesAgo = (mins) => new Date(now - mins * 60 * 1000);

  const conversationBatches = [
    // Conversation 1: Bharathi (24ucs001) <-> Abinaya (24ucs002)
    {
      user1: bharathi,
      user2: abinaya,
      messages: [
        { sender: bharathi, receiver: abinaya, text: 'Hi Abinaya!', time: minutesAgo(45) },
        { sender: abinaya, receiver: bharathi, text: 'Hello Bharathi! Good morning, how are you?', time: minutesAgo(42) },
        { sender: bharathi, receiver: abinaya, text: 'I am doing great! Have you checked out the notes for Computer Networks in Notes Hub?', time: minutesAgo(38) },
        { sender: abinaya, receiver: bharathi, text: 'Yes, I just reviewed Unit 4. The AI explanation is really helpful!', time: minutesAgo(35) },
        { sender: bharathi, receiver: abinaya, text: 'Awesome! Let\'s register for HackFest 2026 together as a team.', time: minutesAgo(28) },
        { sender: abinaya, receiver: bharathi, text: 'Sounds good, let\'s do it today!', time: minutesAgo(24) }
      ]
    },
    // Conversation 2: Gayathiri (24ucs003) <-> Gopiga (24ucs004)
    {
      user1: gayathiri,
      user2: gopiga,
      messages: [
        { sender: gayathiri, receiver: gopiga, text: 'Hi Gopiga!', time: minutesAgo(65) },
        { sender: gopiga, receiver: gayathiri, text: 'Hello Gayathiri! How are you doing?', time: minutesAgo(61) },
        { sender: gayathiri, receiver: gopiga, text: 'Good morning! Are you attending the Deep Learning & GenAI workshop on the 25th?', time: minutesAgo(56) },
        { sender: gopiga, receiver: gayathiri, text: 'Yes, I already saved the event in Events Hub! See you in the CS seminar hall.', time: minutesAgo(52) }
      ]
    },
    // Conversation 3: Harini (24ucs005) <-> Kamala (24ucs006)
    {
      user1: harini,
      user2: kamala,
      messages: [
        { sender: harini, receiver: kamala, text: 'Hi Kamala!', time: minutesAgo(90) },
        { sender: kamala, receiver: harini, text: 'Hello Harini! Good morning, how are you?', time: minutesAgo(87) },
        { sender: harini, receiver: kamala, text: 'Doing well! Did you see the new Google and Microsoft placement drives posted in Placements Hub?', time: minutesAgo(82) },
        { sender: kamala, receiver: harini, text: 'Yes! The eligibility criteria look great. We should start preparing our resumes and DSA questions right away.', time: minutesAgo(78) }
      ]
    }
  ];

  let totalMessagesInserted = 0;

  for (const batch of conversationBatches) {
    const { user1, user2, messages } = batch;
    console.log(`\nProcessing conversation: ${user1.name} (${user1.registerNumber}) <-> ${user2.name} (${user2.registerNumber})`);

    // 1. Establish accepted Connection between user1 and user2
    const { userA, userB } = normalizePair(user1._id, user2._id);
    await Connection.findOneAndUpdate(
      { userA, userB },
      {
        userA,
        userB,
        status: 'accepted',
        initiatedBy: user1._id,
        firstMessageSent: true,
        isExempt: false,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );
    console.log(`[Connection] Accepted connection established between ${user1.name} and ${user2.name}.`);

    // 2. Remove any previous sample messages between this pair to prevent duplicate accumulation
    await Message.deleteMany({
      $or: [
        { sender: user1._id, receiver: user2._id },
        { sender: user2._id, receiver: user1._id }
      ]
    });

    // 3. Insert encrypted messages
    for (const m of messages) {
      const enc = encrypt(m.text);
      await Message.create({
        sender: m.sender._id,
        receiver: m.receiver._id,
        encryptedContent: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        content: m.text,
        delivered: true,
        deliveredAt: m.time,
        readAt: m.time,
        createdAt: m.time
      });
      totalMessagesInserted++;
      console.log(`  [Message] ${m.sender.name} -> ${m.receiver.name}: "${m.text}"`);
    }
  }

  console.log('\n=== CONVERSATION SEED SUMMARY ===');
  console.log(`Conversations created: ${conversationBatches.length}`);
  console.log(`Total messages created: ${totalMessagesInserted}`);
  console.log('Remaining students (24ucs007 to 24ucs016) left without messages for admin oversight contrast.');

  await mongoose.disconnect();
  console.log('MongoDB disconnected successfully.');
}

seedConversations().catch((err) => {
  console.error('Error seeding conversations:', err);
  process.exit(1);
});

