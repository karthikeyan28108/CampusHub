import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../services/api.js';

const Events = () => {
  const { user } = useSelector((state) => state.auth);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search/Filters state
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    isPaid: ''
  });

  // Event creation form state (Faculty/Admin only)
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    category: 'Technical',
    organizer: '',
    venue: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    registrationDeadline: '',
    maxParticipants: '0',
    isPaid: false,
    registrationFee: '0',
    rules: '',
    contactInformation: ''
  });
  const [uploadLoading, setUploadLoading] = useState(false);

  // Mock checkout overlay state
  const [showMockCheckout, setShowMockCheckout] = useState(false);
  const [activeMockOrder, setActiveMockOrder] = useState(null);

  // Dynamically load Razorpay SDK script once on mount
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.isPaid) queryParams.append('isPaid', filters.isPaid);

      const response = await api.get(`/events?${queryParams.toString()}`);
      setEvents(response.data.events);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch events list.');
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.category, filters.isPaid]);

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.isPaid]);

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEvents();
  };

  const handleFormChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setEventForm({
      ...eventForm,
      [e.target.name]: value
    });
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!eventForm.title || !eventForm.description || !eventForm.organizer || !eventForm.venue || !eventForm.eventDate || !eventForm.startTime || !eventForm.endTime || !eventForm.registrationDeadline) {
      setError('Please fill in all required fields.');
      return;
    }

    setUploadLoading(true);
    try {
      await api.post('/events', eventForm);
      setSuccess('Event published successfully!');
      // Reset form
      setEventForm({
        title: '',
        description: '',
        category: 'Technical',
        organizer: '',
        venue: '',
        eventDate: '',
        startTime: '',
        endTime: '',
        registrationDeadline: '',
        maxParticipants: '0',
        isPaid: false,
        registrationFee: '0',
        rules: '',
        contactInformation: ''
      });
      fetchEvents();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create event drive.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRegister = async (eventItem) => {
    setError('');
    setSuccess('');
    try {
      if (!eventItem.isPaid) {
        // Direct free registration
        const response = await api.post(`/events/register/free/${eventItem._id}`);
        setSuccess(response.data.message || 'Registered successfully!');
      } else {
        // Paid registration: Create order
        const response = await api.post(`/events/register/pay-order/${eventItem._id}`);
        const orderData = response.data;

        if (orderData.isMock) {
          // Open custom Mock gateway overlay
          setActiveMockOrder({
            ...orderData,
            eventId: eventItem._id
          });
          setShowMockCheckout(true);
        } else {
          // Open real Razorpay Checkout overlay
          const options = {
            key: orderData.keyId,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'CampusHub Events',
            description: orderData.eventName,
            order_id: orderData.orderId,
            handler: async (response) => {
              // Send signature response back to backend
              try {
                const verifyRes = await api.post('/events/register/verify-payment', {
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  eventId: eventItem._id
                });
                setSuccess(verifyRes.data.message || 'Payment verified and registration confirmed!');
              } catch (verifyErr) {
                setError(verifyErr.response?.data?.message || 'Payment verification failed.');
              }
            },
            prefill: {
              name: orderData.userName,
              email: orderData.userEmail
            },
            theme: {
              color: '#0d6efd'
            }
          };
          const rzp = new window.Razorpay(options);
          rzp.open();
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    }
  };

  const handleMockPayment = async (status) => {
    setShowMockCheckout(false);
    if (!activeMockOrder) return;

    if (status === 'fail') {
      setError('Payment simulated failure.');
      return;
    }

    try {
      const mockPaymentId = `mock_pay_${Date.now()}`;
      const mockSignature = `mock_sig_for_${activeMockOrder.orderId}`;

      const verifyRes = await api.post('/events/register/verify-payment', {
        razorpayOrderId: activeMockOrder.orderId,
        razorpayPaymentId: mockPaymentId,
        razorpaySignature: mockSignature,
        eventId: activeMockOrder.eventId
      });

      setSuccess(verifyRes.data.message || 'Payment simulated success and registration confirmed!');
    } catch (verifyErr) {
      setError(verifyErr.response?.data?.message || 'Simulated verification failed.');
    } finally {
      setActiveMockOrder(null);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/events/${id}`);
      setSuccess('Event removed successfully.');
      fetchEvents();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete event.');
    }
  };

  const handleCleanExpired = async () => {
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/events/cleanup', { hardDelete: false });
      setSuccess(`Cleanup complete. Expired events processed: ${res.data.result?.expiredCount || 0}`);
      fetchEvents();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to trigger expired events cleanup.');
    }
  };

  const canCreate = user?.role === 'faculty' || user?.role === 'admin';

  return (
    <div className="container mt-4 mb-5">
      <div className="row mb-4 align-items-center">
        <div className="col-md-8">
          <h2 className="fw-bold text-primary">Campus Events</h2>
          <p className="text-muted">Register for upcoming symposia, workshops, sports, and club activities</p>
        </div>
        {canCreate && (
          <div className="col-md-4 text-md-end d-flex gap-2 justify-content-md-end">
            <button
              onClick={handleCleanExpired}
              className="btn btn-outline-secondary px-3 py-2"
              title="Scan and remove expired events immediately"
            >
              <i className="bi bi-clock-history me-1"></i>Purge Expired
            </button>
            <button className="btn btn-primary px-4 py-2" data-bs-toggle="collapse" data-bs-target="#eventFormCollapse">
              <i className="bi bi-calendar-plus me-2"></i>Create Event
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && <div className="alert alert-danger shadow-sm mb-4" role="alert">{error}</div>}
      {success && <div className="alert alert-success shadow-sm mb-4" role="alert">{success}</div>}

      {/* Simulated Payment Modal */}
      {showMockCheckout && activeMockOrder && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">Mock Payment Gateway</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowMockCheckout(false)}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <h6>Simulated transaction for: <strong>{activeMockOrder.eventName}</strong></h6>
                <p className="text-muted mb-4">Amount to Pay: <span className="fs-5 fw-bold text-primary">INR {(activeMockOrder.amount / 100).toFixed(2)}</span></p>
                <div className="d-grid gap-2">
                  <button onClick={() => handleMockPayment('success')} className="btn btn-success py-2">
                    Simulate Payment Successful
                  </button>
                  <button onClick={() => handleMockPayment('fail')} className="btn btn-danger py-2">
                    Simulate Payment Failed
                  </button>
                </div>
              </div>
              <div className="modal-footer bg-light justify-content-center">
                <small className="text-muted text-center">This mock gateway intercepts the payload cryptographically on the server-side.</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Creation form */}
      {canCreate && (
        <div className="collapse mb-4" id="eventFormCollapse">
          <div className="card card-body shadow-sm border-0 bg-light p-4">
            <h5 className="fw-bold mb-3 text-primary">Publish Campus Event</h5>
            <form onSubmit={handleEventSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Event Title *</label>
                  <input type="text" className="form-control" name="title" value={eventForm.title} onChange={handleFormChange} required />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Category *</label>
                  <select className="form-select" name="category" value={eventForm.category} onChange={handleFormChange} required>
                    <option value="Technical">Technical (Symposium/Hackathon)</option>
                    <option value="Cultural">Cultural (Music/Dance)</option>
                    <option value="Sports">Sports Meet</option>
                    <option value="Workshop">Educational Workshop</option>
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Description *</label>
                <textarea className="form-control" name="description" rows="3" value={eventForm.description} onChange={handleFormChange} placeholder="Provide overview guidelines..." required></textarea>
              </div>

              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Organizer Dept / Club *</label>
                  <input type="text" className="form-control" name="organizer" value={eventForm.organizer} onChange={handleFormChange} placeholder="e.g. CSE Association" required />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Venue *</label>
                  <input type="text" className="form-control" name="venue" value={eventForm.venue} onChange={handleFormChange} placeholder="e.g. Mini Auditorium" required />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Event Date *</label>
                  <input type="date" className="form-control" name="eventDate" value={eventForm.eventDate} onChange={handleFormChange} required />
                </div>
              </div>

              <div className="row">
                <div className="col-md-3 mb-3">
                  <label className="form-label">Start Time *</label>
                  <input type="text" className="form-control" name="startTime" value={eventForm.startTime} onChange={handleFormChange} placeholder="e.g. 09:30 AM" required />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">End Time *</label>
                  <input type="text" className="form-control" name="endTime" value={eventForm.endTime} onChange={handleFormChange} placeholder="e.g. 04:00 PM" required />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Registration Deadline *</label>
                  <input type="date" className="form-control" name="registrationDeadline" value={eventForm.registrationDeadline} onChange={handleFormChange} required />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Max Participants (0=unlimited)</label>
                  <input type="number" className="form-control" name="maxParticipants" value={eventForm.maxParticipants} onChange={handleFormChange} />
                </div>
              </div>

              <div className="row">
                <div className="col-md-3 mb-3 pt-4">
                  <div className="form-check form-switch pt-2">
                    <input className="form-check-input" type="checkbox" id="paidCheck" name="isPaid" checked={eventForm.isPaid} onChange={handleFormChange} />
                    <label className="form-check-label" htmlFor="paidCheck">Paid Event</label>
                  </div>
                </div>
                {eventForm.isPaid && (
                  <div className="col-md-3 mb-3">
                    <label className="form-label">Registration Fee (INR) *</label>
                    <input type="number" className="form-control" name="registrationFee" value={eventForm.registrationFee} onChange={handleFormChange} required={eventForm.isPaid} />
                  </div>
                )}
                <div className="col-md-6 mb-3">
                  <label className="form-label">Cover Image URL</label>
                  <input type="url" className="form-control" name="image" value={eventForm.image} onChange={handleFormChange} placeholder="https://image-url.com" />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Event Rules</label>
                  <textarea className="form-control" name="rules" rows="2" value={eventForm.rules} onChange={handleFormChange} placeholder="Guidelines..."></textarea>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Contact Information</label>
                  <input type="text" className="form-control" name="contactInformation" value={eventForm.contactInformation} onChange={handleFormChange} placeholder="e.g. Dr. John 9876543210" />
                </div>
              </div>

              <div className="d-flex justify-content-end mt-2">
                <button type="submit" className="btn btn-primary px-4" disabled={uploadLoading}>
                  {uploadLoading ? (
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  ) : null}
                  Publish Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="card shadow-sm border-0 p-3 mb-4 bg-white">
        <form onSubmit={handleSearchSubmit}>
          <div className="row g-2">
            <div className="col-md-4">
              <input type="text" className="form-control" name="search" placeholder="Search events..." value={filters.search} onChange={handleFilterChange} />
            </div>
            <div className="col-md-3">
              <select className="form-select" name="category" value={filters.category} onChange={handleFilterChange}>
                <option value="">All Categories</option>
                <option value="Technical">Technical</option>
                <option value="Cultural">Cultural</option>
                <option value="Sports">Sports</option>
                <option value="Workshop">Workshops</option>
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select" name="isPaid" value={filters.isPaid} onChange={handleFilterChange}>
                <option value="">All Events (Free & Paid)</option>
                <option value="false">Free Events only</option>
                <option value="true">Paid Events only</option>
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-outline-primary w-100">Search</button>
            </div>
          </div>
        </form>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-5 bg-white shadow-sm rounded">
          <h5 className="text-muted mb-0">No active campus events found.</h5>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-md-3 g-4">
          {events.map((evt) => (
            <div className="col" key={evt._id}>
              <div className="card h-100 shadow-sm border-0 hover-shadow transition">
                {evt.image && (
                  <img src={evt.image} className="card-img-top object-fit-cover" height="150" alt={evt.title} />
                )}
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-1 fs-7">{evt.category}</span>
                    <span className={`badge px-2 py-1 fs-7 ${evt.isPaid ? 'bg-warning text-dark' : 'bg-success-subtle text-success'}`}>
                      {evt.isPaid ? `Paid - INR ${evt.registrationFee}` : 'Free'}
                    </span>
                  </div>

                  <h5 className="card-title fw-bold text-dark">{evt.title}</h5>
                  <p className="card-text text-muted fs-6 mb-3 word-break">{evt.description}</p>

                  <div className="bg-light p-2 rounded mb-3 fs-7 text-secondary">
                    <div><strong>Organizer:</strong> {evt.organizer}</div>
                    <div><strong>Venue:</strong> {evt.venue}</div>
                    <div><strong>Date/Time:</strong> {new Date(evt.eventDate).toLocaleDateString()} @ {evt.startTime}</div>
                    <div className="text-danger mt-1"><strong>Deadline:</strong> {new Date(evt.registrationDeadline).toLocaleDateString()}</div>
                  </div>

                  {evt.rules && (
                    <div className="mb-2 fs-7">
                      <strong>Guidelines:</strong> <p className="mb-0 text-muted word-break">{evt.rules}</p>
                    </div>
                  )}

                  {evt.contactInformation && (
                    <div className="fs-7 text-muted mb-3">
                      <strong>Contact:</strong> {evt.contactInformation}
                    </div>
                  )}

                  <div className="d-flex gap-2 align-items-center">
                    {user?.role === 'student' ? (
                      new Date() > new Date(evt.registrationDeadline) ? (
                        <button className="btn btn-secondary w-100 py-2" disabled>
                          <i className="bi bi-clock-history me-1"></i>Registration Closed
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRegister(evt)}
                          className="btn btn-primary w-100 py-2"
                        >
                          Register for Event
                        </button>
                      )
                    ) : (
                      <Link
                        to={`/registrations?eventId=${evt._id}`}
                        className="btn btn-outline-primary w-100 py-2 text-decoration-none text-center fw-medium"
                      >
                        <i className="bi bi-people me-1"></i>View Registered Users
                      </Link>
                    )}

                    {(user?.role === 'admin' || user?.id === evt.createdBy?._id || user?._id === evt.createdBy?._id) && (
                      <button
                        onClick={() => handleDeleteEvent(evt._id)}
                        className="btn btn-outline-danger py-2 px-3"
                        title="Delete Event"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
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

export default Events;
