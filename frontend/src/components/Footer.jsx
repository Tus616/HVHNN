import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <span className="logo-icon">⚡</span>
            <span>Sahay</span>
          </Link>
          <p className="footer-tagline">
            Help Where It Matters — connecting communities for faster, trusted help.
          </p>
        </div>

        <div className="footer-links-group">
          <h4>Platform</h4>
          <Link to="/feed">Help Feed</Link>
          <Link to="/communities">Communities</Link>
          <Link to="/leaderboard">Leaderboard</Link>
          <Link to="/create">Raise Request</Link>
        </div>

        <div className="footer-links-group">
          <h4>Volunteer</h4>
          <Link to="/volunteer/settings">Settings</Link>
          <Link to="/volunteer/dashboard">Dashboard</Link>
        </div>

        <div className="footer-links-group">
          <h4>Account</h4>
          <Link to="/profile">My Profile</Link>
          <Link to="/login">Sign In</Link>
          <Link to="/register">Get Started</Link>
        </div>
      </div>

      <div className="footer-bottom">
        <span>(c) {year} Sahay. Built with ❤️ for communities.</span>
        <div className="footer-bottom-links">
          <span>Privacy</span>
          <span>Terms</span>
          <span>Support</span>
        </div>
      </div>
    </footer>
  );
}
