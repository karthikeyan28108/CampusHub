import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api.js';

const Register = () => {
  const navigate = useNavigate();

  // Registration step: 'details' | 'otp' | 'password' | 'success'
  const [step, setStep] = useState('details');

  // Form Fields (Only Username, Email, and Password as requested)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // OTP Countdown (5 minutes) and Resend Cooldown (60 seconds)
  const [countdown, setCountdown] = useState(300);
  const [cooldown, setCooldown] = useState(0);
  const countdownIntervalRef = useRef(null);
  const cooldownIntervalRef = useRef(null);

  // Auto-redirect timer for final success screen
  const [redirectTime, setRedirectTime] = useState(3);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearInterval(countdownIntervalRef.current);
      clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  // Countdown timer for OTP expiration (5 mins)
  const startCountdown = () => {
    setCountdown(300);
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setError('Verification code expired. Please click "Resend OTP".');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Cooldown timer for resending OTP (60s)
  const startCooldown = () => {
    setCooldown(60);
    clearInterval(cooldownIntervalRef.current);
    cooldownIntervalRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // STEP 1: Send OTP to user's email
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!name.trim()) {
      setError('Please enter your username / full name.');
      return;
    }

    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email format (e.g., student@college.edu).');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register-send-otp', {
        name: name.trim(),
        email: email.trim()
      });
      setSuccessMsg(response.data.message || 'Verification OTP sent to your email!');
      setStep('otp');
      startCountdown();
      startCooldown();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send OTP. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const response = await api.post('/auth/register-send-otp', {
        name: name.trim(),
        email: email.trim()
      });
      setSuccessMsg(response.data.message || 'A new verification code has been sent!');
      startCountdown();
      startCooldown();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resend OTP.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify the received OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!otp || otp.trim().length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/register-verify-otp', {
        email: email.trim(),
        otp: otp.trim()
      });
      clearInterval(countdownIntervalRef.current);
      clearInterval(cooldownIntervalRef.current);
      setSuccessMsg(response.data.message || 'Email verified successfully!');
      setStep('password');
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid or expired OTP. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Enter password and finalize registration
  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password: password
      });

      setStep('success');

      // Countdown to redirect to login page
      let count = 3;
      const timer = setInterval(() => {
        count -= 1;
        setRedirectTime(count);
        if (count <= 0) {
          clearInterval(timer);
          navigate('/login');
        }
      }, 1000);
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5 mb-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card shadow-lg border-0 rounded-4">
            <div className="card-body p-4 p-md-5">
              
              {/* Header */}
              <div className="text-center mb-4">
                <h2 className="fw-bold text-primary">CampusHub</h2>
                <p className="text-muted small">
                  {step === 'details' && 'Create your account with Username & Email'}
                  {step === 'otp' && 'Verify your Email with OTP'}
                  {step === 'password' && 'Set a Password for your account'}
                  {step === 'success' && 'Account Created Successfully!'}
                </p>
              </div>

              {/* Status Alerts */}
              {error && (
                <div className="alert alert-danger alert-dismissible fade show shadow-sm" role="alert">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-exclamation-circle-fill me-2 fs-5"></i>
                    <div>{error}</div>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setError('')}></button>
                </div>
              )}

              {successMsg && step !== 'success' && (
                <div className="alert alert-success alert-dismissible fade show shadow-sm" role="alert">
                  <div className="d-flex align-items-center">
                    <i className="bi bi-check-circle-fill me-2 fs-5"></i>
                    <div>{successMsg}</div>
                  </div>
                  <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
                </div>
              )}

              {/* STEP 1: Username & Email */}
              {step === 'details' && (
                <form onSubmit={handleSendOtp}>
                  <div className="mb-3">
                    <label htmlFor="regName" className="form-label fw-semibold">
                      Username / Full Name <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light"><i className="bi bi-person"></i></span>
                      <input
                        type="text"
                        className="form-control"
                        id="regName"
                        placeholder="Enter your username"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="regEmail" className="form-label fw-semibold">
                      Valid Email Address <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light"><i className="bi bi-envelope"></i></span>
                      <input
                        type="email"
                        className="form-control"
                        id="regEmail"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>
                    <div className="form-text text-muted">
                      A 6-digit OTP code will be sent to this email to verify uniqueness.
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100 py-2 fs-5 fw-semibold mb-3 shadow-sm"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Sending OTP...
                      </>
                    ) : (
                      <>Send OTP <i className="bi bi-arrow-right ms-1"></i></>
                    )}
                  </button>

                  <div className="text-center mt-3">
                    <span className="text-muted">Already have an account? </span>
                    <Link to="/login" className="text-primary fw-semibold text-decoration-none">
                      Sign In
                    </Link>
                  </div>
                </form>
              )}

              {/* STEP 2: OTP Verification */}
              {step === 'otp' && (
                <form onSubmit={handleVerifyOtp}>
                  <div className="p-3 bg-light rounded-3 mb-3 border">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <div className="small text-muted">Sending verification code to:</div>
                        <div className="fw-bold text-dark">{email}</div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setStep('details');
                          setError('');
                        }}
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="otpInput" className="form-label fw-semibold">
                      Enter 6-Digit OTP <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-lg text-center fw-bold letter-spacing-lg"
                      id="otpInput"
                      placeholder="000000"
                      maxLength="6"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      required
                      autoFocus
                      disabled={loading}
                      style={{ letterSpacing: '0.4rem', fontSize: '1.5rem' }}
                    />
                    <div className="d-flex justify-content-between mt-2">
                      <span className="small text-muted">
                        Expires in: <strong className={countdown < 60 ? 'text-danger' : 'text-primary'}>{formatTime(countdown)}</strong>
                      </span>
                      {cooldown > 0 ? (
                        <span className="small text-muted">Resend in {cooldown}s</span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-link p-0 small text-decoration-none"
                          onClick={handleResendOtp}
                          disabled={loading}
                        >
                          Resend OTP
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100 py-2 fs-5 fw-semibold mb-3 shadow-sm"
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Verifying OTP...
                      </>
                    ) : (
                      'Verify OTP'
                    )}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      className="btn btn-link text-muted small text-decoration-none"
                      onClick={() => setStep('details')}
                    >
                      &larr; Back to edit email
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Password Creation */}
              {step === 'password' && (
                <form onSubmit={handleCompleteRegistration}>
                  <div className="alert alert-info py-2 px-3 small mb-3 d-flex align-items-center">
                    <i className="bi bi-shield-check text-info fs-5 me-2"></i>
                    <div>Email <strong>{email}</strong> verified! Set your password below.</div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="regPassword" className="form-label fw-semibold">
                      Password <span className="text-danger">*</span>
                    </label>
                    <div className="input-group">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control"
                        id="regPassword"
                        placeholder="Minimum 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="regConfirmPassword" className="form-label fw-semibold">
                      Confirm Password <span className="text-danger">*</span>
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control"
                      id="regConfirmPassword"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                    {confirmPassword && password !== confirmPassword && (
                      <div className="text-danger small mt-1">Passwords do not match</div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-success w-100 py-2 fs-5 fw-semibold mb-3 shadow-sm"
                    disabled={loading || !password || password !== confirmPassword}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Creating Account...
                      </>
                    ) : (
                      'Finish Registration'
                    )}
                  </button>
                </form>
              )}

              {/* STEP 4: Success Notification */}
              {step === 'success' && (
                <div className="text-center py-3">
                  <div className="mb-3">
                    <i className="bi bi-check-circle-fill text-success" style={{ fontSize: '3.5rem' }}></i>
                  </div>
                  <h4 className="fw-bold text-success mb-2">Registration Complete!</h4>
                  <p className="text-muted mb-4">
                    Your account has been created. You can now log in using <strong>{email}</strong> and your password.
                  </p>
                  <div className="p-3 bg-light rounded-3 mb-4 small text-muted">
                    Redirecting to login page in <strong>{redirectTime}s</strong>...
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary w-100 py-2 fs-5 fw-semibold"
                    onClick={() => navigate('/login')}
                  >
                    Go to Sign In
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
