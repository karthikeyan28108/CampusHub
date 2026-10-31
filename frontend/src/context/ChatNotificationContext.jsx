import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import api from '../services/api.js';

const ChatNotificationContext = createContext(null);

export const ChatNotificationProvider = ({ children }) => {
  const { token, user: currentUser } = useSelector((state) => state.auth);

  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadConversations, setUnreadConversations] = useState({}); // conversationId -> count
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const socketRef = useRef(null);
  
  // Ref to track which conversation is currently open in the UI
  const activeChatIdRef = useRef(null);

  const fetchPendingRequestsCount = useCallback(async () => {
    if (!token || !currentUser || currentUser.role !== 'student') {
      setPendingRequestsCount(0);
      return;
    }
    try {
      const response = await api.get('/connections/pending');
      setPendingRequestsCount(response.data.requests?.length || 0);
    } catch (err) {
      console.error('Failed to fetch pending requests count:', err);
    }
  }, [token, currentUser]);

  useEffect(() => {
    if (!token || !currentUser) {
      // Disconnect socket if user logs out or token is cleared
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setUnreadCount(0);
      setUnreadConversations({});
      setPendingRequestsCount(0);
      return;
    }

    fetchPendingRequestsCount();

    // Connect to Socket.io server (dynamic URL for Vercel/Render deployment)
    const socketServerUrl = import.meta.env.VITE_BACKEND_URL || 
      (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000');
    console.log(`[Socket Lifecycle] ⚡ Connecting to Socket.io server at ${socketServerUrl}...`);
    const socket = io(socketServerUrl, {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`[Socket Lifecycle] 🟢 Connected to socket server! Socket ID: ${socket.id}`);
    });

    socket.on('disconnect', (reason) => {
      console.warn(`[Socket Lifecycle] 🔴 Disconnected from socket server! Reason: ${reason}`);
    });

    // Listen for pending notifications on connect/reconnect
    socket.on('pending-notification', (data) => {
      setUnreadCount(data.unreadCount);
      const convMap = {};
      data.conversations.forEach((c) => {
        convMap[c.conversationId] = c.unreadCount;
      });
      setUnreadConversations(convMap);
    });

    // Listen for incoming connection requests in real-time
    socket.on('connectionRequest', () => {
      setPendingRequestsCount((prev) => prev + 1);
    });

    // Listen for notification-cleared event (when a conversation is read)
    socket.on('notification-cleared', (data) => {
      setUnreadCount(data.unreadCount);
      setUnreadConversations((prev) => {
        const next = { ...prev };
        delete next[data.conversationId];
        return next;
      });
    });

    // Listen for incoming messages in real time to update notification state
    socket.on('new_message', (message) => {
      // Direct message check: recipient must be the current user
      if (message.receiver === currentUser.id) {
        const senderId = message.sender._id;

        // If not actively looking at this conversation, increment badge
        if (activeChatIdRef.current !== senderId) {
          setUnreadConversations((prev) => {
            const next = { ...prev };
            next[senderId] = (next[senderId] || 0) + 1;
            return next;
          });
          setUnreadCount((prev) => prev + 1);
        } else {
          // If actively viewing this chat, immediately mark as read on the server
          socket.emit('mark-as-read', { conversationId: senderId });
        }
      }
    });

    socket.on('connect_error', (err) => {
      console.error('Global Socket Connection Error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, currentUser, fetchPendingRequestsCount]);

  // Helper to mark a conversation as read
  const emitMarkAsRead = (conversationId) => {
    if (socketRef.current) {
      socketRef.current.emit('mark-as-read', { conversationId });
    }
    setUnreadConversations((prev) => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  };

  return (
    <ChatNotificationContext.Provider
      value={{
        socket: socketRef.current,
        unreadCount,
        unreadConversations,
        pendingRequestsCount,
        setPendingRequestsCount,
        fetchPendingRequestsCount,
        activeChatIdRef,
        emitMarkAsRead
      }}
    >
      {children}
    </ChatNotificationContext.Provider>
  );
};

export const useChatNotifications = () => {
  const context = useContext(ChatNotificationContext);
  if (!context) {
    throw new Error('useChatNotifications must be used within a ChatNotificationProvider');
  }
  return context;
};
