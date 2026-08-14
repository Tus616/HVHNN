import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
  HelpCircle,
  LockKeyhole,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  Network,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import BrandLogo from '../components/BrandLogo';

const HERO_IMAGE = '/assets/sahay-landing-hero.png';

const NAV_ITEMS = [
  { label: 'Home', href: '#hero' },
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Communities', href: '#communities' },
  { label: 'Safety', href: '#safety' },
  { label: 'About Us', href: '#about' },
];

const HERO_STATS = [
  { label: 'Active Help Network', value: 'Live', accent: 'orange' },
  { label: 'Verified Community', value: 'Trusted', accent: 'blue' },
  { label: 'Local Coordination', value: 'Nearby', accent: 'blue' },
  { label: 'Always Accessible', value: '24/7', accent: 'orange' },
];

const IMPACT_STATS = [
  { label: 'Verified Members', value: 'Growing', icon: ShieldCheck, accent: 'orange' },
  { label: 'Active Communities', value: 'Expanding', icon: Users, accent: 'blue' },
  { label: 'Real Impact', value: 'Measurable', icon: HeartHandshake, accent: 'orange' },
  { label: 'Help Available', value: 'Always', icon: BellRing, accent: 'blue' },
];

const HOW_STEPS = [
  { title: 'Raise a Request', text: 'Share your need with your local community in seconds.', icon: HelpCircle },
  { title: 'Get Matched', text: 'Verified helpers near you get notified.', icon: Target },
  { title: 'Coordinate & Resolve', text: 'Communicate, collaborate, and get the help you need.', icon: MessageSquare },
  { title: 'Stay Safe', text: 'Every interaction is verified and community-driven.', icon: ShieldCheck },
];

const INTELLIGENCE_STEPS = [
  {
    step: 'STEP 1',
    title: 'Request Context',
    icon: Search,
    items: ['need', 'location', 'urgency', 'category'],
    accent: 'orange',
  },
  {
    step: 'STEP 2',
    title: 'Smart Matching',
    icon: Network,
    items: ['category', 'urgency', 'proximity', 'volunteer categories', 'availability', 'historical reliability'],
    accent: 'blue',
  },
  {
    step: 'STEP 3',
    title: 'Priority & Trust',
    icon: Sparkles,
    items: ['urgency', 'relevance', 'reliability', 'verification', 'proximity'],
    accent: 'blue',
  },
  {
    step: 'STEP 4',
    title: 'Coordinate & Resolve',
    icon: CheckCircle2,
    items: ['messaging', 'updates', 'collaboration', 'completion'],
    accent: 'orange',
  },
];

const COMMUNITY_FEATURES = [
  { title: 'Join trusted local groups', icon: Users, accent: 'blue' },
  { title: 'Community Q&A', icon: HelpCircle, accent: 'orange' },
  { title: 'Campaigns & announcements', icon: Radio, accent: 'blue' },
  { title: 'Members & collaboration', icon: HeartHandshake, accent: 'orange' },
];

const COMMUNITY_PREVIEW = [
  { name: 'Campus Help Circles', meta: 'Student-led emergency coordination' },
  { name: 'Apartment Support Groups', meta: 'Residents helping nearby residents' },
  { name: 'Health & Care Networks', meta: 'Verified local medical support' },
];

const SAFETY_ITEMS = [
  { title: 'Verified profiles', icon: ShieldCheck },
  { title: 'Privacy-aware locations', icon: MapPin },
  { title: 'Lifecycle tracking', icon: CheckCircle2 },
  { title: 'Community moderation', icon: LockKeyhole },
];

function Logo() {
  return <BrandLogo />;
}

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

