// FEATURE: Public Landing Page - IMPLEMENTED
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const STATS = [
  { value: '10,000+', label: 'Requests Fulfilled' },
  { value: '5,000+', label: 'Verified Volunteers' },
  { value: '250+', label: 'Communities' },
  { value: '< 15 min', label: 'Avg Response Time' },
];

const CATEGORIES = [
  { icon: '🩸', name: 'Blood Donation', desc: 'Emergency blood requirements matched with nearby verified donors' },
  { icon: '🏥', name: 'Medical Aid', desc: 'Medicine delivery, hospital transport, and medical equipment sharing' },
  { icon: '🍲', name: 'Food Support', desc: 'Meal delivery for elderly, patients, and those in need' },
  { icon: '🚗', name: 'Transport', desc: 'Emergency rides to hospitals, airports, and essential services' },
  { icon: '🚨', name: 'Emergency', desc: 'Critical SOS alerts broadcast to all nearby volunteers instantly' },
  { icon: '📋', name: 'General Help', desc: 'Everyday assistance — groceries, documents, errands, and more' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Raise a Request', desc: 'Describe what you need, set urgency, and our AI auto-classifies it.', icon: '📝' },
  { step: '02', title: 'AI Matches Volunteers', desc: 'Smart routing notifies the closest verified volunteers in tiers.', icon: '🤖' },
  { step: '03', title: 'Real-time Coordination', desc: 'Track volunteer status, chat in real-time, and coordinate seamlessly.', icon: '📡' },
  { step: '04', title: 'Help Delivered', desc: 'Rate your volunteer, earn trust points, and build community karma.', icon: '🎉' },
];

const WHY_HVHN = [
  { title: '🔐 Verified Network', desc: 'Every volunteer is verified through community codes and email domains. No strangers.' },
  { title: '⚡ AI-Powered Matching', desc: 'Smart classification and tiered notification ensures the right help reaches you first.' },
  { title: '🏘️ Community-Centric', desc: 'Join your college, society, or organization. Help stays hyperlocal and trusted.' },
  { title: '🏆 Gamified Impact', desc: 'Earn points, unlock badges, climb leaderboards — doing good feels rewarding.' },
];

const TOP_VOLUNTEERS = [
  { name: 'Priya Patel', points: 2450, badge: 'Hero', helped: 89, avatar: 'P' },
  { name: 'Amit Kumar', points: 1820, badge: 'Champion', helped: 62, avatar: 'A' },
  { name: 'Sneha Gupta', points: 1540, badge: 'Champion', helped: 48, avatar: 'S' },
];

export default function Landing() {
  const { user } = useAuth();

  // If logged in, redirect or show minimal version
  if (user) {
    return (
      <div className="animate-in">
        <div className="hero landing-hero-bg">
          <div className="network-dots" />
          <h1>Welcome back, {user.fullName?.split(' ')[0]}! 👋</h1>
          <p className="hero-subtitle">
            Your community needs you. Check the latest help requests or manage your volunteer settings.
          </p>
          <div className="hero-actions">
            <Link to="/feed" className="btn btn-primary btn-lg">🆘 View Help Feed</Link>
            <Link to="/volunteer/dashboard" className="btn btn-secondary btn-lg">📊 Volunteer Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Hero */}
      <div className="hero landing-hero-bg" style={{ paddingBottom: '40px' }}>
        <div className="network-dots" />
        <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🤝</div>
        <h1 style={{ fontSize: '3.8rem', lineHeight: '1.05', maxWidth: '800px', margin: '0 auto 20px' }}>
          Help Your Neighbors.<br />Build Trust.<br />Save Lives.
        </h1>
        <p className="hero-subtitle" style={{ maxWidth: '650px' }}>
          HVHN connects verified community members for hyperlocal help — from blood donation to emergency transport — powered by AI matching and real-time tracking.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn btn-primary btn-lg" style={{ padding: '16px 36px', fontSize: '1.1rem' }}>
            Get Started — It's Free
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg" style={{ padding: '16px 36px', fontSize: '1.1rem' }}>
            Sign In
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="landing-stats-bar">
        {STATS.map(s => (
          <div key={s.label} className="landing-stat">
            <div className="landing-stat-value">{s.value}</div>
            <div className="landing-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <div style={{ textAlign: 'center', padding: '60px 20px 20px' }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '12px' }}>How It Works</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto' }}>
          From request to resolution in four simple steps
        </p>
      </div>
      <div className="feature-grid" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
        {HOW_IT_WORKS.map(step => (
          <div key={step.step} className="feature-card" style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ fontSize: '2.5rem' }}>{step.icon}</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: 'rgba(99,102,241,0.15)' }}>{step.step}</div>
            </div>
            <h3 style={{ marginBottom: '8px' }}>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Categories */}
      <div style={{ textAlign: 'center', padding: '60px 20px 20px' }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '12px' }}>Help Categories</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto' }}>
          Whatever you need, there's a verified volunteer ready to help
        </p>
      </div>
      <div className="landing-categories" style={{ paddingBottom: '40px' }}>
        {CATEGORIES.map(cat => (
          <div key={cat.name} className="landing-category-card">
            <div className="landing-category-icon">{cat.icon}</div>
            <h4>{cat.name}</h4>
            <p>{cat.desc}</p>
          </div>
        ))}
      </div>

      {/* Why HVHN */}
      <div style={{ textAlign: 'center', padding: '60px 20px 20px' }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '12px' }}>Why HVHN?</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto' }}>
          A trusted, gamified, AI-powered community help network
        </p>
      </div>
      <div className="why-hvhn-grid" style={{ padding: '20px', paddingBottom: '40px' }}>
        {WHY_HVHN.map(item => (
          <div key={item.title} className="why-hvhn-card">
            <h4>{item.title}</h4>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Top Volunteers */}
      <div style={{ textAlign: 'center', padding: '60px 20px 20px' }}>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '12px' }}>Top Volunteers</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto' }}>
          Real people making real impact in their communities
        </p>
      </div>
      <div className="top-volunteers-grid" style={{ padding: '20px', paddingBottom: '60px' }}>
        {TOP_VOLUNTEERS.map((v, i) => (
          <div key={v.name} className="top-volunteer-card">
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '12px' }}>
              <div className="profile-avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem', margin: '0 auto', background: i === 0 ? 'linear-gradient(135deg, #f59e0b, #ef4444)' : i === 1 ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                {v.avatar}
              </div>
              {i === 0 && <div style={{ position: 'absolute', top: '-8px', right: '-8px', fontSize: '1.3rem' }}>👑</div>}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '4px' }}>{v.name}</div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '8px' }}>
              <span className="badge badge-category">{v.badge}</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {v.helped} people helped • {v.points} pts
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', padding: '60px 20px 80px', background: 'rgba(99,102,241,0.03)', borderTop: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '16px', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Ready to Make a Difference?
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto 32px' }}>
          Join thousands of verified community members who are building a safer, more connected neighborhood.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn btn-primary btn-lg" style={{ padding: '16px 44px', fontSize: '1.1rem' }}>
            Join HVHN Now
          </Link>
        </div>
      </div>
    </div>
  );
}
