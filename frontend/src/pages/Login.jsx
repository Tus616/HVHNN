import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AUTH_USES_MOCK } from '../services/api';
import {
  buildActionCodeSettings,
  getEmailLinkSenderHint,
  getFirebaseConfigurationMessage,
  getStoredEmailForSignIn,
  isFirebaseConfigured,
} from '../services/firebase';

export default function Login() {
  const [mode, setMode] = useState('password');
  const [email, setEmail] = useState(() => getStoredEmailForSignIn());
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const { login, loginWithGoogle, sendLoginLink, isEmailLinkLogin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const firebaseConfigured = isFirebaseConfigured();
  const configurationMessage = getFirebaseConfigurationMessage();
  const verifyingLink = isEmailLinkLogin(window.location.href);
  const actionCodeSettings = buildActionCodeSettings();
  const senderHint = getEmailLinkSenderHint();
  const showAuthDebug = import.meta.env.DEV && import.meta.env.VITE_SHOW_AUTH_DEBUG === 'true';
  const currentOrigin = window.location.origin;
  const currentHostname = window.location.hostname;
  const runningOnLoopbackIp = currentHostname === '127.0.0.1';
  const localhostOrigin = runningOnLoopbackIp
    ? currentOrigin.replace('127.0.0.1', 'localhost')
    : currentOrigin;
  const localhostLoginUrl = `${localhostOrigin}${window.location.pathname}${window.location.search}${window.location.hash}`;
  const showLocalFirebaseWarning = firebaseConfigured && runningOnLoopbackIp;
  const showDevSeededAccounts = import.meta.env.DEV && mode === 'password' && !AUTH_USES_MOCK;

  useEffect(() => {
    if (location.state?.authError) {
      setError(location.state.authError);
    }
  }, [location.state]);

  const handlePasswordLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoadingAction('password');

    try {
      await login(email, password);
      // First-login redirect: go to profile setup if not completed yet
      const setupDone = localStorage.getItem('hvhn_profile_setup_complete');
      navigate(setupDone ? '/feed' : '/profile/edit');
    } catch (err) {
      setError(err.message || 'We could not sign you in with email and password.');
    } finally {
      setLoadingAction('');
    }
  };

  const handleEmailLinkLogin = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoadingAction('emailLink');

    try {
      if (!firebaseConfigured) {
        throw new Error('Magic Link is disabled in local development. Please use Email & Password or Google Sign In.');
      }
      const normalizedEmail = await sendLoginLink(email);
      setEmail(normalizedEmail);
      setSuccess(`Authentication link sent to ${normalizedEmail}. If you do not see it in Inbox within a minute, check Spam or Promotions and search for ${senderHint}.`);
    } catch (err) {
      setError(err.message || 'We could not send the authentication link.');
    } finally {
      setLoadingAction('');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    setLoadingAction('google');

    try {
      await loginWithGoogle();
      // First-login redirect: go to profile setup if not completed yet
      const setupDone = localStorage.getItem('hvhn_profile_setup_complete');
      navigate(setupDone ? '/feed' : '/profile/edit');
    } catch (err) {
      setError(err.message || 'We could not sign you in with Google.');
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div className="auth-page animate-in">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <h2>Sign In To HVHN</h2>
          <p className="auth-subtitle">Hyperlocal Verified Help Network — Responding together, locally.</p>
        </div>

        <div className="auth-mode-toggle">
          <button
            type="button"
            className={`auth-mode-btn ${mode === 'password' ? 'active' : ''}`}
            onClick={() => {
              setMode('password');
              setError('');
              setSuccess('');
            }}
          >
            Email & Password
          </button>
          <button
            type="button"
            className={`auth-mode-btn ${mode === 'emailLink' ? 'active' : ''}`}
            onClick={() => {
              setMode('emailLink');
              setError('');
              setSuccess('');
            }}
          >
            Magic Link
          </button>
        </div>

        {!firebaseConfigured && (
          <div className="alert alert-warning" style={{ margin: '16px 0', fontSize: '0.82rem', padding: '12px' }}>
            <strong>Firebase Setup Missing:</strong> {configurationMessage}
            <div style={{ marginTop: '8px', opacity: 0.8 }}>
              Check authorized domains: <code>{currentHostname}</code>
            </div>
          </div>
        )}

        {showLocalFirebaseWarning && (
          <div className="alert alert-warning" style={{ margin: '16px 0', fontSize: '0.82rem', padding: '12px' }}>
            <strong>Local Dev Tip:</strong> Use <code>localhost</code> instead of <code>127.0.0.1</code> for Firebase features.
            <a href={localhostLoginUrl} style={{ display: 'block', marginTop: '4px', textDecoration: 'underline' }}>Switch to localhost</a>
          </div>
        )}


        {success && (
          <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--success)', fontSize: '0.9rem', marginTop: '20px', marginBottom: '20px' }}>
            {success}
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.9rem', marginTop: '20px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={mode === 'password' ? handlePasswordLogin : handleEmailLinkLogin}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="your@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {mode === 'password' && (
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={Boolean(loadingAction) || verifyingLink || (mode !== 'password' && !firebaseConfigured)}
          >
            {loadingAction === 'password' && 'Signing in...'}
            {loadingAction === 'emailLink' && 'Sending link...'}
            {!loadingAction && mode === 'password' && 'Sign In'}
            {!loadingAction && mode === 'emailLink' && 'Send Authentication Link'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn btn-secondary auth-social-btn"
          onClick={handleGoogleLogin}
          disabled={Boolean(loadingAction) || verifyingLink || !firebaseConfigured}
        >
          {loadingAction === 'google' ? 'Connecting to Google...' : 'Continue with Google'}
        </button>

        {mode === 'emailLink' && (
          <p className="auth-footer" style={{ marginTop: '12px', fontSize: '0.8rem', textAlign: 'center' }}>
            A secure sign-in link will be sent to your email. Click it to log in instantly without a password.
          </p>
        )}

        <div className="auth-footer" style={{ marginTop: '24px' }}>
          Don&apos;t have an account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
