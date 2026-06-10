import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import connectDB from './config/db.js';
import { initSocket, getIO } from './services/socketService.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

// Route Imports
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import broadcastRoutes from './routes/broadcastRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// Models import for scheduled messages
import Message from './models/Message.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// ES module folder derivation
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: false, // Allows cross-origin image loading (avatars)
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());

// Body Parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve file uploads static directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/admin', adminRoutes);

// Root Endpoint
app.get('/', (req, res) => {
  res.json({ message: 'ConnectX API is running...' });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Initialize Socket.io
initSocket(server);

// Background Worker: Message Scheduling Dispatcher
// Checks for unsent messages scheduled for the current or past date and sends them
setInterval(async () => {
  try {
    const now = new Date();
    const dueMessages = await Message.find({
      scheduledFor: { $lte: now },
      isSent: false
    }).populate('sender', 'username fullName profilePicture status lastSeen publicKey');

    if (dueMessages.length > 0) {
      console.log(`[Worker] Dispatching ${dueMessages.length} scheduled messages due...`);
    }

    for (let msg of dueMessages) {
      msg.isSent = true;
      msg.createdAt = now; // Update timestamp to dispatch time
      await msg.save();

      // Broadcast to socket room
      const io = getIO();
      if (io) {
        io.to(msg.chat.toString()).emit('receive_message', msg);
      }
    }
  } catch (error) {
    console.error('[Worker Error] Error running message scheduling dispatcher:', error);
  }
}, 15000); // Check every 15 seconds

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
