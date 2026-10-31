import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api.js';

const ForgotPassword = () => {
  const navigate = useNavigate();

  // Step states: 'email' | 'otp' | 'reset' | 'success'
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // OTP Countdown & Cooldown states
  const [countdown, setCountdown] = useState(300); // 5 minutes OTP validity (300s)
  const [cooldown, setCooldown] = useState(0);    // Resend cooldown (60s)
  const countdownIntervalRef = useRef(null);
  const cooldownIntervalRef = useRef(null);

  // Auto-redirect timer for success step
  const [redirectTime, setRedirectTime] = useState(5);

  // Clears timer refs on unmount
  useEffect(() => {
    return () => {
      clearInterval(countdownIntervalRef.current);
      clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  // Countdown timer for OTP expiration (5 minutes)
  const startCountdown = () => {
    setCountdown(300);
    clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          setError('This code has expired. Please request a new one.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Cooldown timer for resending OTP (60 seconds)
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

  // Format time (seconds) to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Step 1: Send OTP handler
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter a valid email address.');
      return;
    }

    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccessMsg(response.data.message);
      setStep('otp');
      startCountdown();
      startCooldown();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP handler
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }
    if (countdown === 0) {
      setError('This code has expired. Please request a new one.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/verify-otp', { email, otp });
      setStep('reset');
      clearInterval(countdownIntervalRef.current); // Stop OTP countdown
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect code.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (cooldown > 0) return;
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccessMsg(response.data.message);
      startCountdown();
      startCooldown();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Live password strength calculations
  const rules = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
  };

  const isPasswordValid = Object.values(rules).every(Boolean);

  // Step 3: Reset Password handler
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('Password does not meet the complexity requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/reset-password', { email, otp, newPassword });
      setSuccessMsg(response.data.message);
      setStep('success');

      // Start auto-redirect countdown
      let count = 5;
      const redirectInterval = setInterval(() => {
        count--;
        setRedirectTime(count);
        if (count === 0) {
          clearInterval(redirectInterval);
          navigate('/login');
        }
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
          <div className="card shadow-lg border-0 rounded-3 mt-4">
            <div className="card-body p-5">
              
              {/* Header Title */}
              <div className="text-center mb-4">
                <h2 className="fw-bold text-primary">Reset Password</h2>
                <p className="text-muted">CampusHub Account Recovery</p>
              </div>

              {/* Status Alerts */}
              {error && (
                <div className="alert alert-danger alert-dismissible fade show shadow-sm" role="alert">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {error}
                </div>
              )}
              {successMsg && step !== 'success' && (
                <div className="alert alert-success alert-dismissible fade show shadow-sm" role="alert">
                  <i className="bi bi-check-circle-fill me-2"></i>
                  {successMsg}
                </div>
              )}

              {/* STEP 1: Email Input */}
              {step === 'email' && (
                <form onSubmit={handleSendOtp}>
                  <div className="mb-4">
                    <label htmlFor="emailAddress" className="form-label">Email Address</label>
                    <input
                      type="email"
                      id="emailAddress"
                      className="form-control"
                      placeholder="Enter your registered email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <div className="form-text text-muted">An OTP verification code will be sent to this email.</div>
                  </div>
                  <button type="submit" className="btn btn-primary w-100 py-2 fs-5 mb-3" disabled={loading}>
                    {loading ? <span className="spinner-border spinner-border-sm me-2" role="status" /> : null}
                    Send OTP
                  </button>
                  <div className="text-center mt-3">
                    <Link to="/login" className="text-decoration-none text-muted small fw-semibold">
                      Back to Sign In
                    </Link>
                  </div>
                </form>
              )}

              {/* STEP 2: OTP Verification */}
              {step === 'otp' && (
                <form onSubmit={handleVerifyOtp}>
                  <div className="mb-4 text-center">
                    <label htmlFor="otpCode" className="form-label d-block text-start">One-Time Password (OTP)</label>
                    <input
                      type="text"
                      id="otpCode"
                      className="form-control text-center fs-4 fw-bold letter-spacing-5"
                      placeholder="------"
                      maxLength="6"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                    />
                    
                    {/* Expiry Countdown Timer */}
                    <div className="mt-3 text-start small">
                      {countdown > 0 ? (
                        <span className="text-warning fw-semibold">
                          <i className="bi bi-clock me-1"></i> Code expires in {formatTime(countdown)}
                        </span>
                      ) : (
                        <span className="text-danger fw-semibold">
                          <i className="bi bi-clock-fill me-1"></i> Code has expired.
                        </span>
                      )}
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary w-100 py-2 fs-5 mb-3" disabled={loading || countdown === 0}>
                    {loading ? <span className="spinner-border spinner-border-sm me-2" role="status" /> : null}
                    Verify OTP
                  </button>

                  {/* Resend Cooldown Button */}
                  <button
                    type="button"
                    className="btn btn-outline-secondary w-100 py-2 fs-6 mb-3"
                    onClick={handleResendOtp}
                    disabled={loading || cooldown > 0}
                  >
                    {cooldown > 0 ? `Resend OTP (Wait ${cooldown}s)` : 'Resend OTP'}
                  </button>

                  <div className="text-center mt-3">
                    <button type="button" onClick={() => setStep('email')} className="btn btn-link text-decoration-none text-muted small fw-semibold">
                      Change Email Address
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: Reset Password fields */}
              {step === 'reset' && (
                <form onSubmit={handleResetPassword}>
                  <div className="mb-3">
                    <label htmlFor="newPass" className="form-label">New Password</label>
                    <input
                      type="password"
                      id="newPass"
                      className="form-control"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="confirmPass" className="form-label">Confirm Password</label>
                    <input
                      type="password"
                      id="confirmPass"
                      className="form-control"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  {/* Password Strength Checklist */}
                  <div className="p-3 mb-4 rounded bg-light border">
                    <div className="fw-semibold text-muted small mb-2">Password Requirements:</div>
                    <ul className="list-unstyled mb-0 small">
                      <li className={rules.length ? 'text-success' : 'text-danger'}>
                        <i className={`bi ${rules.length ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-2`} />
                        At least 8 characters
                      </li>
                      <li className={rules.uppercase ? 'text-success' : 'text-danger'}>
                        <i className={`bi ${rules.uppercase ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-2`} />
                        At least 1 uppercase letter (A-Z)
                      </li>
                      <li className={rules.lowercase ? 'text-success' : 'text-danger'}>
                        <i className={`bi ${rules.lowercase ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-2`} />
                        At least 1 lowercase letter (a-z)
                      </li>
                      <li className={rules.number ? 'text-success' : 'text-danger'}>
                        <i className={`bi ${rules.number ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-2`} />
                        At least 1 number (0-9)
                      </li>
                      <li className={rules.special ? 'text-success' : 'text-danger'}>
                        <i className={`bi ${rules.special ? 'bi-check-circle-fill' : 'bi-x-circle-fill'} me-2`} />
                        At least 1 special character (!@#$%^&*)
                      </li>
                    </ul>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-100 py-2 fs-5 mb-3"
                    disabled={loading || !isPasswordValid || newPassword !== confirmPassword}
                  >
                    {loading ? <span className="spinner-border spinner-border-sm me-2" role="status" /> : null}
                    Reset Password
                  </button>
                </form>
              )}

              {/* STEP 4: Success Message */}
              {step === 'success' && (
                <div className="text-center">
                  <div className="mb-4">
                    <i className="bi bi-patch-check-fill text-success fs-1"></i>
                  </div>
                  <h4 className="fw-bold text-success mb-3">Password Updated!</h4>
                  <p className="text-muted mb-4">{successMsg}</p>
                  
                  <div className="p-3 bg-light rounded mb-4">
                    <span className="small text-muted fw-semibold">
                      Redirecting to login page in {redirectTime}s...
                    </span>
                  </div>

                  <button onClick={() => navigate('/login')} className="btn btn-primary w-100 py-2 fs-5">
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

export default ForgotPassword;
