import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../services/api.js';

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Password should be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      });
      setSuccessMsg(response.data.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const columnClass = isAdmin ? 'col-md-3' : 'col-md-4';

  return (
    <div className="container mt-4 mb-5">
      <div className="row mb-4">
        <div className="col-12">
          <div className="bg-primary text-white p-4 rounded-3 shadow-sm d-flex align-items-center justify-content-between">
            <div>
              <h2 className="fw-bold mb-1">Welcome back, {user?.name}!</h2>
              <p className="mb-0 opacity-75">Role: <span className="text-uppercase fw-semibold">{user?.role}</span> | Dept: {user?.department}</p>
            </div>
            <div className="d-none d-md-block text-end">
              <span className="badge bg-white text-primary px-3 py-2 rounded-pill fw-semibold">CampusHub Active Session</span>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Profile Card */}
        <div className="col-md-4">
          <div className="card shadow-sm border-0 h-100 bg-white">
            <div className="card-body p-4">
              <h5 className="fw-bold text-dark border-bottom pb-2 mb-3">User Profile</h5>
              <div className="mb-3">
                <label className="text-muted fs-7 mb-0">Email address</label>
                <div className="fw-semibold text-dark">{user?.email}</div>
              </div>
              <div className="mb-3">
                <label className="text-muted fs-7 mb-0">Department</label>
                <div className="fw-semibold text-dark">{user?.department}</div>
              </div>
              {user?.role === 'student' && (
                <>
                  <div className="mb-3">
                    <label className="text-muted fs-7 mb-0">Register Number</label>
                    <div className="fw-semibold text-dark">{user?.registerNumber}</div>
                  </div>
                  <div className="mb-3">
                    <label className="text-muted fs-7 mb-0">Academic Year / Section</label>
                    <div className="fw-semibold text-dark">{user?.year} Year / Section {user?.section}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Portals Cards */}
        <div className="col-md-8">
          <div className="row g-4 mb-4">
            {/* Notes Card */}
            <div className={columnClass}>
              <div className="card shadow-sm border-0 h-100 hover-shadow transition">
                <div className="card-body p-3 d-flex flex-column">
                  <div className="mb-2">
                    <i className="bi bi-journal-text text-primary" style={{ fontSize: '1.8rem' }}></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">Notes Hub</h6>
                  <p className="text-muted flex-grow-1" style={{ fontSize: '0.85rem' }}>Access academic lecture notes shared by Faculty.</p>
                  <Link to="/notes" className="btn btn-primary w-100 py-2 fs-7">Go to Notes</Link>
                </div>
              </div>
            </div>

            {/* Chat Card */}
            <div className={columnClass}>
              <div className="card shadow-sm border-0 h-100 hover-shadow transition">
                <div className="card-body p-3 d-flex flex-column">
                  <div className="mb-2">
                    <i className="bi bi-chat-text-fill text-primary" style={{ fontSize: '1.8rem' }}></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">Chat Portal</h6>
                  <p className="text-muted flex-grow-1" style={{ fontSize: '0.85rem' }}>Connect in real-time with colleagues or departments.</p>
                  <Link to="/chat" className="btn btn-primary w-100 py-2 fs-7">Open Chat</Link>
                </div>
              </div>
            </div>

            {/* Placements Card */}
            <div className={columnClass}>
              <div className="card shadow-sm border-0 h-100 hover-shadow transition">
                <div className="card-body p-3 d-flex flex-column">
                  <div className="mb-2">
                    <i className="bi bi-briefcase-fill text-primary" style={{ fontSize: '1.8rem' }}></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">Placements</h6>
                  <p className="text-muted flex-grow-1" style={{ fontSize: '0.85rem' }}>View career drives, job roles, and eligibility guidelines.</p>
                  <Link to="/placements" className="btn btn-primary w-100 py-2 fs-7">View Careers</Link>
                </div>
              </div>
            </div>

            {/* Admin Console Card (Admin only) */}
            {isAdmin && (
              <div className={columnClass}>
                <div className="card shadow-sm border-0 h-100 hover-shadow transition bg-dark text-white">
                  <div className="card-body p-3 d-flex flex-column">
                    <div className="mb-2">
                      <i className="bi bi-speedometer2 text-primary" style={{ fontSize: '1.8rem' }}></i>
                    </div>
                    <h6 className="fw-bold text-white mb-1">Admin Panel</h6>
                    <p className="text-light opacity-75 flex-grow-1" style={{ fontSize: '0.85rem' }}>System statistics, user levels, and transactions logs.</p>
                    <Link to="/admin" className="btn btn-outline-primary w-100 py-2 fs-7">Admin Panel</Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Change Password Card */}
          <div className="card shadow-sm border-0 bg-white">
            <div className="card-body p-4">
              <h5 className="fw-bold text-dark border-bottom pb-2 mb-3">Security & Password</h5>
              
              {successMsg && <div className="alert alert-success py-2 shadow-sm fs-6" role="alert">{successMsg}</div>}
              {errorMsg && <div className="alert alert-danger py-2 shadow-sm fs-6" role="alert">{errorMsg}</div>}
              
              <form onSubmit={handlePasswordChange}>
                <div className="row">
                  <div className="col-md-4 mb-3">
                    <label className="form-label fs-7">Current Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label fs-7">New Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label fs-7">Confirm Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-outline-secondary px-4 py-2 mt-2" disabled={loading}>
                  {loading ? 'Changing...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
