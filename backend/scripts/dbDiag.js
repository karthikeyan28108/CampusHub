import '../config/env.js';
import connectDB from '../config/db.js';
import mongoose from 'mongoose';
import Message from '../models/Message.js';

async function diagnoseDb() {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => mongoose.connection.once('connected', resolve));
  }

  console.log('====================================================');
  console.log(' Mongoose Connection & Database Details');
  console.log('====================================================');
  console.log('Host                     :', mongoose.connection.host);
  console.log('Port                     :', mongoose.connection.port);
  console.log('Database Name (conn.name):', mongoose.connection.name);
  console.log('Database Name (conn.db)  :', mongoose.connection.db.databaseName);
  console.log('Message Collection Name  :', Message.collection.name);
  
  const totalCount = await Message.countDocuments();
  console.log('\nTotal Message Documents in DB:', totalCount);

  // List all collections
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('All collections in database:', collections.map(c => c.name));

  // List databases available on this MongoDB server instance
  const adminDb = mongoose.connection.db.admin();
  try {
    const dbs = await adminDb.listDatabases();
    console.log('\nAll databases on this MongoDB server instance:');
    for (const d of dbs.databases) {
      console.log(` - ${d.name} (sizeOnDisk: ${d.sizeOnDisk} bytes, empty: ${d.empty})`);
    }
  } catch (err) {
    console.log('Could not list all databases:', err.message);
  }

  // 10 most recent messages
  console.log('\n====================================================');
  console.log(' 10 Most Recent Message Documents in `messages` Collection:');
  console.log('====================================================');
  const recent = await Message.find({}).sort({ createdAt: -1 }).limit(10).lean();
  recent.forEach((msg, idx) => {
    console.log(`[#${idx + 1}] ID: ${msg._id}`);
    console.log(`     CreatedAt: ${msg.createdAt}`);
    console.log(`     Sender   : ${msg.sender}`);
    console.log(`     Receiver : ${msg.receiver || '(none / room)'}`);
    console.log(`     Room     : ${msg.room || '(direct message)'}`);
    console.log(`     Has EncryptedContent: ${Boolean(msg.encryptedContent)} (${msg.encryptedContent ? msg.encryptedContent.slice(0, 20) + '...' : 'null'})`);
    console.log(`     Has Plaintext Content: ${JSON.stringify(msg.content)}`);
  });

  await mongoose.connection.close();
  process.exit(0);
}

diagnoseDb().catch(console.error);
