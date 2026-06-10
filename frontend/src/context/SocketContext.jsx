import React, { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext.jsx';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState({}); // Maps userId -> { status, lastSeen }

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Initialize Socket connection
    const newSocket = io('http://localhost:5000', {
      query: { userId: user._id },
      transports: ['websocket'],
      withCredentials: true,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket.io connected successfully:', newSocket.id);
    });

    // Handle presence shifts
    newSocket.on('user_presence_change', ({ userId, status, lastSeen }) => {
      setOnlineUsers((prev) => ({
        ...prev,
        [userId]: { status, lastSeen }
      }));
    });

    // Clean up connections on unmount or user logout
    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Query online status helper
  const getOnlineStatus = (userId) => {
    return onlineUsers[userId] || { status: 'offline', lastSeen: null };
  };

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, setOnlineUsers, getOnlineStatus }}>
      {children}
    </SocketContext.Provider>
  );
};
