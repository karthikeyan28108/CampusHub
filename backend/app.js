import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth.js';
import passwordResetRoutes from './routes/passwordReset.routes.js';
import notesRoutes from './routes/notes.js';
import chatRoutes from './routes/chat.js';
import placementsRoutes from './routes/placements.js';
import eventsRoutes from './routes/events.js';
import adminRoutes from './routes/admin.js';
import usersRoutes from './routes/users.js';
import connectionsRoutes from './routes/connections.js';
import chatbotRoutes from './routes/chatbot.js';

const app = express();

// Standard middleware: Dynamic CORS supporting credentials from Vercel & local environments
app.use(cors({
  origin: (origin, callback) => {
    // Dynamically reflect requesting origin to satisfy browser credentials: true requirement
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads folder (fallback storage for notes hub)
app.use('/uploads', express.static('uploads'));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/placements', placementsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/chatbot', chatbotRoutes);

// Simple test API route for verification
app.get('/api/test', (req, res) => {
  res.json({
    status: 'success',
    message: 'Hello from CampusHub Backend API!',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.send('CampusHub API is running.');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal Server Error'
  });
});

export default app;
