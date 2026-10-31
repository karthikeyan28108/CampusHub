import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api.js';

const Placements = () => {
  const { user } = useSelector((state) => state.auth);
  
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtering states
  const [filters, setFilters] = useState({
    department: '',
    search: '',
    status: 'Open'
  });

  // Admin placement form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    companyName: '',
    jobRole: '',
    description: '',
    eligibility: '',
    departments: '',
    minimumCGPA: '0',
    backlogRequirement: false,
    salary: '',
    location: '',
    applicationLink: '',
    deadline: '',
    requiredSkills: '',
    selectionProcess: ''
  });
  const [formLoading, setFormLoading] = useState(false);

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      if (filters.department) queryParams.append('department', filters.department);
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.status) queryParams.append('status', filters.status);

      const response = await api.get(`/placements?${queryParams.toString()}`);
      setPlacements(response.data.placements);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch placements.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchPlacements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.department, filters.status]); // Refetch on filter select change

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPlacements();
  };

  const handleFormChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({
      ...form,
      [e.target.name]: value
    });
  };

  const startEdit = (placement) => {
    setIsEditing(true);
    setEditingId(placement._id);
    setForm({
      companyName: placement.companyName,
      jobRole: placement.jobRole,
      description: placement.description,
      eligibility: placement.eligibility || '',
      departments: placement.departments.join(', '),
      minimumCGPA: String(placement.minimumCGPA),
      backlogRequirement: placement.backlogRequirement,
      salary: placement.salary || '',
      location: placement.location || '',
      applicationLink: placement.applicationLink || '',
      deadline: placement.deadline ? placement.deadline.split('T')[0] : '',
      requiredSkills: placement.requiredSkills.join(', '),
      selectionProcess: placement.selectionProcess || ''
    });
    
    // Smooth scroll to form
    const formElement = document.getElementById('placementFormCard');
    formElement?.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditingId(null);
    setForm({
      companyName: '',
      jobRole: '',
      description: '',
      eligibility: '',
      departments: '',
      minimumCGPA: '0',
      backlogRequirement: false,
      salary: '',
      location: '',
      applicationLink: '',
      deadline: '',
      requiredSkills: '',
      selectionProcess: ''
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.companyName || !form.jobRole || !form.description || !form.departments) {
      setError('Please fill in all required fields.');
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        ...form,
        departments: form.departments.split(',').map(d => d.trim()).filter(Boolean),
        minimumCGPA: Number(form.minimumCGPA) || 0
      };

      if (isEditing) {
        await api.put(`/placements/${editingId}`, payload);
        setSuccess('Placement drive updated successfully!');
      } else {
        await api.post('/placements', payload);
        setSuccess('New placement drive published successfully!');
      }

      cancelEdit();
      fetchPlacements();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit placement form.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    setSuccess('');
    if (!window.confirm('Are you sure you want to delete this placement drive?')) return;
    
    try {
      await api.delete(`/placements/${id}`);
      setSuccess('Placement drive deleted successfully.');
      fetchPlacements();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete placement drive.');
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="container mt-4 mb-5">
      <div className="row mb-4 align-items-center">
        <div className="col-md-8">
          <h2 className="fw-bold text-primary">Placements & Career Drive</h2>
          <p className="text-muted">Explore active campus placements, job offers, and internships</p>
        </div>
        {isAdmin && !isEditing && (
          <div className="col-md-4 text-md-end">
            <button className="btn btn-primary px-4 py-2" data-bs-toggle="collapse" data-bs-target="#placementFormCollapse">
              <i className="bi bi-plus-circle me-2"></i>Post Placement Drive
            </button>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && <div className="alert alert-danger shadow-sm mb-4" role="alert">{error}</div>}
      {success && <div className="alert alert-success shadow-sm mb-4" role="alert">{success}</div>}

      {/* Admin Post/Edit Form (Collapsible/Dynamic Card) */}
      {isAdmin && (
        <div className={`collapse ${isEditing ? 'show' : ''} mb-4`} id="placementFormCollapse">
          <div className="card card-body shadow-sm border-0 bg-light p-4" id="placementFormCard">
            <h5 className="fw-bold mb-3 text-primary">{isEditing ? 'Edit Placement Listing' : 'Publish Placement Drive'}</h5>
            <form onSubmit={handleFormSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Company Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="companyName"
                    value={form.companyName}
                    onChange={handleFormChange}
                    placeholder="e.g. Google"
                    required
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Job Role *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="jobRole"
                    value={form.jobRole}
                    onChange={handleFormChange}
                    placeholder="e.g. Software Engineer Graduate"
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Description *</label>
                <textarea
                  className="form-control"
                  name="description"
                  rows="3"
                  value={form.description}
                  onChange={handleFormChange}
                  placeholder="Overview of the job role and details of the company..."
                  required
                ></textarea>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Departments (Comma separated) *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="departments"
                    value={form.departments}
                    onChange={handleFormChange}
                    placeholder="e.g. CSE, ECE, IT"
                    required
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Eligibility / CGPA requirements</label>
                  <input
                    type="text"
                    className="form-control"
                    name="eligibility"
                    value={form.eligibility}
                    onChange={handleFormChange}
                    placeholder="e.g. Open to B.Tech final year students"
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-3 mb-3">
                  <label className="form-label">Minimum CGPA required</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    name="minimumCGPA"
                    value={form.minimumCGPA}
                    onChange={handleFormChange}
                    placeholder="e.g. 7.5"
                  />
                </div>
                <div className="col-md-3 mb-3 align-self-center pt-3">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="backlogCheck"
                      name="backlogRequirement"
                      checked={form.backlogRequirement}
                      onChange={handleFormChange}
                    />
                    <label className="form-check-label" htmlFor="backlogCheck">Active Backlogs Allowed</label>
                  </div>
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Salary Package</label>
                  <input
                    type="text"
                    className="form-control"
                    name="salary"
                    value={form.salary}
                    onChange={handleFormChange}
                    placeholder="e.g. $120,000 / annum"
                  />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label">Job Location</label>
                  <input
                    type="text"
                    className="form-control"
                    name="location"
                    value={form.location}
                    onChange={handleFormChange}
                    placeholder="e.g. Seattle, WA"
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Application Link</label>
                  <input
                    type="url"
                    className="form-control"
                    name="applicationLink"
                    value={form.applicationLink}
                    onChange={handleFormChange}
                    placeholder="https://careers.company.com/job"
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Application Deadline</label>
                  <input
                    type="date"
                    className="form-control"
                    name="deadline"
                    value={form.deadline}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Required Skills (Comma separated)</label>
                  <input
                    type="text"
                    className="form-control"
                    name="requiredSkills"
                    value={form.requiredSkills}
                    onChange={handleFormChange}
                    placeholder="e.g. JavaScript, React, Node.js"
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Selection Process Overview</label>
                  <input
                    type="text"
                    className="form-control"
                    name="selectionProcess"
                    value={form.selectionProcess}
                    onChange={handleFormChange}
                    placeholder="e.g. Coding Test -> 2 Tech Interviews -> HR"
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-2">
                {isEditing && (
                  <button type="button" className="btn btn-outline-secondary px-4" onClick={cancelEdit}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary px-4" disabled={formLoading}>
                  {formLoading ? (
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  ) : null}
                  {isEditing ? 'Save Changes' : 'Publish Drive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="card shadow-sm border-0 p-3 mb-4 bg-white">
        <form onSubmit={handleSearchSubmit}>
          <div className="row g-2">
            <div className="col-md-4">
              <input
                type="text"
                className="form-control"
                name="search"
                placeholder="Search by Company or Job Role..."
                value={filters.search}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-md-3">
              <select className="form-select" name="department" value={filters.department} onChange={handleFilterChange}>
                <option value="">All Departments</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="IT">IT</option>
                <option value="MECH">MECH</option>
                <option value="CIVIL">CIVIL</option>
              </select>
            </div>
            <div className="col-md-3">
              <select className="form-select" name="status" value={filters.status} onChange={handleFilterChange}>
                <option value="Open">Active/Open drives only</option>
                <option value="Closed">Closed drives only</option>
                <option value="All">All listings</option>
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-outline-primary w-100">Apply Filters</button>
            </div>
          </div>
        </form>
      </div>

      {/* Grid of Placement drives */}
      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : placements.length === 0 ? (
        <div className="text-center py-5 bg-white shadow-sm rounded">
          <h5 className="text-muted mb-0">No placement drives found matching your criteria.</h5>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-md-2 g-4">
          {placements.map((drive) => (
            <div className="col" key={drive._id}>
              <div className="card h-100 shadow-sm border-0 hover-shadow transition">
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div>
                      <h4 className="fw-bold text-dark mb-1">{drive.companyName}</h4>
                      <h6 className="text-primary fw-semibold">{drive.jobRole}</h6>
                    </div>
                    <span className={`badge px-3 py-2 rounded-pill ${
                      drive.status === 'Open' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'
                    }`}>
                      {drive.status}
                    </span>
                  </div>

                  <p className="text-muted fs-6 mb-4 word-break">{drive.description}</p>

                  <div className="bg-light rounded p-3 mb-4">
                    <div className="row g-2 fs-7">
                      <div className="col-6"><strong>Target Depts:</strong> {drive.departments.join(', ')}</div>
                      <div className="col-6"><strong>Salary Package:</strong> {drive.salary || 'N/A'}</div>
                      <div className="col-6"><strong>Min CGPA:</strong> {drive.minimumCGPA > 0 ? drive.minimumCGPA : 'No Limit'}</div>
                      <div className="col-6"><strong>Backlogs Allowed:</strong> {drive.backlogRequirement ? 'Yes' : 'No'}</div>
                      <div className="col-6"><strong>Job Location:</strong> {drive.location || 'N/A'}</div>
                      <div className="col-6 text-danger">
                        <strong>Deadline:</strong> {drive.deadline ? new Date(drive.deadline).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {drive.requiredSkills.length > 0 && (
                    <div className="mb-4">
                      <strong className="fs-7 text-secondary d-block mb-1">Required Skills:</strong>
                      <div className="d-flex flex-wrap gap-1">
                        {drive.requiredSkills.map((skill, index) => (
                          <span key={index} className="badge bg-secondary-subtle text-dark fs-7">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {drive.selectionProcess && (
                    <div className="mb-4 fs-7 text-secondary">
                      <strong>Selection Rounds:</strong> {drive.selectionProcess}
                    </div>
                  )}

                  <div className="d-flex justify-content-between align-items-center mt-3 border-top pt-3">
                    <div>
                      {drive.applicationLink ? (
                        <a
                          href={drive.applicationLink}
                          target="_blank"
                          rel="noreferrer"
                          className={`btn btn-primary px-4 py-2 ${drive.status !== 'Open' ? 'disabled' : ''}`}
                        >
                          <i className="bi bi-box-arrow-up-right me-2"></i>Apply Now
                        </a>
                      ) : (
                        <span className="text-muted fs-7">No online link provided</span>
                      )}
                    </div>
                    
                    {isAdmin && (
                      <div className="d-flex gap-2">
                        <button
                          onClick={() => startEdit(drive)}
                          className="btn btn-outline-secondary btn-sm"
                          title="Edit listing"
                        >
                          <i className="bi bi-pencil-square"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(drive._id)}
                          className="btn btn-outline-danger btn-sm"
                          title="Delete Listing"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
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

export default Placements;
