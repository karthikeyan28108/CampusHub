import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data.metrics);
      setActivity(response.data.activityFeed);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch admin stats data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="text-center my-5 py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading Stats...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger shadow-sm" role="alert">{error}</div>
      </div>
    );
  }

  // Calculate SVG graph details
  const successfulPayCount = stats?.successfulPayments || 0;
  const failedPayCount = stats?.failedPayments || 0;
  const totalPayCount = successfulPayCount + failedPayCount;
  
  // Doughnut math
  const successPercentage = totalPayCount > 0 ? Math.round((successfulPayCount / totalPayCount) * 100) : 0;
  const failPercentage = totalPayCount > 0 ? 100 - successPercentage : 0;

  // Bar math (max height is 120px)
  const maxMetric = Math.max(
    stats?.totalNotes || 1,
    stats?.totalPlacements || 1,
    stats?.totalEvents || 1,
    stats?.totalRegistrations || 1
  );
  
  const getBarHeight = (value) => {
    return `${((value || 0) / maxMetric) * 100}px`;
  };

  return (
    <div className="container mt-4 mb-5">
      <div className="row mb-4 align-items-center">
        <div className="col-md-8">
          <h2 className="fw-bold text-dark mb-1">CampusHub Administrator Console</h2>
          <p className="text-muted mb-0">System metrics, transaction breakdowns, and activity logging overview</p>
        </div>
        <div className="col-md-4 text-md-end mt-3 mt-md-0">
          <Link to="/admin/oversight" className="btn btn-outline-danger shadow-sm fw-semibold">
            <i className="bi bi-shield-lock me-2"></i>Message Oversight Tool
          </Link>
        </div>
      </div>

      {/* Stats Widgets Grid */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-0 bg-primary text-white h-100">
            <div className="card-body p-3">
              <h6 className="text-uppercase fw-semibold opacity-75 fs-7 mb-2">Total Students</h6>
              <h2 className="fw-bold mb-0">{stats?.totalStudents}</h2>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-0 bg-success text-white h-100">
            <div className="card-body p-3">
              <h6 className="text-uppercase fw-semibold opacity-75 fs-7 mb-2">Total Faculty</h6>
              <h2 className="fw-bold mb-0">{stats?.totalFaculty}</h2>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-0 bg-info text-white h-100">
            <div className="card-body p-3">
              <h6 className="text-uppercase fw-semibold opacity-75 fs-7 mb-2">Total Event Registrations</h6>
              <h2 className="fw-bold mb-0">{stats?.totalRegistrations}</h2>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="card shadow-sm border-0 bg-warning text-dark h-100">
            <div className="card-body p-3">
              <h6 className="text-uppercase fw-semibold opacity-75 fs-7 mb-2">Total Revenue</h6>
              <h2 className="fw-bold mb-0">INR {stats?.totalRevenue}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Charts & Analytics Visuals */}
        <div className="col-md-7">
          <div className="card shadow-sm border-0 bg-white h-100">
            <div className="card-body p-4">
              <h5 className="fw-bold text-dark border-bottom pb-2 mb-4">Transaction Analytics</h5>
              
              <div className="row align-items-center mb-4">
                {/* SVG Doughnut chart */}
                <div className="col-sm-5 text-center">
                  <svg width="150" height="150" viewBox="0 0 36 36" className="mx-auto">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#dc3545" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.915"
                      fill="none"
                      stroke="#198754"
                      strokeWidth="3.2"
                      strokeDasharray={`${successPercentage} ${100 - successPercentage}`}
                      strokeDashoffset="25"
                    />
                    <g className="text-center">
                      <text x="18" y="20.5" textAnchor="middle" className="fw-bold" style={{ fontSize: '7px', fill: '#333' }}>
                        {successPercentage}%
                      </text>
                    </g>
                  </svg>
                  <div className="fs-7 text-muted mt-2 fw-semibold">Payment Success Rate</div>
                </div>

                <div className="col-sm-7 pt-3 pt-sm-0">
                  <div className="d-flex align-items-center mb-2">
                    <span className="badge bg-success me-2" style={{ width: '12px', height: '12px', display: 'inline-block' }}></span>
                    <span className="fs-6 me-auto">Successful Payments:</span>
                    <strong className="text-dark">{successfulPayCount}</strong>
                  </div>
                  <div className="d-flex align-items-center mb-3">
                    <span className="badge bg-danger me-2" style={{ width: '12px', height: '12px', display: 'inline-block' }}></span>
                    <span className="fs-6 me-auto">Failed Payments:</span>
                    <strong className="text-dark">{failedPayCount} ({failPercentage}%)</strong>
                  </div>
                  <div className="border-top pt-2 d-flex justify-content-between text-muted fs-7">
                    <span>Total Attempts:</span>
                    <span>{totalPayCount} Transactions</span>
                  </div>
                </div>
              </div>

              {/* Module wise counts bar charts */}
              <h6 className="fw-bold text-secondary mb-3">Resource Distributions</h6>
              <div className="row text-center align-items-end g-3 pt-3" style={{ height: '180px' }}>
                <div className="col-3">
                  <div className="bg-primary rounded-top mx-auto transition hover-shadow" style={{ width: '40px', height: getBarHeight(stats?.totalNotes) }}></div>
                  <div className="fs-7 fw-semibold text-dark mt-2">{stats?.totalNotes}</div>
                  <div className="text-muted fs-7" style={{ fontSize: '11px' }}>Notes</div>
                </div>
                <div className="col-3">
                  <div className="bg-success rounded-top mx-auto transition hover-shadow" style={{ width: '40px', height: getBarHeight(stats?.totalPlacements) }}></div>
                  <div className="fs-7 fw-semibold text-dark mt-2">{stats?.totalPlacements}</div>
                  <div className="text-muted fs-7" style={{ fontSize: '11px' }}>Placements</div>
                </div>
                <div className="col-3">
                  <div className="bg-info rounded-top mx-auto transition hover-shadow" style={{ width: '40px', height: getBarHeight(stats?.totalEvents) }}></div>
                  <div className="fs-7 fw-semibold text-dark mt-2">{stats?.totalEvents}</div>
                  <div className="text-muted fs-7" style={{ fontSize: '11px' }}>Events</div>
                </div>
                <div className="col-3">
                  <div className="bg-warning rounded-top mx-auto transition hover-shadow" style={{ width: '40px', height: getBarHeight(stats?.totalRegistrations) }}></div>
                  <div className="fs-7 fw-semibold text-dark mt-2">{stats?.totalRegistrations}</div>
                  <div className="text-muted fs-7" style={{ fontSize: '11px' }}>Tickets</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Log */}
        <div className="col-md-5">
          <div className="card shadow-sm border-0 bg-white h-100">
            <div className="card-body p-4">
              <h5 className="fw-bold text-dark border-bottom pb-2 mb-3">Recent Campus Activity</h5>
              <div className="list-group list-group-flush" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {activity.length === 0 ? (
                  <p className="text-muted text-center py-4 fs-6">No recent updates logged in modules.</p>
                ) : (
                  activity.map((item, idx) => {
                    let badgeColor = 'bg-primary';
                    if (item.type === 'Placement') badgeColor = 'bg-success';
                    if (item.type === 'Event') badgeColor = 'bg-info';

                    return (
                      <div className="list-group-item border-0 px-0 py-3" key={`${item.id}-${idx}`}>
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <span className={`badge ${badgeColor} rounded-pill fs-7 mb-1`}>{item.type}</span>
                          <small className="text-muted" style={{ fontSize: '10px' }}>
                            {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </small>
                        </div>
                        <h6 className="fw-bold mb-1 text-dark text-truncate">{item.title}</h6>
                        <small className="text-muted d-block">
                          Published by: <strong>{item.creator}</strong> ({item.role})
                        </small>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
