import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import BrandLogo from './BrandLogo';

function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  return (
    <button
      className="landing-theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Sun size={17} aria-hidden="true" />
      <span className="landing-theme-toggle__thumb">
        {isDark ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
      </span>
      <Moon size={17} aria-hidden="true" />
    </button>
  );
}

export default function AuthHeader({ mode }) {
  const isLogin = mode === 'login';
  return (
    <header className="auth-nav">
      <Link to="/" className="auth-nav__brand" aria-label="Sahay home">
        <BrandLogo />
      </Link>
      <div className="auth-nav__actions">
        <ThemeToggle />
        <Link className={`landing-btn ${isLogin ? 'landing-btn--orange' : 'landing-btn--ghost'}`} to={isLogin ? '/register' : '/login'}>
          {isLogin ? 'Sign Up' : 'Log In'}
        </Link>
        <Link className="landing-btn landing-btn--blue-outline" to="/">
          Back to Home
        </Link>
      </div>
    </header>
  );
}
