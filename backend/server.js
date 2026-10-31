import './config/env.js';
import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import connectDB from './config/db.js';
import configureSockets from './sockets/socketHandler.js';
import { startEventCleanupJob } from './services/eventCleanupService.js';
import { validateEncryptionKey } from './utils/encryption.js';

// Validate encryption secret key on startup
validateEncryptionKey();

// Connect to Database
connectDB();

// Initialize background watchdog for expired events (checks every 10 minutes)
startEventCleanupJob(10);

const PORT = process.env.PORT || 5000;

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST'],
    credentials: true
  }
});
app.set('io', io);

// Configure Socket event routing and auth middlewares
configureSockets(io);

// Run server
server.listen(PORT, () => {
  console.log(`CampusHub Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  
  // Monitor process memory usage every 30 seconds
  const initialMem = process.memoryUsage();
  console.log(`[Memory Monitor] Startup Heap Used: ${(initialMem.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(initialMem.heapTotal / 1024 / 1024).toFixed(2)} MB | RSS: ${(initialMem.rss / 1024 / 1024).toFixed(2)} MB`);
  
  setInterval(() => {
    const mem = process.memoryUsage();
    const heapUsedMB = (mem.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (mem.heapTotal / 1024 / 1024).toFixed(2);
    const rssMB = (mem.rss / 1024 / 1024).toFixed(2);
    console.log(`[Memory Monitor] Heap Used: ${heapUsedMB} MB / ${heapTotalMB} MB | RSS: ${rssMB} MB`);
  }, 30000);
});

