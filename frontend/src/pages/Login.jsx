import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { authStart, authSuccess, authFailure, clearError } from '../redux/slices/authSlice.js';
import api from '../services/api.js';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validated, setValidated] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    // Clear errors on load
    dispatch(clearError());
    // Redirect if already logged in
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate, dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidated(true);

    if (!email || !password) {
      return;
    }

    dispatch(authStart());
    try {
      const response = await api.post('/auth/login', { email, password });
      dispatch(authSuccess({
        user: response.data.user,
        token: response.data.token
      }));
      if (response.data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      dispatch(authFailure(errMsg));
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card shadow-lg border-0 rounded-3 mt-4">
            <div className="card-body p-5">
              <div className="text-center mb-4">
                <h2 className="fw-bold text-primary">CampusHub</h2>
                <p className="text-muted">Sign in to your account</p>
              </div>

              {error && (
                <div className="alert alert-danger alert-dismissible fade show" role="alert">
                  {error}
                  <button type="button" className="btn-close" onClick={() => dispatch(clearError())}></button>
                </div>
              )}

              <form onSubmit={handleSubmit} className={validated ? 'was-validated' : ''} noValidate>
                <div className="mb-3">
                  <label htmlFor="emailInput" className="form-label">Email or Username</label>
                  <input
                    type="text"
                    className="form-control"
                    id="emailInput"
                    placeholder="Enter your email or username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <div className="invalid-feedback">Please enter your email or username.</div>
                </div>

                <div className="mb-4">
                  <label htmlFor="passwordInput" className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    id="passwordInput"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <div className="invalid-feedback">Please enter your password.</div>
                  <div className="text-end mt-2">
                    <Link to="/forgot-password" className="text-decoration-none text-primary fw-semibold small">
                      Forgot Password?
                    </Link>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2 fs-5 mb-3"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  ) : null}
                  Sign In
                </button>
              </form>

              <div className="text-center mt-3">
                <p className="text-muted mb-0">
                  Don't have an account? <Link to="/register" className="text-primary fw-semibold">Register here</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
