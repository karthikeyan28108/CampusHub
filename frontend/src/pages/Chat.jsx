import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api.js';
import { useChatNotifications } from '../context/ChatNotificationContext.jsx';

const Chat = () => {
  const { user: currentUser } = useSelector((state) => state.auth);
  const currentUserId = currentUser?._id || currentUser?.id;
  
  // Navigation tabs: 'conversations' | 'requests' | 'search' | 'directory'
  const [activeTab, setActiveTab] = useState('conversations');

  // Connections and Directory state
  const [connections, setConnections] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [directorySearch, setDirectorySearch] = useState('');

  // Register number search state (Students only)
  const [searchRegNum, setSearchRegNum] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [requestSending, setRequestSending] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState('');

  // Active chat state
  const [activeChat, setActiveChat] = useState(null); // { type: 'direct'|'room', id: string, name: string, connectionId?: string, registerNumber?: string, role?: string, department?: string }
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Block modal state
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Default campus rooms
  const chatRooms = [
    { id: 'general', name: 'General Discussion' },
    { id: 'cse-hub', name: 'CSE Department' },
    { id: 'placements', name: 'Placement Cell' },
    { id: 'events-chat', name: 'Campus Events' }
  ];

  // Consume global Socket.io notifications state and helpers
  const {
    socket,
    unreadConversations,
    pendingRequestsCount,
    setPendingRequestsCount,
    activeChatIdRef,
    emitMarkAsRead
  } = useChatNotifications();

  const isStudent = currentUser?.role === 'student';
  const isFacultyOrAdmin = currentUser?.role === 'faculty' || currentUser?.role === 'admin';

  // Auto-scroll messages list to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch accepted connections for sidebar
  const fetchConnections = useCallback(async () => {
    try {
      const res = await api.get('/connections');
      setConnections(res.data.connections || []);
    } catch (err) {
      console.error('Failed to load connections list:', err);
    }
  }, []);

  // Fetch incoming pending requests
  const fetchPendingRequests = useCallback(async () => {
    if (!isStudent) return;
    try {
      const res = await api.get('/connections/pending');
      setPendingRequests(res.data.requests || []);
      setPendingRequestsCount(res.data.requests?.length || 0);
    } catch (err) {
      console.error('Failed to load pending requests:', err);
    }
  }, [isStudent, setPendingRequestsCount]);

  // Fetch directory users (Faculty/Admin only)
  const fetchDirectory = useCallback(async () => {
    if (!isFacultyOrAdmin) return;
    try {
      const res = await api.get('/users/directory');
      const raw = res.data.users || [];
      const seen = new Set();
      const unique = [];
      for (const u of raw) {
        const idKey = (u._id || u.id)?.toString();
        const regKey = u.role === 'student' && u.registerNumber ? `reg_${u.registerNumber.toUpperCase()}` : null;
        if (idKey && !seen.has(idKey) && (!regKey || !seen.has(regKey))) {
          seen.add(idKey);
          if (regKey) seen.add(regKey);
          unique.push(u);
        }
      }
      setDirectoryUsers(unique);
    } catch (err) {
      console.error('Failed to load directory:', err);
    }
  }, [isFacultyOrAdmin]);

  useEffect(() => {
    fetchConnections();
    if (isStudent) {
      fetchPendingRequests();
    }
    if (isFacultyOrAdmin) {
      fetchDirectory();
    }
  }, [fetchConnections, fetchPendingRequests, fetchDirectory, isStudent, isFacultyOrAdmin]);

  // Track active chat in context ref so incoming messages can be marked read immediately
  useEffect(() => {
    if (activeChat?.type === 'direct') {
      activeChatIdRef.current = activeChat.id;
      emitMarkAsRead(activeChat.id);
    } else {
      activeChatIdRef.current = null;
    }

    return () => {
      activeChatIdRef.current = null;
    };
  }, [activeChat, activeChatIdRef, emitMarkAsRead]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      const tArrived = performance.now();
      const tSent = window.__lastSendMessageTimestamp;
      if (tSent) {
        console.log(`[Frontend Diagnostic] 📬 'new_message' arrived! Round-trip latency: ${(tArrived - tSent).toFixed(2)} ms. Message ID: ${message._id}`);
      } else {
        console.log(`[Frontend Diagnostic] 📬 Incoming 'new_message' from peer. Message ID: ${message._id}`);
      }

      setMessages((prevMessages) => {
        const senderId = (message.sender?._id || message.sender?.id || message.sender)?.toString();
        const receiverId = (message.receiver?._id || message.receiver?.id || message.receiver)?.toString();
        const myId = currentUserId?.toString();
        const activeId = activeChat?.id?.toString();

        const isCurrentRoom = activeChat?.type === 'room' && message.room === activeChat.id;
        const isCurrentDirect = activeChat?.type === 'direct' && 
          ((senderId === activeId && receiverId === myId) || 
           (senderId === myId && receiverId === activeId));
        
        if (!isCurrentRoom && !isCurrentDirect) {
          return prevMessages;
        }

        // Reconcile optimistic message for current user
        if (senderId === myId) {
          const pendingIndex = prevMessages.findIndex(
            (m) => (m.status === 'sending' || m.status === 'failed') && m.content === message.content
          );
          if (pendingIndex !== -1) {
            const updated = [...prevMessages];
            updated[pendingIndex] = {
              ...message,
              _id: message._id,
              createdAt: message.createdAt || new Date().toISOString(),
              status: 'delivered'
            };
            return updated;
          }
        }

        // Deduplicate message if already in state
        if (prevMessages.some(m => m._id === message._id)) {
          return prevMessages;
        }

        return [...prevMessages, { ...message, status: 'delivered' }];
      });
    };

    const handleSocketError = (err) => {
      setError(err.message || 'Error processing message.');
      // Mark any optimistic pending messages as failed
      setMessages((prevMessages) =>
        prevMessages.map((m) =>
          m.status === 'sending' ? { ...m, status: 'failed' } : m
        )
      );
    };

    const handleConnectionRequest = (payload) => {
      fetchPendingRequests();
      setSuccess(`New connection request from ${payload.requester.name}!`);
    };

    const handleConnectionAccepted = (payload) => {
      fetchConnections();
      setSuccess(`${payload.acceptedBy.name} accepted your connection request!`);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('error_message', handleSocketError);
    socket.on('connectionRequest', handleConnectionRequest);
    socket.on('connectionAccepted', handleConnectionAccepted);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('error_message', handleSocketError);
      socket.off('connectionRequest', handleConnectionRequest);
      socket.off('connectionAccepted', handleConnectionAccepted);
    };
  }, [socket, activeChat, currentUserId, fetchConnections, fetchPendingRequests]);

  // Switch conversations
  const selectChat = async (chat) => {
    if (activeChat?.type === 'room' && socket) {
      socket.emit('leave_room', activeChat.id);
    }

    setActiveChat(chat);
    setMessages([]);
    setLoadingHistory(true);
    setError('');
    setSuccess('');

    try {
      if (chat.type === 'room') {
        if (socket) {
          socket.emit('join_room', chat.id);
        }
        const response = await api.get(`/chat/history/room/${chat.id}`);
        setMessages(response.data.messages || []);
      } else {
        const response = await api.get(`/chat/history/direct/${chat.id}`);
        setMessages(response.data.messages || []);
      }
    } catch (err) {
      setError('Failed to load message history.');
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Send message with immediate optimistic UI update & reconciliation
  const handleSendMessage = (e) => {
    e.preventDefault();
    setError('');
    const text = messageText.trim();
    if (!text || !socket || !activeChat) return;

    const messageData = {
      content: text
    };

    if (activeChat.type === 'room') {
      messageData.room = activeChat.id;
    } else {
      messageData.receiverId = activeChat.id;
    }

    // Generate unique client-side temporary ID for optimistic UI
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage = {
      _id: tempId,
      tempId,
      sender: {
        _id: currentUserId,
        name: currentUser?.name,
        role: currentUser?.role,
        email: currentUser?.email
      },
      receiver: activeChat.type === 'direct' ? activeChat.id : null,
      room: activeChat.type === 'room' ? activeChat.id : null,
      content: text,
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    // 1. Immediately append to chat state with temporary "sending" status
    setMessages((prev) => [...prev, optimisticMessage]);
    setMessageText('');

    const tSend = performance.now();
    window.__lastSendMessageTimestamp = tSend;
    console.log(`[Frontend Diagnostic] 🚀 Optimistic message rendered. socket.emit dispatched at ${tSend.toFixed(2)} ms:`, messageData);

    // 2. Dispatch via persistent socket connection
    socket.emit('send_message', messageData);

    // 3. Fallback timeout: If new_message hasn't arrived within 7 seconds, mark as failed to send
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === tempId && msg.status === 'sending'
            ? { ...msg, status: 'failed' }
            : msg
        )
      );
    }, 7000);
  };

  // Retry sending a failed message
  const handleRetryMessage = (failedMsg) => {
    if (!socket || !activeChat) return;

    const messageData = {
      content: failedMsg.content
    };
    if (activeChat.type === 'room') {
      messageData.room = activeChat.id;
    } else {
      messageData.receiverId = activeChat.id;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m._id === failedMsg._id ? { ...m, status: 'sending' } : m
      )
    );

    socket.emit('send_message', messageData);

    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === failedMsg._id && m.status === 'sending'
            ? { ...m, status: 'failed' }
            : m
        )
      );
    }, 7000);
  };

  // Search student by exact register number (Rule 1)
  const handleSearchStudent = async (e) => {
    e.preventDefault();
    setSearchError('');
    setSearchResult(null);
    setRequestSuccess('');

    const query = searchRegNum.trim();
    if (!query) {
      setSearchError('Please enter a register number to search.');
      return;
    }

    setSearchLoading(true);
    try {
      const res = await api.get(`/users/search?registerNumber=${encodeURIComponent(query)}`);
      setSearchResult(res.data);
    } catch (err) {
      setSearchError(err.response?.data?.message || 'No student found with that exact register number.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Send connection request with initial message (Rule 2 & Rule 5)
  const handleSendConnectionRequest = async (e) => {
    e.preventDefault();
    if (!searchResult?.user || !requestMessage.trim()) {
      setSearchError('Please enter an introductory message.');
      return;
    }

    setRequestSending(true);
    setSearchError('');
    setRequestSuccess('');

    try {
      const res = await api.post('/connections/request', {
        targetUserId: searchResult.user._id,
        message: requestMessage.trim()
      });

      setRequestSuccess(res.data.message || 'Connection request sent successfully!');
      setRequestMessage('');

      // Update search result connection state to pending
      setSearchResult(prev => ({
        ...prev,
        connection: {
          id: res.data.connection._id,
          status: 'pending',
          initiatedBy: currentUserId,
          blockedBy: null
        }
      }));

      fetchConnections();
    } catch (err) {
      setSearchError(err.response?.data?.message || 'Failed to send connection request.');
    } finally {
      setRequestSending(false);
    }
  };

  // Accept connection request (Rule 3)
  const handleAcceptRequest = async (connectionId, requester) => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post(`/connections/${connectionId}/accept`);
      setSuccess(res.data.message || 'Connection accepted!');
      fetchPendingRequests();
      fetchConnections();

      // Open conversation immediately
      selectChat({
        type: 'direct',
        id: requester._id,
        name: requester.name,
        connectionId: connectionId,
        registerNumber: requester.registerNumber,
        role: requester.role,
        department: requester.department
      });
      setActiveTab('conversations');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to accept connection.');
    }
  };

  // Block connection (Rule 4: Silent block)
  const handleBlockConnection = async () => {
    if (!activeChat?.connectionId) return;

    setBlockLoading(true);
    try {
      await api.post(`/connections/${activeChat.connectionId}/block`);
      setShowBlockModal(false);
      setSuccess(`User has been blocked.`);
      setActiveChat(null);
      setMessages([]);
      fetchConnections();
      if (isStudent) {
        fetchPendingRequests();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to block user.');
    } finally {
      setBlockLoading(false);
    }
  };

  // Block directly from incoming request card
  const handleBlockFromRequest = async (connectionId) => {
    if (!window.confirm('Are you sure you want to block this user?')) return;
    try {
      await api.post(`/connections/${connectionId}/block`);
      setSuccess('User has been blocked.');
      fetchPendingRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to block request.');
    }
  };

  // Start chat directly with directory user (Faculty/Admin only)
  const handleStartDirectoryChat = (user) => {
    if (!user) return;
    const targetId = user._id || user.id;

    // Check if an accepted connection already exists in connections list
    const existingConn = connections.find(c => 
      (c.user?._id || c.user?.id)?.toString() === targetId?.toString()
    );

    // Stay on Directory tab and open the user's conversation directly
    selectChat({
      type: 'direct',
      id: targetId,
      name: user.name,
      connectionId: existingConn?._id || null,
      registerNumber: user.registerNumber,
      role: user.role,
      department: user.department,
      connectionStatus: existingConn?.status || (isFacultyOrAdmin ? 'accepted' : 'none'),
      isExempt: isFacultyOrAdmin || existingConn?.isExempt
    });
  };

  // Filtered directory users
  const filteredDirectoryUsers = directoryUsers.filter(u =>
    u.name.toLowerCase().includes(directorySearch.toLowerCase()) ||
    (u.department && u.department.toLowerCase().includes(directorySearch.toLowerCase())) ||
    (u.registerNumber && u.registerNumber.toLowerCase().includes(directorySearch.toLowerCase()))
  );

  return (
    <div className="container mt-4 mb-5">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="fw-bold text-primary mb-0">CampusHub Chat Portal</h2>
          <p className="text-muted small mb-0">
            {isStudent ? 'Connect with peers using Register Number or chat with accepted connections' : 'Connect and message with campus students and faculty members'}
          </p>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-danger shadow-sm mb-3 alert-dismissible fade show" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>{error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success shadow-sm mb-3 alert-dismissible fade show" role="alert">
          <i className="bi bi-check-circle-fill me-2"></i>{success}
          <button type="button" className="btn-close" onClick={() => setSuccess('')}></button>
        </div>
      )}
      
      <div className="row bg-white rounded-3 shadow overflow-hidden" style={{ height: '74vh' }}>
        {/* ======================================================== */}
        {/* SIDEBAR: NAVIGATION TABS & LISTS                         */}
        {/* ======================================================== */}
        <div className="col-md-4 border-end p-0 d-flex flex-column h-100 bg-light">
          {/* Tabs Header */}
          <div className="p-2 bg-primary text-white">
            <ul className="nav nav-pills nav-fill small" role="tablist">
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link py-2 ${activeTab === 'conversations' ? 'active bg-white text-primary fw-bold shadow-sm' : 'text-white opacity-75'}`}
                  onClick={() => setActiveTab('conversations')}
                >
                  <i className="bi bi-chat-dots me-1"></i>Chats
                </button>
              </li>

              {isStudent && (
                <li className="nav-item" role="presentation">
                  <button
                    className={`nav-link py-2 position-relative ${activeTab === 'requests' ? 'active bg-white text-primary fw-bold shadow-sm' : 'text-white opacity-75'}`}
                    onClick={() => {
                      setActiveTab('requests');
                      fetchPendingRequests();
                    }}
                  >
                    <i className="bi bi-person-plus me-1"></i>Requests
                    {pendingRequestsCount > 0 && (
                      <span className="badge bg-danger rounded-pill ms-1 fs-7">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </button>
                </li>
              )}

              {isStudent && (
                <li className="nav-item" role="presentation">
                  <button
                    className={`nav-link py-2 ${activeTab === 'search' ? 'active bg-white text-primary fw-bold shadow-sm' : 'text-white opacity-75'}`}
                    onClick={() => setActiveTab('search')}
                  >
                    <i className="bi bi-search me-1"></i>Find Student
                  </button>
                </li>
              )}

              {isFacultyOrAdmin && (
                <li className="nav-item" role="presentation">
                  <button
                    className={`nav-link py-2 ${activeTab === 'directory' ? 'active bg-white text-primary fw-bold shadow-sm' : 'text-white opacity-75'}`}
                    onClick={() => setActiveTab('directory')}
                  >
                    <i className="bi bi-people me-1"></i>Directory
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Sidebar Content Body */}
          <div className="flex-grow-1 overflow-y-auto p-3">
            {/* 1. CONVERSATIONS TAB (ACCEPTED CONNECTIONS) */}
            {activeTab === 'conversations' && (
              <>
                {/* Rooms Section */}
                <div className="mb-4">
                  <h6 className="text-uppercase fw-semibold text-secondary mb-2 fs-7">Discussion Rooms</h6>
                  <div className="list-group list-group-flush rounded shadow-sm">
                    {chatRooms.map((room) => (
                      <button
                        key={room.id}
                        onClick={() => selectChat({ type: 'room', id: room.id, name: room.name })}
                        className={`list-group-item list-group-item-action border-0 px-3 py-2 text-start ${
                          activeChat?.type === 'room' && activeChat.id === room.id ? 'active bg-primary' : ''
                        }`}
                      >
                        <i className="bi bi-hash me-2"></i>
                        {room.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direct Accepted Connections */}
                <div>
                  <h6 className="text-uppercase fw-semibold text-secondary mb-2 fs-7">Connected Peers & Faculty</h6>
                  <div className="list-group list-group-flush rounded shadow-sm">
                    {connections.length === 0 ? (
                      <div className="p-4 bg-white rounded text-center shadow-sm">
                        <i className="bi bi-people text-muted" style={{ fontSize: '2rem' }}></i>
                        <p className="text-muted small mt-2 mb-0">No active connections yet.</p>
                        {isStudent && (
                          <button
                            onClick={() => setActiveTab('search')}
                            className="btn btn-outline-primary btn-sm mt-2"
                          >
                            <i className="bi bi-search me-1"></i>Find Students to Connect
                          </button>
                        )}
                      </div>
                    ) : (
                      connections.map((conn) => {
                        const target = conn.user;
                        if (!target) return null;
                        return (
                          <button
                            key={conn._id}
                            onClick={() => selectChat({
                              type: 'direct',
                              id: target._id,
                              name: target.name,
                              connectionId: conn._id,
                              registerNumber: target.registerNumber,
                              role: target.role,
                              department: target.department
                            })}
                            className={`list-group-item list-group-item-action border-0 px-3 py-2 text-start ${
                              activeChat?.type === 'direct' && activeChat.id === target._id ? 'active bg-primary' : ''
                            }`}
                          >
                            <div className="d-flex align-items-center justify-content-between w-100">
                              <div className="d-flex align-items-center">
                                <div className="bg-primary-subtle text-primary fw-bold rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '36px', height: '36px', fontSize: '14px' }}>
                                  {target.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="fw-semibold fs-6 text-truncate" style={{ maxWidth: '160px' }}>
                                    {target.name}
                                  </div>
                                  <div className="fs-7 text-muted" style={{ fontSize: '11px' }}>
                                    {target.role === 'student' ? (target.registerNumber || target.department) : `${target.role} • ${target.department}`}
                                  </div>
                                </div>
                              </div>
                              {unreadConversations[target._id] > 0 && (
                                <span className="badge bg-danger rounded-pill fs-7 px-2 py-1">
                                  {unreadConversations[target._id]}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 2. REQUESTS TAB (STUDENTS ONLY) */}
            {activeTab === 'requests' && isStudent && (
              <div>
                <h6 className="text-uppercase fw-semibold text-secondary mb-3 fs-7">
                  Incoming Connection Requests ({pendingRequests.length})
                </h6>
                {pendingRequests.length === 0 ? (
                  <div className="p-4 bg-white rounded text-center shadow-sm">
                    <i className="bi bi-inbox text-muted" style={{ fontSize: '2.5rem' }}></i>
                    <p className="text-muted small mt-2 mb-0">You have no pending requests right now.</p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {pendingRequests.map((req) => (
                      <div className="card shadow-sm border-0 bg-white" key={req._id}>
                        <div className="card-body p-3">
                          <div className="d-flex align-items-center mb-2">
                            <div className="bg-primary-subtle text-primary fw-bold rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '38px', height: '38px' }}>
                              {req.requester?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h6 className="fw-bold mb-0 text-dark">{req.requester?.name}</h6>
                              <small className="text-muted" style={{ fontSize: '11px' }}>
                                Reg: <strong>{req.requester?.registerNumber}</strong> | {req.requester?.department}
                              </small>
                            </div>
                          </div>

                          {req.firstMessage && (
                            <div className="bg-light p-2 rounded mb-3 fs-7 text-secondary fst-italic border-start border-primary border-3">
                              "{req.firstMessage}"
                            </div>
                          )}

                          <div className="d-flex gap-2 mt-2">
                            <button
                              onClick={() => handleAcceptRequest(req._id, req.requester)}
                              className="btn btn-primary btn-sm flex-fill py-1"
                            >
                              <i className="bi bi-check-lg me-1"></i>Accept
                            </button>
                            <button
                              onClick={() => handleBlockFromRequest(req._id)}
                              className="btn btn-outline-danger btn-sm px-3 py-1"
                              title="Block user"
                            >
                              <i className="bi bi-slash-circle me-1"></i>Block
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. FIND STUDENT TAB (REGISTER NUMBER SEARCH) */}
            {activeTab === 'search' && isStudent && (
              <div>
                <h6 className="text-uppercase fw-semibold text-secondary mb-2 fs-7">Connect with Peer</h6>
                <p className="text-muted small mb-3">
                  Enter the peer's exact full Register Number to send a connection request.
                </p>

                <form onSubmit={handleSearchStudent} className="mb-3">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 21CS042"
                      value={searchRegNum}
                      onChange={(e) => setSearchRegNum(e.target.value)}
                      required
                    />
                    <button className="btn btn-primary" type="submit" disabled={searchLoading}>
                      {searchLoading ? (
                        <span className="spinner-border spinner-border-sm" role="status"></span>
                      ) : (
                        <i className="bi bi-search"></i>
                      )}
                    </button>
                  </div>
                </form>

                {searchError && (
                  <div className="alert alert-warning py-2 small shadow-sm mb-3">
                    <i className="bi bi-info-circle me-1"></i>{searchError}
                  </div>
                )}

                {requestSuccess && (
                  <div className="alert alert-success py-2 small shadow-sm mb-3">
                    <i className="bi bi-check-circle me-1"></i>{requestSuccess}
                  </div>
                )}

                {searchResult && (
                  <div className="card shadow-sm border-0 bg-white mt-3">
                    <div className="card-body p-3">
                      <div className="d-flex align-items-center mb-3">
                        <div className="bg-primary text-white fw-bold rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '45px', height: '45px', fontSize: '18px' }}>
                          {searchResult.user.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h5 className="fw-bold mb-0 text-dark">{searchResult.user.name}</h5>
                          <div className="badge bg-secondary-subtle text-dark fs-7 px-2 py-1 mt-1">
                            {searchResult.user.registerNumber}
                          </div>
                        </div>
                      </div>

                      <div className="bg-light p-2 rounded small text-secondary mb-3">
                        <div><strong>Department:</strong> {searchResult.user.department}</div>
                        <div><strong>Year / Section:</strong> Year {searchResult.user.year || '1'} / Sec {searchResult.user.section || 'A'}</div>
                      </div>

                      {/* Connection States */}
                      {searchResult.connection?.status === 'accepted' ? (
                        <div className="alert alert-success py-2 small text-center mb-0">
                          <i className="bi bi-check-all me-1"></i>Already Connected
                          <button
                            onClick={() => {
                              selectChat({
                                type: 'direct',
                                id: searchResult.user._id,
                                name: searchResult.user.name,
                                connectionId: searchResult.connection.id,
                                registerNumber: searchResult.user.registerNumber,
                                role: searchResult.user.role,
                                department: searchResult.user.department
                              });
                              setActiveTab('conversations');
                            }}
                            className="btn btn-sm btn-primary w-100 mt-2"
                          >
                            Open Conversation
                          </button>
                        </div>
                      ) : searchResult.connection?.status === 'pending' ? (
                        <div className="alert alert-info py-2 small text-center mb-0">
                          <i className="bi bi-clock-history me-1"></i>
                          {searchResult.connection.initiatedBy === currentUserId
                            ? 'Connection request pending acceptance.'
                            : 'This student sent you a request! Check Requests tab.'}
                        </div>
                      ) : (
                        /* Available for initial message or post-block fresh reconnect */
                        <form onSubmit={handleSendConnectionRequest}>
                          <label className="form-label small fw-semibold text-dark mb-1">
                            Introductory Message (Single Contact Free Message):
                          </label>
                          <textarea
                            className="form-control form-control-sm mb-2"
                            rows="3"
                            placeholder="Hello, I would like to connect with you regarding..."
                            value={requestMessage}
                            onChange={(e) => setRequestMessage(e.target.value)}
                            required
                          ></textarea>
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm w-100 py-2"
                            disabled={requestSending}
                          >
                            {requestSending ? (
                              <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                            ) : (
                              <i className="bi bi-send-fill me-1"></i>
                            )}
                            Send Connection Request
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 4. DIRECTORY TAB (FACULTY / ADMIN ONLY) */}
            {activeTab === 'directory' && isFacultyOrAdmin && (
              <div>
                <h6 className="text-uppercase fw-semibold text-secondary mb-2 fs-7">Campus Directory</h6>
                <div className="mb-3">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Filter directory by name/dept..."
                    value={directorySearch}
                    onChange={(e) => setDirectorySearch(e.target.value)}
                  />
                </div>

                <div className="list-group list-group-flush rounded shadow-sm">
                  {filteredDirectoryUsers.length === 0 ? (
                    <p className="text-muted p-3 fs-7 mb-0 text-center bg-white rounded">No members found</p>
                  ) : (
                    filteredDirectoryUsers.map((u) => {
                      const userId = (u._id || u.id)?.toString();
                      const isSelected = activeChat?.type === 'direct' && 
                        activeChat?.id?.toString() === userId;

                      return (
                        <button
                          key={userId}
                          onClick={() => handleStartDirectoryChat(u)}
                          className={`list-group-item list-group-item-action border-0 px-3 py-2 text-start transition-all ${
                            isSelected ? 'active bg-primary text-white shadow-sm' : ''
                          }`}
                        >
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center">
                              <div
                                className={`rounded-circle d-flex align-items-center justify-content-center me-2 fw-bold ${
                                  isSelected ? 'bg-white text-primary' : 'bg-secondary-subtle text-dark'
                                }`}
                                style={{ width: '34px', height: '34px', fontSize: '13px' }}
                              >
                                {u.name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className={`fw-semibold fs-6 ${isSelected ? 'text-white' : 'text-dark'}`}>
                                  {u.name}
                                </div>
                                <div className={`fs-7 ${isSelected ? 'text-white-50' : 'text-muted'}`} style={{ fontSize: '11px' }}>
                                  <span className={`badge me-1 ${isSelected ? 'bg-light text-dark' : 'bg-secondary'}`}>
                                    {u.role}
                                  </span>
                                  {u.department} {u.registerNumber ? `• ${u.registerNumber}` : ''}
                                </div>
                              </div>
                            </div>
                            <i className={`bi bi-chat-dots-fill ${isSelected ? 'text-white' : 'text-primary'}`}></i>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* CHAT MESSAGING WINDOW                                    */}
        {/* ======================================================== */}
        <div className="col-md-8 p-0 d-flex flex-column h-100">
          {activeChat ? (
            activeChat.connectionStatus === 'pending' ? (
              <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted p-5 bg-light-subtle">
                <div className="bg-primary-subtle text-primary fw-bold rounded-circle d-flex align-items-center justify-content-center mb-3" style={{ width: '64px', height: '64px', fontSize: '24px' }}>
                  {activeChat.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <h4 className="fw-bold text-dark mb-1">{activeChat.name}</h4>
                <div className="text-secondary small mb-3">
                  {activeChat.role && <span className="badge bg-secondary me-1">{activeChat.role}</span>}
                  {activeChat.registerNumber ? `Reg: ${activeChat.registerNumber} • ` : ''}{activeChat.department || ''}
                </div>
                <div className="alert alert-info py-2 px-4 small shadow-sm text-center">
                  <i className="bi bi-clock-history me-2"></i>
                  Connection request is pending. Waiting for acceptance.
                </div>
              </div>
            ) : (
            <>
              {/* Header */}
              <div className="p-3 border-bottom bg-light d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <div className="bg-primary text-white fw-bold rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '38px', height: '38px' }}>
                    {activeChat.type === 'room' ? <i className="bi bi-hash"></i> : (activeChat.name?.charAt(0)?.toUpperCase() || '?')}
                  </div>
                  <div>
                    <h5 className="mb-0 fw-bold text-dark">{activeChat.name || 'Chat'}</h5>
                    {activeChat.type === 'direct' && (
                      <small className="text-muted" style={{ fontSize: '11px' }}>
                        {activeChat.registerNumber ? `Reg: ${activeChat.registerNumber} • ` : ''}{activeChat.department || ''}
                      </small>
                    )}
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-secondary-subtle text-secondary rounded-pill uppercase-first px-3 py-1">
                    {activeChat.type}
                  </span>

                  {/* Block Option for Direct Chats */}
                  {activeChat.type === 'direct' && activeChat.connectionId && (
                    <button
                      onClick={() => setShowBlockModal(true)}
                      className="btn btn-outline-danger btn-sm px-2 py-1"
                      title="Block User"
                    >
                      <i className="bi bi-slash-circle me-1"></i>Block
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Thread */}
              <div className="flex-grow-1 overflow-y-auto p-4 bg-light-subtle" style={{ maxHeight: 'calc(74vh - 130px)' }}>
                {loadingHistory ? (
                  <div className="text-center my-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <p className="mb-0">No messages in this chat yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwnMessage = (msg.sender?._id || msg.sender?.id || msg.sender)?.toString() === currentUserId?.toString();
                    const isSending = msg.status === 'sending';
                    const isFailed = msg.status === 'failed';

                    return (
                      <div key={msg._id} className={`d-flex mb-3 ${isOwnMessage ? 'justify-content-end' : 'justify-content-start'}`}>
                        <div
                          className={`rounded-3 px-3 py-2 shadow-sm ${
                            isOwnMessage
                              ? isFailed
                                ? 'bg-danger text-white rounded-br-0'
                                : 'bg-primary text-white rounded-br-0'
                              : 'bg-white text-dark rounded-bl-0'
                          }`}
                          style={{
                            maxWidth: '70%',
                            opacity: isSending ? 0.75 : 1,
                            transition: 'opacity 0.2s ease-in-out'
                          }}
                        >
                          {!isOwnMessage && (
                            <div className="fw-bold fs-7 mb-1 text-primary" style={{ fontSize: '11px' }}>
                              {msg.sender?.name} ({msg.sender?.role})
                            </div>
                          )}
                          <div className="word-break">{msg.content}</div>
                          <div
                            className="d-flex align-items-center justify-content-end gap-1 text-end"
                            style={{ fontSize: '9px', opacity: 0.85, marginTop: '3px' }}
                          >
                            <span>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isOwnMessage && (
                              <>
                                {isSending && (
                                  <span title="Sending..." className="ms-1 d-inline-flex align-items-center" style={{ fontSize: '10px' }}>
                                    <i className="bi bi-clock me-1"></i> sending...
                                  </span>
                                )}
                                {isFailed && (
                                  <span
                                    title="Failed to send. Click to retry."
                                    className="badge bg-warning text-dark ms-1 d-inline-flex align-items-center"
                                    style={{ cursor: 'pointer', fontSize: '9px', padding: '2px 5px' }}
                                    onClick={() => handleRetryMessage(msg)}
                                  >
                                    <i className="bi bi-exclamation-circle me-1"></i> failed to send (retry)
                                  </span>
                                )}
                                {!isSending && !isFailed && (
                                  <span title="Delivered" className="ms-1 d-inline-flex align-items-center">
                                    <i className="bi bi-check2" style={{ fontSize: '11px' }}></i>
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Footer */}
              <div className="p-3 border-top bg-light">
                <form onSubmit={handleSendMessage}>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control py-2"
                      placeholder="Type a message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn btn-primary px-4">
                      <i className="bi bi-send-fill me-1"></i>Send
                    </button>
                  </div>
                </form>
              </div>
            </>
          )) : (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted p-5 bg-light-subtle">
              <i className="bi bi-chat-dots-fill text-primary mb-3" style={{ fontSize: '4rem' }}></i>
              <h4 className="fw-bold text-dark">Welcome to CampusHub Chat!</h4>
              <p className="text-center">
                {isStudent
                  ? 'Connect with peers by searching their exact Register Number, or open an existing conversation from the sidebar.'
                  : 'Select a discussion room or a campus member to begin messaging in real time.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* BLOCK CONFIRMATION MODAL                                 */}
      {/* ======================================================== */}
      {showBlockModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-danger">
                  <i className="bi bi-slash-circle me-2"></i>Block {activeChat?.name}?
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowBlockModal(false)}></button>
              </div>
              <div className="modal-body py-3">
                <p className="mb-1 text-secondary">
                  Are you sure you want to block <strong>{activeChat?.name}</strong>?
                </p>
                <p className="small text-muted mb-0">
                  This conversation will end and be removed from your active chats list. To re-establish contact later, a fresh connection request must be initiated via Search.
                </p>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-light px-3" onClick={() => setShowBlockModal(false)} disabled={blockLoading}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger px-3" onClick={handleBlockConnection} disabled={blockLoading}>
                  {blockLoading ? (
                    <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                  ) : null}
                  Block User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
