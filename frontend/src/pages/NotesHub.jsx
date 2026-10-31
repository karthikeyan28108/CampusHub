import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import api from '../services/api.js';

const NotesHub = () => {
  const { user } = useSelector((state) => state.auth);
  
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters state
  const [filters, setFilters] = useState({
    department: '',
    year: '',
    semester: '',
    subject: '',
    search: ''
  });

  // Upload Form state
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    subject: '',
    department: '',
    year: '1',
    semester: '1'
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch Notes
  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key]) {
          queryParams.append(key, filters[key]);
        }
      });

      const response = await api.get(`/notes?${queryParams.toString()}`);
      setNotes(response.data.notes);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch notes.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.department, filters.year, filters.semester]); // Refetch on dropdown change

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchNotes();
  };

  const handleUploadChange = (e) => {
    setUploadForm({
      ...uploadForm,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!uploadForm.title || !uploadForm.description || !uploadForm.subject || !uploadForm.department || !selectedFile) {
      setError('Please fill in all required fields and select a file.');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description);
      formData.append('subject', uploadForm.subject);
      formData.append('department', uploadForm.department);
      formData.append('year', uploadForm.year);
      formData.append('semester', uploadForm.semester);
      formData.append('file', selectedFile);

      await api.post('/notes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess('Note uploaded successfully!');
      // Reset form
      setUploadForm({
        title: '',
        description: '',
        subject: '',
        department: '',
        year: '1',
        semester: '1'
      });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Refresh list
      fetchNotes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload note.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    setError('');
    setSuccess('');
    try {
      const response = await api.delete(`/notes/${noteId}`);
      setSuccess(response.data.message || 'Note deleted successfully.');
      fetchNotes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete note.');
    }
  };

  const resolveDownloadUrl = (fileUrl) => {
    if (!fileUrl) return '#';
    if (fileUrl.startsWith('http')) {
      return fileUrl;
    }
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 
      (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000');
    return `${backendUrl}${fileUrl}`;
  };

  const canUpload = user?.role === 'faculty' || user?.role === 'admin';

  return (
    <div className="container mt-4 mb-5">
      <div className="row mb-4 align-items-center">
        <div className="col-md-8">
          <h2 className="fw-bold text-primary">Notes Hub</h2>
          <p className="text-muted">Browse, download, and share academic notes and resources</p>
        </div>
        {canUpload && (
          <div className="col-md-4 text-md-end">
            <button className="btn btn-primary px-4 py-2" data-bs-toggle="collapse" data-bs-target="#uploadFormCollapse">
              <i className="bi bi-cloud-upload me-2"></i>Upload Note
            </button>
          </div>
        )}
      </div>

      {/* Upload Collapse Panel */}
      {canUpload && (
        <div className="collapse mb-4" id="uploadFormCollapse">
          <div className="card card-body shadow-sm border-0 bg-light p-4">
            <h5 className="fw-bold mb-3 text-primary">Upload Academic Note</h5>
            <form onSubmit={handleUploadSubmit}>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Note Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="title"
                    placeholder="e.g. Introduction to Database Systems"
                    value={uploadForm.title}
                    onChange={handleUploadChange}
                    required
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Subject *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="subject"
                    placeholder="e.g. DBMS"
                    value={uploadForm.subject}
                    onChange={handleUploadChange}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Description *</label>
                <textarea
                  className="form-control"
                  name="description"
                  rows="2"
                  placeholder="Provide a brief summary of the contents"
                  value={uploadForm.description}
                  onChange={handleUploadChange}
                  required
                ></textarea>
              </div>

              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Department *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="department"
                    placeholder="e.g. CSE"
                    value={uploadForm.department}
                    onChange={handleUploadChange}
                    required
                  />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Year *</label>
                  <select className="form-select" name="year" value={uploadForm.year} onChange={handleUploadChange} required>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Semester *</label>
                  <select className="form-select" name="semester" value={uploadForm.semester} onChange={handleUploadChange} required>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                    <option value="3">Semester 3</option>
                    <option value="4">Semester 4</option>
                    <option value="5">Semester 5</option>
                    <option value="6">Semester 6</option>
                    <option value="7">Semester 7</option>
                    <option value="8">Semester 8</option>
                  </select>
                </div>
              </div>

              <div className="row align-items-end">
                <div className="col-md-8 mb-3">
                  <label className="form-label">Upload File (PDF, DOCX, Images) *</label>
                  <input
                    type="file"
                    className="form-control"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    required
                  />
                </div>
                <div className="col-md-4 mb-3">
                  <button type="submit" className="btn btn-primary w-100 py-2" disabled={uploadLoading}>
                    {uploadLoading ? (
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    ) : null}
                    Submit Upload
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && <div className="alert alert-danger shadow-sm mb-4" role="alert">{error}</div>}
      {success && <div className="alert alert-success shadow-sm mb-4" role="alert">{success}</div>}

      {/* Filter and Search Bar */}
      <div className="card shadow-sm border-0 p-3 mb-4 bg-white">
        <form onSubmit={handleSearchSubmit}>
          <div className="row g-2">
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                name="search"
                placeholder="Search notes..."
                value={filters.search}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-md-3">
              <input
                type="text"
                className="form-control"
                name="subject"
                placeholder="Filter by subject"
                value={filters.subject}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-md-2">
              <select className="form-select" name="department" value={filters.department} onChange={handleFilterChange}>
                <option value="">All Departments</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="MECH">MECH</option>
                <option value="CIVIL">CIVIL</option>
              </select>
            </div>
            <div className="col-md-2">
              <select className="form-select" name="year" value={filters.year} onChange={handleFilterChange}>
                <option value="">All Years</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
              </select>
            </div>
            <div className="col-md-2">
              <button type="submit" className="btn btn-outline-primary w-100">Search</button>
            </div>
          </div>
        </form>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="text-center my-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-5 bg-white shadow-sm rounded">
          <h5 className="text-muted mb-0">No notes found matching your filters.</h5>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-md-3 g-4">
          {notes.map((note) => (
            <div className="col" key={note._id}>
              <div className="card h-100 shadow-sm border-0 hover-shadow transition">
                <div className="card-header bg-white border-0 pt-3 pb-0 d-flex justify-content-between align-items-start">
                  <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-2 fs-7">
                    {note.subject}
                  </span>
                  <small className="text-muted">{new Date(note.createdAt).toLocaleDateString()}</small>
                </div>
                <div className="card-body">
                  <h5 className="card-title fw-bold text-dark mb-2">{note.title}</h5>
                  <p className="card-text text-muted fs-6 mb-3">{note.description}</p>
                  <div className="bg-light p-2 rounded mb-3 fs-7">
                    <div><strong>Dept:</strong> {note.department}</div>
                    <div><strong>Year/Sem:</strong> {note.year} Year / Sem {note.semester}</div>
                  </div>
                  <div className="text-secondary fs-7">
                    Uploaded by: <strong>{note.uploadedBy?.name || 'Unknown'}</strong> ({note.uploadedBy?.role || 'user'})
                  </div>
                </div>
                <div className="card-footer bg-white border-0 pb-3 pt-0 d-flex justify-content-between">
                  <a
                    href={resolveDownloadUrl(note.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline-primary btn-sm flex-fill me-2"
                    download
                  >
                    <i className="bi bi-download me-1"></i>Download
                  </a>
                  
                  {/* We always render the delete button so we can test the error message returned when an unauthorized student attempts deletion */}
                  <button
                    onClick={() => handleDeleteNote(note._id)}
                    className="btn btn-outline-danger btn-sm px-3"
                    title="Delete Note"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotesHub;
