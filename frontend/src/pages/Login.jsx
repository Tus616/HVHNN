import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';
import AuthHeader from '../components/AuthHeader';
import {
  getEmailLinkSenderHint,
  getFirebaseConfigurationMessage,
  getStoredEmailForSignIn,
  isFirebaseConfigured,
} from '../services/firebase';

function GoogleIcon() {
  return (
    <svg className="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.4c-.2 1.3-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.5Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.7 19.8 8.1 22 12 22Z" />
      <path fill="#FBBC05" d="M6.4 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.5H3.1C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.5l3.3-2.6Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9C17 3 14.7 2 12 2 8.1 2 4.7 4.2 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6Z" />
    </svg>
  );
}

export default function Login() {
  const [mode, setMode] = useState('password');
  const [email, setEmail] = useState(() => getStoredEmailForSignIn());
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingAction, setLoadingAction] = useState('');
  const { login, loginWithGoogle, sendLoginLink, isEmailLinkLogin, routeAfterAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const firebaseConfigured = isFirebaseConfigured();
  const configurationMessage = getFirebaseConfigurationMessage();
  const verifyingLink = isEmailLinkLogin(window.location.href);
  const senderHint = getEmailLinkSenderHint();
  const currentOrigin = window.location.origin;
  const currentHostname = window.location.hostname;
  const runningOnLoopbackIp = currentHostname === '127.0.0.1';
  const localhostOrigin = runningOnLoopbackIp
    ? currentOrigin.replace('127.0.0.1', 'localhost')
    : currentOrigin;
  const localhostLoginUrl = `${localhostOrigin}${window.location.pathname}${window.location.search}${window.location.hash}`;
  const showLocalFirebaseWarning = firebaseConfigured && runningOnLoopbackIp;

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
      const userData = await login(email, password);
      navigate(routeAfterAuth(userData), { replace: true });
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
      const userData = await loginWithGoogle();
      navigate(routeAfterAuth(userData), { replace: true });
    } catch (err) {
      setError(err.message || 'We could not sign you in with Google.');
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div className="auth-page animate-in">
      <AuthHeader mode="login" />
      <main className="auth-main">
        <div className="auth-card auth-card-wide">
          <div className="auth-header">
            <BrandLogo variant="mark" />
            <h2>Welcome Back!</h2>
            <p className="auth-subtitle">Let&apos;s help each other</p>
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
            {loadingAction === 'google' ? 'Connecting to Google...' : <><GoogleIcon /> Continue with Google</>}
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
      </main>
    </div>
  );
}
