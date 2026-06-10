import { Server } from 'socket.io';
import User from '../models/User.js';

let io = null;
const userSockets = new Map(); // Maps userId -> Set(socketIds)

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId;
    if (!userId || userId === 'undefined') {
      return socket.disconnect();
    }

    // Register user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join personal user room for targeted notifications
    socket.join(userId);

    // Set user online
    setUserStatus(userId, 'online');

    // Notify other users
    socket.broadcast.emit('user_presence_change', {
      userId,
      status: 'online',
      lastSeen: new Date()
    });

    console.log(`User connected: ${userId} (Socket: ${socket.id}). Total online: ${userSockets.size}`);

    // Join chats room
    socket.on('join_chat', (chatId) => {
      socket.join(chatId);
      console.log(`Socket ${socket.id} joined chat room: ${chatId}`);
    });

    socket.on('leave_chat', (chatId) => {
      socket.leave(chatId);
      console.log(`Socket ${socket.id} left chat room: ${chatId}`);
    });

    // Typing status indicators
    socket.on('typing', ({ chatId, username }) => {
      socket.to(chatId).emit('typing', { chatId, userId, username });
    });

    socket.on('stop_typing', ({ chatId }) => {
      socket.to(chatId).emit('stop_typing', { chatId, userId });
    });

    // WebRTC Calling signaling routing
    socket.on('call_user', ({ userToCall, signalData, from, callerName, type }) => {
      console.log(`Incoming call request from ${from} to ${userToCall} type: ${type}`);
      // Route signaling data to recipient's personal room
      io.to(userToCall).emit('call_incoming', {
        signal: signalData,
        from,
        callerName,
        type // 'audio' or 'video'
      });
    });

    socket.on('answer_call', ({ to, signal }) => {
      console.log(`Call answered by receiver. Forwarding answer back to caller: ${to}`);
      io.to(to).emit('call_accepted', signal);
    });

    socket.on('ice_candidate', ({ to, candidate }) => {
      io.to(to).emit('ice_candidate', candidate);
    });

    socket.on('reject_call', ({ to }) => {
      console.log(`Call rejected. Routing to: ${to}`);
      io.to(to).emit('call_rejected');
    });

    socket.on('hangup_call', ({ to }) => {
      console.log(`Call terminated. Routing to: ${to}`);
      io.to(to).emit('call_ended');
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
      const userConnections = userSockets.get(userId);
      if (userConnections) {
        userConnections.delete(socket.id);
        if (userConnections.size === 0) {
          userSockets.delete(userId);
          const offlineTime = new Date();
          setUserStatus(userId, 'offline', offlineTime);
          
          // Notify others user has gone offline
          socket.broadcast.emit('user_presence_change', {
            userId,
            status: 'offline',
            lastSeen: offlineTime
          });
          console.log(`User completely disconnected: ${userId}. Active users remaining: ${userSockets.size}`);
        }
      }
    });
  });

  return io;
};

const setUserStatus = async (userId, status, lastSeen = new Date()) => {
  try {
    await User.findByIdAndUpdate(userId, { status, lastSeen });
  } catch (error) {
    console.error('Error updating user status in MongoDB:', error);
  }
};

export const getIO = () => io;
export const getActiveSockets = () => userSockets;
