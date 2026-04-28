import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';

export default function Register() {
  const [step, setStep] = useState(1); // 1=form, 2=otp, 3=done
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    address: '',
    latitude: null,
    longitude: null,
  });
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const { register } = useAuth();
  const navigate = useNavigate();
  const showDebugOtp = import.meta.env.DEV
    && import.meta.env.VITE_SHOW_SIGNUP_OTP_DEBUG === 'true'
    && Boolean(sentOtp);

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleAddressChange = (address) => {
    setForm((current) => ({
      ...current,
      address,
      latitude: null,
      longitude: null,
    }));
  };

  const handleAddressSelect = (suggestion) => {
    setForm((current) => ({
      ...current,
      address: suggestion.displayName,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    }));
  };

  const startResendTimer = () => {
    setResendTimer(30);
    const interval = setInterval(() => {
      setResendTimer((previous) => {
        if (previous <= 1) {
          clearInterval(interval);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (event) => {
    event.preventDefault();

    if (!form.fullName || !form.email || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setInfo('');
    setLoading(true);

    try {
      const normalizedEmail = form.email.trim().toLowerCase();
      const response = await apiService.sendOtp(normalizedEmail);
      setForm((previous) => ({ ...previous, email: normalizedEmail }));
      setSentOtp(response.data.otp || '');
      setInfo(response.data.message || `We sent a 6-digit OTP to ${normalizedEmail}.`);
      setStep(2);
      startResendTimer();
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();

    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }

    setError('');
    setInfo('');
    setLoading(true);

    try {
      await apiService.verifyOtp(form.email, otp);
      await register(form);
      setStep(3);
      setTimeout(() => navigate('/feed'), 2000);
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;

    setError('');
    setInfo('');

    try {
      const response = await apiService.sendOtp(form.email);
      setSentOtp(response.data.otp || '');
      setInfo(response.data.message || `We sent a fresh OTP to ${form.email}.`);
      startResendTimer();
    } catch (err) {
      setError(err.message || 'Failed to resend OTP.');
    }
  };

  if (step === 3) {
    return (
      <div className="auth-page animate-in">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>OK</div>
          <h2 style={{ WebkitTextFillColor: 'var(--success)', background: 'none' }}>Account Verified!</h2>
          <p className="auth-subtitle">Your email has been verified and account is created.<br />Redirecting to Help Feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page animate-in">
      <div className="auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '20px' }}>

          {[1, 2].map((currentStep) => (
            <div key={currentStep} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                background: step >= currentStep ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.05)',
                color: step >= currentStep ? 'white' : 'var(--text-muted)',
                border: step >= currentStep ? 'none' : '1px solid var(--border)',
              }}>
                {step > currentStep ? 'Done' : currentStep}
              </div>
              <span style={{ fontSize: '0.8rem', color: step >= currentStep ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {currentStep === 1 ? 'Details' : 'Verify OTP'}
              </span>
              {currentStep < 2 && <div style={{ width: '40px', height: '2px', background: step > currentStep ? 'var(--accent-primary)' : 'var(--border)' }} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <>
            <h2>Join HVHN</h2>
            <p className="auth-subtitle">Create your account and start helping</p>

            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '20px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSendOtp}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  className="form-input"
                  placeholder="Your full name"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  name="password"
                  className="form-input"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  placeholder="+91-XXXXXXXXXX"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <LocationAutocompleteInput
                  name="address"
                  placeholder="Your locality"
                  value={form.address}
                  onValueChange={handleAddressChange}
                  onSuggestionSelect={handleAddressSelect}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send OTP & Continue ->'}
              </button>
            </form>

            <div className="auth-footer">
              Already have an account? <Link to="/login">Sign in</Link>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Verify Your Email</h2>
            <p className="auth-subtitle">
              We sent a 6-digit OTP to <strong style={{ color: 'var(--accent-primary)' }}>{form.email}</strong>
            </p>

            {info && (
              <div style={{ padding: '12px 16px', background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--accent-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                {info}
              </div>
            )}

            {error && (
              <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '20px' }}>
                {error}
              </div>
            )}

            {showDebugOtp && (
              <div className="alert alert-success" style={{ padding: '12px', marginBottom: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '4px' }}>Dev OTP Code:</p>
                <code style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '4px' }}>{sentOtp}</code>
              </div>
            )}


            <form onSubmit={handleVerifyOtp}>
              <div className="form-group">
                <label className="form-label">Enter 6-Digit OTP</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="* * * * * *"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  maxLength={6}
                  autoFocus
                  style={{ textAlign: 'center', fontSize: '1.8rem', letterSpacing: '12px', fontWeight: 800, fontFamily: 'monospace' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading || otp.length !== 6}>
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </button>
            </form>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { setStep(1); setOtp(''); setError(''); setInfo(''); }}>
                {'<- Back'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleResendOtp} disabled={resendTimer > 0}>
                {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
