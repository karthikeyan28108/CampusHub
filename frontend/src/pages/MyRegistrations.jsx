import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api.js';

const MyRegistrations = () => {
  const { user } = useSelector((state) => state.auth);
  const [searchParams, setSearchParams] = useSearchParams();

  const [registrations, setRegistrations] = useState([]);
  const [eventsList, setEventsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Admin / Faculty filter states
  const initialEventId = searchParams.get('eventId') || '';
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');

  const isAdminOrFaculty = user?.role === 'admin' || user?.role === 'faculty';

  // Fetch all events for filter dropdown (Admin/Faculty)
  useEffect(() => {
    if (isAdminOrFaculty) {
      api.get('/events')
        .then(res => setEventsList(res.data.events || []))
        .catch(err => console.error('Failed to load events for filter:', err));
    }
  }, [isAdminOrFaculty]);

  // Synchronize selectedEventId if query param changes
  useEffect(() => {
    const paramId = searchParams.get('eventId') || '';
    setSelectedEventId(paramId);
  }, [searchParams]);

  // Fetch registrations
  const fetchRegistrations = async () => {
    setLoading(true);
    setError('');
    try {
      if (isAdminOrFaculty) {
        // Admin / Faculty: Fetch all registered users
        const url = selectedEventId
          ? `/events/registrations/all?eventId=${selectedEventId}`
          : '/events/registrations/all';
        const response = await api.get(url);
        setRegistrations(response.data.registrations || []);
      } else {
        // Student: Fetch personal registered tickets
        const response = await api.get('/events/registrations/my');
        setRegistrations(response.data.registrations || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch registrations log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
  }, [isAdminOrFaculty, selectedEventId]);

  // Handle event dropdown filter change
  const handleEventChange = (e) => {
    const val = e.target.value;
    setSelectedEventId(val);
    if (val) {
      setSearchParams({ eventId: val });
    } else {
      setSearchParams({});
    }
  };

  // Client-side filtering for Admin search
  const filteredRegistrations = useMemo(() => {
    if (!isAdminOrFaculty) return registrations;

    return registrations.filter(reg => {
      const u = reg.user || {};
      const ev = reg.event || {};
      const pay = reg.payment || {};

      const matchesSearch = !searchQuery || (
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.registerNumber && u.registerNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ev.title && ev.title.toLowerCase().includes(searchQuery.toLowerCase()))
      );

      const matchesStatus = !statusFilter || reg.registrationStatus === statusFilter;

      const matchesPayment = !paymentFilter || (
        paymentFilter === 'Free' ? !ev.isPaid :
        pay.status === paymentFilter
      );

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [registrations, isAdminOrFaculty, searchQuery, statusFilter, paymentFilter]);

  // ==========================================
  // VIEW: ADMIN & FACULTY DIRECTORY VIEW
  // ==========================================
  if (isAdminOrFaculty) {
    return (
      <div className="container mt-4 mb-5">
        {/* Header */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 pb-3 border-bottom">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <h2 className="fw-bold text-primary mb-0">
                <i className="bi bi-people-fill me-2"></i>Event Registrations Directory
              </h2>
              <span className="badge bg-primary-subtle text-primary border px-2 py-1 fs-7">
                {user?.role === 'admin' ? 'Admin Access' : 'Faculty Access'}
              </span>
            </div>
            <p className="text-muted mb-0">
              Review registered students roster, verification statuses, and payment audit logs
            </p>
          </div>

          <div className="mt-3 mt-md-0 d-flex align-items-center gap-2">
            <span className="badge bg-primary fs-6 px-3 py-2 rounded-pill shadow-sm">
              Total Registrations: {filteredRegistrations.length}
            </span>
            <button
              onClick={fetchRegistrations}
              className="btn btn-outline-secondary btn-sm"
              title="Refresh list"
            >
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger shadow-sm mb-4" role="alert">{error}</div>}

        {/* Filters and Search Bar */}
        <div className="card shadow-sm border-0 mb-4 bg-white">
          <div className="card-body p-3">
            <div className="row g-2 align-items-center">
              {/* Event dropdown selector */}
              <div className="col-12 col-md-4">
                <label className="form-label fs-7 fw-semibold text-muted mb-1">Filter by Event</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedEventId}
                  onChange={handleEventChange}
                >
                  <option value="">-- All Events ({eventsList.length}) --</option>
                  {eventsList.map(ev => (
                    <option key={ev._id} value={ev._id}>
                      {ev.title} {ev.isPaid ? `(Paid: ₹${ev.registrationFee})` : '(Free)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Student search input */}
              <div className="col-12 col-md-4">
                <label className="form-label fs-7 fw-semibold text-muted mb-1">Search Student</label>
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light"><i className="bi bi-search"></i></span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by name, roll no, dept..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => setSearchQuery('')}
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Reg status filter */}
              <div className="col-6 col-md-2">
                <label className="form-label fs-7 fw-semibold text-muted mb-1">Reg Status</label>
                <select
                  className="form-select form-select-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              {/* Payment filter */}
              <div className="col-6 col-md-2">
                <label className="form-label fs-7 fw-semibold text-muted mb-1">Payment</label>
                <select
                  className="form-select form-select-sm"
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                >
                  <option value="">All Payments</option>
                  <option value="Completed">Completed</option>
                  <option value="Pending">Pending</option>
                  <option value="Free">Free Event</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Content table */}
        {loading ? (
          <div className="text-center my-5 py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading registrations...</span>
            </div>
            <p className="text-muted mt-2 fs-7">Loading registered attendee list...</p>
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="text-center py-5 bg-white shadow-sm rounded border">
            <i className="bi bi-person-x text-muted display-4 mb-3 d-block"></i>
            <h5 className="text-dark fw-bold mb-1">No registered students found</h5>
            <p className="text-muted fs-7 mb-3">
              {searchQuery || statusFilter || paymentFilter || selectedEventId
                ? 'Try adjusting your filters or search query.'
                : 'No students have registered for events yet.'}
            </p>
            {(searchQuery || statusFilter || paymentFilter || selectedEventId) && (
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('');
                  setPaymentFilter('');
                  setSelectedEventId('');
                  setSearchParams({});
                }}
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="card shadow-sm border-0 bg-white">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light fs-7 text-uppercase text-secondary">
                  <tr>
                    <th className="py-3 ps-3">#</th>
                    <th className="py-3">Registered Student</th>
                    <th className="py-3">Event Details</th>
                    <th className="py-3">Ticket / Payment</th>
                    <th className="py-3">Status</th>
                    <th className="py-3 pe-3">Registered On</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegistrations.map((reg, index) => (
                    <tr key={reg._id}>
                      <td className="ps-3 text-muted fs-7">{index + 1}</td>
                      <td>
                        <div className="fw-bold text-dark">{reg.user?.name || 'Unknown Student'}</div>
                        <div className="d-flex align-items-center gap-2 mt-1">
                          <span className="badge bg-light text-dark border fs-8">
                            {reg.user?.registerNumber || 'No Reg No'}
                          </span>
                          <span className="text-muted fs-8">
                            {reg.user?.department || 'Dept N/A'}
                            {reg.user?.year ? ` • Yr ${reg.user.year}` : ''}
                          </span>
                        </div>
                        <div className="text-muted fs-8 mt-1">
                          <i className="bi bi-envelope me-1"></i>{reg.user?.email}
                        </div>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{reg.event?.title || 'Unknown Event'}</div>
                        <div className="d-flex align-items-center gap-2 text-muted fs-8 mt-1">
                          <span className="badge bg-secondary-subtle text-dark fs-8">
                            {reg.event?.category || 'Event'}
                          </span>
                          {reg.event?.eventDate && (
                            <span>
                              <i className="bi bi-calendar3 me-1"></i>
                              {new Date(reg.event.eventDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {reg.event?.isPaid ? (
                          <div>
                            <span className="fw-semibold text-dark fs-7">
                              Paid (INR {reg.event.registrationFee})
                            </span>
                            <div className="mt-1">
                              <span className={`badge fs-8 ${
                                reg.payment?.status === 'Completed'
                                  ? 'bg-success-subtle text-success border border-success'
                                  : 'bg-warning-subtle text-warning border border-warning'
                              }`}>
                                {reg.payment?.status || 'Pending Payment'}
                              </span>
                            </div>
                            {reg.payment?.razorpayPaymentId && (
                              <div className="text-muted font-monospace fs-8 mt-1">
                                {reg.payment.razorpayPaymentId}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="badge bg-light text-muted border fs-7">Free Ticket</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge px-3 py-2 rounded-pill fs-7 ${
                          reg.registrationStatus === 'Confirmed'
                            ? 'bg-success-subtle text-success border border-success'
                            : 'bg-warning-subtle text-warning border border-warning'
                        }`}>
                          <i className={`bi ${reg.registrationStatus === 'Confirmed' ? 'bi-check-circle-fill' : 'bi-hourglass-split'} me-1`}></i>
                          {reg.registrationStatus}
                        </span>
                      </td>
                      <td className="pe-3 text-muted fs-7">
                        <div>{new Date(reg.registeredAt || reg.createdAt).toLocaleDateString()}</div>
                        <div className="fs-8 text-muted">{new Date(reg.registeredAt || reg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: STUDENT PERSONAL REGISTRATIONS
  // ==========================================
  return (
    <div className="container mt-4 mb-5">
      <h2 className="fw-bold text-primary mb-1">My Registered Events</h2>
      <p className="text-muted mb-4">View your registration ticket summaries and transaction histories</p>

      {error && <div className="alert alert-danger shadow-sm mb-4" role="alert">{error}</div>}

      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : registrations.length === 0 ? (
        <div className="text-center py-5 bg-white shadow-sm rounded">
          <h5 className="text-muted mb-0">You have not registered for any events yet.</h5>
        </div>
      ) : (
        <div className="row g-3">
          {registrations.map((reg) => (
            <div className="col-12" key={reg._id}>
              <div className="card shadow-sm border-0 bg-white">
                <div className="card-body p-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center">
                  <div className="mb-3 mb-md-0">
                    <span className="badge bg-secondary-subtle text-dark mb-2 px-3 py-1 fs-7">
                      {reg.event?.category || 'Event'}
                    </span>
                    <h4 className="fw-bold text-dark mb-1">{reg.event?.title || 'Unknown Event'}</h4>
                    <div className="text-muted fs-7">
                      <span className="me-3"><i className="bi bi-geo-alt me-1 text-primary"></i>{reg.event?.venue}</span>
                      <span><i className="bi bi-calendar-event me-1 text-primary"></i>{reg.event?.eventDate ? new Date(reg.event.eventDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-3 align-items-center">
                    {/* Fee details */}
                    <div className="bg-light p-2 rounded text-center px-3">
                      <div className="fs-7 text-muted">Ticket Type</div>
                      <strong className="text-dark">
                        {reg.event?.isPaid ? `Paid (INR ${reg.event?.registrationFee})` : 'Free'}
                      </strong>
                    </div>

                    {/* Registration Status */}
                    <div className="text-center px-3">
                      <div className="fs-7 text-muted">Reg Status</div>
                      <span className={`badge px-3 py-2 rounded-pill ${
                        reg.registrationStatus === 'Confirmed' ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'
                      }`}>
                        {reg.registrationStatus}
                      </span>
                    </div>

                    {/* Payment status (for paid events) */}
                    {reg.event?.isPaid && reg.payment && (
                      <div className="text-center px-3">
                        <div className="fs-7 text-muted">Payment status</div>
                        <span className={`badge px-3 py-2 rounded-pill ${
                          reg.payment.status === 'Completed' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'
                        }`}>
                          {reg.payment.status}
                        </span>
                      </div>
                    )}

                    {/* Event Lifecycle Status */}
                    {reg.event?.status === 'Expired' && (
                      <div className="text-center px-3">
                        <div className="fs-7 text-muted">Event Status</div>
                        <span className="badge px-3 py-2 rounded-pill bg-secondary text-white">
                          Concluded
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyRegistrations;
