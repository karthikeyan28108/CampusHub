import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from './redux/slices/authSlice.js';
import { useChatNotifications } from './context/ChatNotificationContext.jsx';

// Import Pages
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotesHub from './pages/NotesHub.jsx';
import Chat from './pages/Chat.jsx';
import Placements from './pages/Placements.jsx';
import Events from './pages/Events.jsx';
import MyRegistrations from './pages/MyRegistrations.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import MessageOversight from './pages/MessageOversight.jsx';

// Import Route Guard
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ChatbotWidget from './components/ChatbotWidget.jsx';

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const { unreadCount } = useChatNotifications();

  const handleLogout = () => {
    dispatch(logout());
  };

  const isAdmin = user?.role === 'admin';

  return (
    <Router>
      <div className="d-flex flex-column min-vh-100">
        {/* Navigation Bar */}
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
          <div className="container">
            <Link className="navbar-brand fw-bold fs-4 text-primary" to="/">
              CampusHub
            </Link>
            
            {isAuthenticated && (
              <>
                <button
                  className="navbar-toggler"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#navbarNav"
                  aria-controls="navbarNav"
                  aria-expanded="false"
                  aria-label="Toggle navigation"
                >
                  <span className="navbar-toggler-icon"></span>
                </button>
                
                <div className="collapse navbar-collapse" id="navbarNav">
                  <ul className="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3">
                    <li className="nav-item">
                      <Link className="nav-link" to="/">
                        Dashboard
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to="/notes">
                        Notes Hub
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link d-flex align-items-center" to="/chat">
                        Chat Portal
                        {unreadCount > 0 && (
                          <span 
                            className="pulse-badge ms-2"
                            title={`${unreadCount} unread message(s)`}
                          />
                        )}
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to="/placements">
                        Placements
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to="/events">
                        Events
                      </Link>
                    </li>
                    <li className="nav-item">
                      <Link className="nav-link" to="/registrations">
                        Registrations
                      </Link>
                    </li>
                    {isAdmin && (
                      <>
                        <li className="nav-item">
                          <Link className="nav-link text-warning fw-bold" to="/admin">
                            Admin Panel
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link className="nav-link text-info fw-semibold" to="/admin/oversight">
                            <i className="bi bi-shield-lock me-1"></i>Message Oversight
                          </Link>
                        </li>
                      </>
                    )}
                  </ul>
                  
                  <div className="d-flex align-items-center gap-3">
                    <div className="text-light me-2">
                      <span className="opacity-75 fs-7 me-1">Logged in as:</span>
                      <strong className="me-2">{user?.name}</strong>
                      <span className="badge bg-primary text-uppercase fs-7">{user?.role}</span>
                    </div>
                    <button onClick={handleLogout} className="btn btn-outline-danger btn-sm">
                      <i className="bi bi-box-arrow-right me-1"></i>Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-grow-1">
          <Routes>
            {/* Unauthenticated Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notes"
              element={
                <ProtectedRoute>
                  <NotesHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route
              path="/placements"
              element={
                <ProtectedRoute>
                  <Placements />
                </ProtectedRoute>
              }
            />
            <Route
              path="/events"
              element={
                <ProtectedRoute>
                  <Events />
                </ProtectedRoute>
              }
            />
            <Route
              path="/registrations"
              element={
                <ProtectedRoute>
                  <MyRegistrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/oversight"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <MessageOversight />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/message-oversight"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <MessageOversight />
                </ProtectedRoute>
              }
            />

            {/* Fallback routing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-dark text-white text-center py-3 mt-auto border-top border-secondary">
          <div className="container">
            <p className="mb-0 fs-7 opacity-75">
              &copy; {new Date().getFullYear()} CampusHub Collaboration Platform. All rights reserved.
            </p>
          </div>
        </footer>

        {/* Floating RAG Chatbot Widget */}
        {isAuthenticated && <ChatbotWidget />}
      </div>
    </Router>
  );
}

export default App;
