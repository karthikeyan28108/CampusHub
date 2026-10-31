import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  lookupConversation,
  fetchOversightLogs,
  clearOversightResult,
  clearOversightError
} from '../redux/slices/oversightSlice.js';

const MessageOversight = () => {
  const dispatch = useDispatch();
  const { result, loading, error, logs, logsLoading, logsError } = useSelector(
    (state) => state.oversight
  );

  const [registerNumberA, setRegisterNumberA] = useState('');
  const [registerNumberB, setRegisterNumberB] = useState('');
  const [reason, setReason] = useState('');
  const [activeTab, setActiveTab] = useState('lookup'); // 'lookup' | 'logs'
  const [localValidation, setLocalValidation] = useState('');

  useEffect(() => {
    // Load audit logs on mount
    dispatch(fetchOversightLogs());
  }, [dispatch]);

  const handleLookup = (e) => {
    e.preventDefault();
    setLocalValidation('');
    dispatch(clearOversightError());

    const regA = registerNumberA.trim();
    const regB = registerNumberB.trim();

    if (!regA || !regB) {
      setLocalValidation('Please enter both Register Number A and Register Number B.');
      return;
    }

    if (regA.toLowerCase() === regB.toLowerCase()) {
      setLocalValidation('Register numbers must belong to two distinct users.');
      return;
    }

    dispatch(
      lookupConversation({
        registerNumberA: regA,
        registerNumberB: regB,
        reason: reason.trim() || 'Safety / Moderation Review'
      })
    ).then((action) => {
      if (action.meta.requestStatus === 'fulfilled') {
        // Refresh audit logs in background so new entry shows up in logs tab
        dispatch(fetchOversightLogs());
      }
    });
  };

  const handleClear = () => {
    setRegisterNumberA('');
    setRegisterNumberB('');
    setReason('');
    setLocalValidation('');
    dispatch(clearOversightResult());
  };

  const getConnectionBadge = (status) => {
    switch (status) {
      case 'accepted':
        return <span className="badge bg-success fs-7 px-3 py-2">Connected (Accepted)</span>;
      case 'pending':
        return <span className="badge bg-warning text-dark fs-7 px-3 py-2">Pending Request</span>;
      case 'blocked':
        return <span className="badge bg-danger fs-7 px-3 py-2">Blocked</span>;
      default:
        return <span className="badge bg-secondary fs-7 px-3 py-2">No Connection Record</span>;
    }
  };

  const formatTimestamp = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="container mt-4 mb-5">
      {/* Header */}
      <div className="row align-items-center mb-4">
        <div className="col-md-8">
          <div className="d-flex align-items-center gap-2 mb-1">
            <h2 className="fw-bold text-dark mb-0">Admin Message Oversight</h2>
            <span className="badge bg-danger text-uppercase fs-7">Admin Only</span>
          </div>
          <p className="text-muted mb-0">
            Confidential message transcript inspection between two specific users for formal moderation and safety investigation.
          </p>
        </div>
        <div className="col-md-4 text-md-end mt-3 mt-md-0">
          <div className="btn-group shadow-sm">
            <button
              className={`btn btn-sm ${activeTab === 'lookup' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setActiveTab('lookup')}
            >
              <i className="bi bi-search me-1"></i>Oversight Lookup
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'logs' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => {
                setActiveTab('logs');
                dispatch(fetchOversightLogs());
              }}
            >
              <i className="bi bi-journal-text me-1"></i>Audit Trail ({logs?.length || 0})
            </button>
          </div>
        </div>
      </div>

      {/* Mandatory Audit Notice Banner */}
      <div className="alert alert-warning border-0 shadow-sm d-flex align-items-start gap-3 p-3 mb-4 rounded-3" role="alert">
        <div className="fs-3 text-warning">
          <i className="bi bi-shield-lock-fill"></i>
        </div>
        <div className="flex-grow-1">
          <h6 className="alert-heading fw-bold mb-1">Transparent Security &amp; Audit Logging Active</h6>
          <p className="mb-0 fs-7 text-dark opacity-85">
            Access to user private correspondence is restricted solely to system administrators. Every lookup
            is permanently recorded in the system audit log with your administrator ID, the target user accounts,
            timestamp, and your submitted reason.
          </p>
        </div>
      </div>

      {activeTab === 'lookup' && (
        <>
          {/* Lookup Input Form Card */}
          <div className="card shadow-sm border-0 mb-4 bg-white rounded-3">
            <div className="card-header bg-white border-bottom py-3">
              <h5 className="mb-0 fw-bold text-dark">
                <i className="bi bi-person-lines-fill me-2 text-primary"></i>Target Users Lookup
              </h5>
            </div>
            <div className="card-body p-4">
              <form onSubmit={handleLookup}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary fs-7">
                      Register Number A <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted">
                        <i className="bi bi-person"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 2024BCSE001"
                        value={registerNumberA}
                        onChange={(e) => {
                          setRegisterNumberA(e.target.value);
                          setLocalValidation('');
                          dispatch(clearOversightError());
                        }}
                        disabled={loading}
                        required
                      />
                    </div>
                    <small className="text-muted fs-8">First participant in conversation</small>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary fs-7">
                      Register Number B <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted">
                        <i className="bi bi-person"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 2024BCSE045"
                        value={registerNumberB}
                        onChange={(e) => {
                          setRegisterNumberB(e.target.value);
                          setLocalValidation('');
                          dispatch(clearOversightError());
                        }}
                        disabled={loading}
                        required
                      />
                    </div>
                    <small className="text-muted fs-8">Second participant in conversation</small>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary fs-7">
                      Moderation Reason / Incident Ticket
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light text-muted">
                        <i className="bi bi-file-earmark-text"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Report #1042 / Harassment complaint"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <small className="text-muted fs-8">Stored in oversight audit trail</small>
                  </div>
                </div>

                {(localValidation || error) && (
                  <div className="alert alert-danger mt-3 py-2 px-3 fs-7 mb-0 rounded-2" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    {localValidation || error}
                  </div>
                )}

                <div className="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
                  {(registerNumberA || registerNumberB || result) && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary px-4"
                      onClick={handleClear}
                      disabled={loading}
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary px-4 fw-semibold"
                    disabled={loading || !registerNumberA.trim() || !registerNumberB.trim()}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Retrieving &amp; Decrypting...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-search me-2"></i>
                        Look Up Conversation
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Results View */}
          {result && (
            <div className="card shadow-sm border-0 mb-4 bg-white rounded-3">
              {/* Context Header */}
              <div className="card-header bg-light border-bottom p-4">
                <div className="row align-items-center g-3">
                  <div className="col-lg-5">
                    <div className="p-3 bg-white rounded border shadow-sm h-100">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="badge bg-primary text-uppercase fs-8">User A</span>
                        <span className="badge bg-light text-dark border fs-8">{result.userA.role}</span>
                      </div>
                      <h5 className="fw-bold mb-1 text-dark">{result.userA.name}</h5>
                      <div className="text-muted fs-7">
                        <div><strong>Register No:</strong> {result.userA.registerNumber || 'N/A'}</div>
                        <div><strong>Dept:</strong> {result.userA.department || 'N/A'}</div>
                        <div><strong>Email:</strong> {result.userA.email}</div>
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-2 text-center">
                    <div className="py-2">
                      <div className="text-muted fs-8 text-uppercase fw-semibold mb-1">Connection Context</div>
                      {getConnectionBadge(result.connectionStatus)}
                      <div className="text-muted fs-8 mt-2">
                        {result.messages.length} message(s) retrieved
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-5">
                    <div className="p-3 bg-white rounded border shadow-sm h-100">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="badge bg-info text-uppercase fs-8">User B</span>
                        <span className="badge bg-light text-dark border fs-8">{result.userB.role}</span>
                      </div>
                      <h5 className="fw-bold mb-1 text-dark">{result.userB.name}</h5>
                      <div className="text-muted fs-7">
                        <div><strong>Register No:</strong> {result.userB.registerNumber || 'N/A'}</div>
                        <div><strong>Dept:</strong> {result.userB.department || 'N/A'}</div>
                        <div><strong>Email:</strong> {result.userB.email}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Read-Only Transcript View */}
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                  <div>
                    <h5 className="fw-bold text-dark mb-0">Decrypted Message History</h5>
                    <small className="text-muted">
                      Full historical transcript between {result.userA.name} ({result.userA.registerNumber}) and {result.userB.name} ({result.userB.registerNumber})
                    </small>
                  </div>
                  <span className="badge bg-secondary-subtle text-secondary border px-3 py-2 fs-7">
                    <i className="bi bi-eye me-1"></i>Read-Only Oversight Mode
                  </span>
                </div>

                {result.messages.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-chat-square-text display-4 opacity-50 d-block mb-3"></i>
                    <h6>No Messages Found</h6>
                    <p className="fs-7 mb-0">
                      No direct messages have been exchanged between these two users.
                    </p>
                  </div>
                ) : (
                  <div className="chat-transcript-container p-3 bg-light rounded-3" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {result.messages.map((msg, index) => {
                      const senderId = (msg.sender?._id || msg.sender?.id || msg.sender)?.toString();
                      const userAId = (result.userA?.id || result.userA?._id)?.toString();
                      const isUserA = (senderId && senderId === userAId) ||
                        (Boolean(msg.sender?.registerNumber) && msg.sender?.registerNumber === result.userA?.registerNumber);

                      const isCorrupted = msg.content === '[unable to decrypt]';

                      return (
                        <div
                          key={msg._id || index}
                          className={`d-flex mb-3 ${isUserA ? 'justify-content-start' : 'justify-content-end'}`}
                        >
                          <div
                            className={`card border-0 shadow-sm ${
                              isUserA
                                ? 'bg-white border-start border-4 border-primary'
                                : 'bg-primary-subtle border-start border-4 border-info'
                            }`}
                            style={{ maxWidth: '75%', minWidth: '280px' }}
                          >
                            <div className="card-body p-3">
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className={`fw-bold fs-7 ${isUserA ? 'text-primary' : 'text-info-emphasis'}`}>
                                  {msg.sender.name}
                                  <span className="fw-normal text-muted ms-1 fs-8">
                                    ({msg.sender.registerNumber || msg.sender.role})
                                  </span>
                                </span>
                                <small className="text-muted fs-8 ms-2">
                                  {formatTimestamp(msg.createdAt)}
                                </small>
                              </div>

                              <div className="mt-2 text-break">
                                {isCorrupted ? (
                                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle p-2 fs-7">
                                    <i className="bi bi-shield-x me-1"></i>[unable to decrypt payload]
                                  </span>
                                ) : (
                                  <p className="mb-0 fs-7 text-dark" style={{ whiteSpace: 'pre-wrap' }}>
                                    {msg.content}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Audit Logs Tab View */}
      {activeTab === 'logs' && (
        <div className="card shadow-sm border-0 bg-white rounded-3">
          <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0 fw-bold text-dark">
                <i className="bi bi-clock-history me-2 text-primary"></i>Past Oversight Inquiries
              </h5>
              <small className="text-muted">
                Transparent log of all administrative message oversight queries
              </small>
            </div>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => dispatch(fetchOversightLogs())}
              disabled={logsLoading}
            >
              {logsLoading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                <>
                  <i className="bi bi-arrow-clockwise me-1"></i>Refresh Logs
                </>
              )}
            </button>
          </div>

          <div className="card-body p-0">
            {logsLoading && (logs?.length || 0) === 0 ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading logs...</span>
                </div>
              </div>
            ) : logsError ? (
              <div className="p-4">
                <div className="alert alert-danger mb-0" role="alert">
                  {logsError}
                </div>
              </div>
            ) : (logs?.length || 0) === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-journal-x display-5 opacity-50 d-block mb-3"></i>
                <p className="mb-0">No message oversight lookups have been performed yet.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className="py-3 px-3 fs-7">Timestamp</th>
                      <th className="py-3 px-3 fs-7">Administrator</th>
                      <th className="py-3 px-3 fs-7">Target User A</th>
                      <th className="py-3 px-3 fs-7">Target User B</th>
                      <th className="py-3 px-3 fs-7">Messages Reviewed</th>
                      <th className="py-3 px-3 fs-7">Investigation Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id}>
                        <td className="px-3 fs-8 text-muted">
                          {formatTimestamp(log.timestamp || log.createdAt)}
                        </td>
                        <td className="px-3">
                          <strong className="fs-7 text-dark">{log.adminId?.name || 'Administrator'}</strong>
                          <div className="fs-8 text-muted">{log.adminId?.email}</div>
                        </td>
                        <td className="px-3">
                          <span className="fw-semibold fs-7">{log.targetUserA?.name || 'User'}</span>
                          <div className="fs-8 text-muted">
                            {log.targetUserA?.registerNumber || 'No Reg No'}
                          </div>
                        </td>
                        <td className="px-3">
                          <span className="fw-semibold fs-7">{log.targetUserB?.name || 'User'}</span>
                          <div className="fs-8 text-muted">
                            {log.targetUserB?.registerNumber || 'No Reg No'}
                          </div>
                        </td>
                        <td className="px-3">
                          <span className="badge bg-secondary-subtle text-secondary border fs-8">
                            {log.messageCount ?? 0} msgs
                          </span>
                        </td>
                        <td className="px-3 fs-7 text-dark">
                          {log.reason || 'Safety / Moderation Review'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageOversight;