function LandingLink({ authenticatedTo, guestTo, children, className }) {
  const { user } = useAuth();
  return (
    <Link
      to={user ? authenticatedTo : guestTo}
      state={user ? undefined : { intendedAction: authenticatedTo, from: authenticatedTo }}
      className={className}
    >
      {children}
    </Link>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [heroMissing, setHeroMissing] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="landing-page animate-in">
      <header className="landing-nav">
        <Link to={user ? '/feed' : '/'} className="landing-nav__brand" onClick={closeMobile}>
          <Logo />
        </Link>

        <nav className={`landing-nav__links ${mobileOpen ? 'is-open' : ''}`} aria-label="Landing navigation">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMobile}>{item.label}</a>
          ))}
        </nav>

        <div className="landing-nav__actions">
          <ThemeToggle />
          <Link className="landing-btn landing-btn--ghost" to="/login">Log In</Link>
          <Link className="landing-btn landing-btn--orange" to="/register">Sign Up</Link>
          <button
            className="landing-menu-btn"
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <main className="landing-main">
        <section id="hero" className="landing-hero">
          <div className="landing-hero__copy">
            <span className="landing-badge"><Zap size={16} /> Verified Help. Real Impact.</span>
            <h1>
              Help. Connect.
              <span>Make a Difference.</span>
            </h1>
            <p>
              Sahay connects verified neighbors, volunteers, and organizations to solve real problems in real time right in your community.
            </p>
            <div className="landing-hero__actions">
              <LandingLink authenticatedTo="/create" guestTo="/register" className="landing-btn landing-btn--orange landing-btn--lg">
                Raise a Request <ArrowRight size={18} />
              </LandingLink>
              <LandingLink authenticatedTo="/feed" guestTo="/login" className="landing-btn landing-btn--blue-outline landing-btn--lg">
                I Want to Help <HeartHandshake size={18} />
              </LandingLink>
            </div>
            <div className="landing-trust-row" aria-label="Trusted community">
              <span className="landing-avatar-stack" aria-hidden="true">
                <span>A</span><span>P</span><span>S</span><span>R</span>
              </span>
              <span>Trusted by verified members across growing communities</span>
            </div>
          </div>

          <div className="landing-hero__visual" aria-label="Sahay community volunteers">
            <div className="landing-network-pattern" aria-hidden="true" />
            <div className="landing-hero-image-shell">
              {!heroMissing && (
                <img
                  src={HERO_IMAGE}
                  alt="Four young Indian community volunteers with hands joined in the center"
                  loading="eager"
                  fetchpriority="high"
                  onError={() => setHeroMissing(true)}
                />
              )}
              {heroMissing && (
                <div className="landing-hero-image-missing" role="note">
                  <strong>Exact hero image asset required</strong>
                  <span>frontend/public/assets/sahay-landing-hero.png</span>
                </div>
              )}
              <div className="landing-floating-stats">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label} className={`landing-floating-stat is-${stat.accent}`}>
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="landing-impact-strip" aria-label="Sahay impact statistics">
          {IMPACT_STATS.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className={`landing-impact-card is-${accent}`}>
              <Icon size={22} aria-hidden="true" />
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="landing-section">
          <div className="landing-section__header">
            <span>HOW IT WORKS</span>
            <h2>Simple steps. Real impact.</h2>
          </div>
          <div className="landing-how-grid">
            {HOW_STEPS.map(({ title, text, icon: Icon }, index) => (
              <article key={title} className="landing-step-card">
                <div className="landing-step-card__top">
                  <span>{index + 1}</span>
                  <Icon size={24} aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                {index < HOW_STEPS.length - 1 && <ChevronRight className="landing-step-arrow" size={24} aria-hidden="true" />}
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-intelligence">
          <div className="landing-section__header">
            <span>SMART MATCHING</span>
            <h2>How Sahay intelligence works</h2>
            <p>
              Sahay&apos;s intelligence layer is designed to combine location and trust signals, with ML intelligence being introduced through upcoming matching models.
            </p>
          </div>
          <div className="landing-intel-flow">
            {INTELLIGENCE_STEPS.map(({ step, title, items, icon: Icon, accent }, index) => (
              <article key={title} className={`landing-intel-card is-${accent}`}>
                <small>{step}</small>
                <Icon size={24} aria-hidden="true" />
                <h3>{title}</h3>
                <ul>
                  {items.map((item) => <li key={item}>{item}</li>)}
                </ul>
                {index < INTELLIGENCE_STEPS.length - 1 && <ArrowRight className="landing-intel-arrow" size={25} aria-hidden="true" />}
              </article>
            ))}
          </div>
          <div className="landing-pipeline" aria-label="Smart matching pipeline">
            {['Request Input', 'Smart Matching', 'Priority Score', 'Help Delivered'].map((item, index) => (
              <span key={item} className={index === 0 || index === 3 ? 'is-impact' : ''}>{item}</span>
            ))}
          </div>
        </section>

        <section id="communities" className="landing-section landing-communities">
          <div className="landing-community-copy">
            <span className="landing-kicker">COMMUNITIES</span>
            <h2>Community Spaces</h2>
            <p>
              Join local groups, coordinate help, run campaigns, ask questions, and connect with nearby verified members.
            </p>
            <LandingLink authenticatedTo="/communities" guestTo="/login" className="landing-btn landing-btn--blue landing-btn--lg">
              Explore Communities <ArrowRight size={18} />
            </LandingLink>
            <div className="landing-community-features">
              {COMMUNITY_FEATURES.map(({ title, icon: Icon, accent }) => (
                <article key={title} className={`landing-mini-card is-${accent}`}>
                  <Icon size={20} aria-hidden="true" />
                  <h3>{title}</h3>
                </article>
              ))}
            </div>
          </div>
          <aside className="landing-popular-panel" aria-label="Community preview">
            <div className="landing-popular-panel__header">
              <h3>Popular Communities</h3>
              <Link to={user ? '/communities' : '/login'}>View all</Link>
            </div>
            {COMMUNITY_PREVIEW.map((community, index) => (
              <div key={community.name} className="landing-community-preview">
                <span aria-hidden="true">{community.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                <div>
                  <strong>{community.name}</strong>
                  <small>{community.meta}</small>
                </div>
                <i>{index + 1}</i>
              </div>
            ))}
            <p>This preview avoids dynamic member counts until public discovery data is available.</p>
          </aside>
        </section>

        <section id="safety" className="landing-safety">
          {SAFETY_ITEMS.map(({ title, icon: Icon }) => (
            <article key={title}>
              <Icon size={22} aria-hidden="true" />
              <h3>{title}</h3>
            </article>
          ))}
        </section>
      </main>

      <footer id="about" className="landing-footer">
        <div className="landing-footer__brand">
          <Logo />
          <p>Building safer, stronger communities through trust, technology, and kindness.</p>
        </div>
        <div>
          <h3>Platform</h3>
          <Link to="/feed">Help Feed</Link>
          <Link to="/create">Raise Request</Link>
          <Link to="/volunteer/settings">Volunteer</Link>
          <a href="#how-it-works">How It Works</a>
          <a href="#safety">Safety</a>
          <a href="#about">About Us</a>
        </div>
        <div>
          <h3>Communities</h3>
          <Link to="/communities">All Communities</Link>
          <Link to="/communities">Create Community</Link>
          <a href="#safety">Community Rules</a>
          <a href="#communities">Local Leaders</a>
        </div>
        <div>
          <h3>Resources</h3>
          <a href="#how-it-works">FAQs</a>
          <a href="#safety">Safety Tips</a>
          <Link to="/login">Privacy</Link>
          <Link to="/login">Terms of Service</Link>
          <Link to="/login">Contact support</Link>
        </div>
        <div className="landing-footer__bottom">(c) 2026 Sahay. All rights reserved.</div>
      </footer>
    </div>
  );
}
