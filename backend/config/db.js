import mongoose from 'mongoose';
import dns from 'dns';
import { initializeSingleAdmin } from '../services/adminInitService.js';

// Configure reliable DNS servers to avoid Windows querySrv ECONNREFUSED with MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Gracefully fallback if network environment restricts DNS override
}

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campushub';
    
    // Mask credentials for clean logging
    const safeUri = mongoUri.replace(/:([^:@]+)@/, ':****@');
    console.log(`Connecting to MongoDB at: ${safeUri}...`);

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000 // 10 seconds timeout for remote Atlas clusters
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await initializeSingleAdmin();
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    console.log('Attempting to fall back to in-memory MongoDB Server (mongodb-memory-server)...');
    
    try {
      // Try to load in-memory mongo dynamically
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      
      console.log('In-Memory MongoDB Server started. Connecting Mongoose...');
      const conn = await mongoose.connect(uri);
      console.log(`In-Memory MongoDB Connected: ${conn.connection.host}`);
      await initializeSingleAdmin();
    } catch (fallbackError) {
      console.warn('In-Memory MongoDB fallback unavailable (package still installing or binary download failed).');
      console.log('Please ensure a local MongoDB server is running on port 27017, or configure MONGO_URI in your backend/.env file.');
      console.log('CampusHub server will run with active endpoint routing, but database transactions will be buffered.');
    }
  }
};

export default connectDB;
