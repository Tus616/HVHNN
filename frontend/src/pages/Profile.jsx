// FEATURE: Enhanced Profile Page - Saved Requests, Communities, Activity, Badge Progress
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import useBookmarks from '../hooks/useBookmarks';
import { timeAgo } from '../utils/timeUtils';
import { VOLUNTEER_SKILL_OPTIONS } from '../utils/volunteer';
import VerificationBadge from '../components/VerificationBadge';

const BADGE_TIERS = [
  { label: 'Newcomer', icon: '🌱', minPoints: 0 },
  { label: 'Volunteer', icon: '💪', minPoints: 50 },
  { label: 'Helper', icon: '🤝', minPoints: 100 },
  { label: 'Champion', icon: '🏆', minPoints: 200 },
  { label: 'Hero', icon: '🦸', minPoints: 500 },
];

function getBadgeTier(points) {
  let tier = BADGE_TIERS[0];
  for (const t of BADGE_TIERS) {
    if (points >= t.minPoints) tier = t;
  }
  return tier;
}

function getNextTier(points) {
  for (const t of BADGE_TIERS) {
    if (points < t.minPoints) return t;
  }
  return null;
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [helpedRequests, setHelpedRequests] = useState([]);
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [allCommunities, setAllCommunities] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('created');
  const [loading, setLoading] = useState(true);
  const { bookmarks, isBookmarked, toggleBookmark } = useBookmarks();
  const [savedRequests, setSavedRequests] = useState([]);
  const [impact, setImpact] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '', relation: 'Family' });
  const [editingContactIndex, setEditingContactIndex] = useState(null);
  const [savingContacts, setSavingContacts] = useState(false);

  useEffect(() => {
    loadProfile();
    loadImpact();
  }, []);

  // Load saved request details when bookmarks or tab changes
  useEffect(() => {
    if (tab === 'saved' && bookmarks.length > 0 && savedRequests.length === 0) {
      loadSavedRequests();
    }
  }, [tab, bookmarks]);

  const loadProfile = async () => {
    try {
      setLoadError('');
      const [profileRes, myRes, helpedRes, commRes, joinedRes] = await Promise.allSettled([
        apiService.getProfile(user?.userId),
        apiService.getMyRequests(user?.userId),
        apiService.getVolunteeredRequests(user?.userId),
        apiService.getCommunities(),
        apiService.getJoinedCommunities(user?.userId),
      ]);

      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data);
        setEmergencyContacts(profileRes.value.data.emergencyContacts || []);
      } else {
        setLoadError(profileRes.reason?.message || 'We could not load your latest profile details.');
      }

      if (myRes.status === 'fulfilled') {
        setMyRequests(myRes.value.data);
      }

      if (helpedRes.status === 'fulfilled') {
        setHelpedRequests(helpedRes.value.data);
      }

      if (commRes.status === 'fulfilled' && joinedRes.status === 'fulfilled') {
        const joinedIds = joinedRes.value.data || [];
        const all = commRes.value.data || [];
        setAllCommunities(all);
        setJoinedCommunities(all.filter((c) => joinedIds.includes(c.id)));
      }
    } catch (err) {
      console.error(err);
      setLoadError(err.message || 'We could not load your profile right now.');
    } finally {
      setLoading(false);
    }
  };

  const loadSavedRequests = async () => {
    try {
      const res = await apiService.getAllRequests();
      const all = res.data || [];
      const saved = all.filter((r) => bookmarks.includes(String(r.id)));
      setSavedRequests(saved);
    } catch {
      // silently fail for saved requests
    }
  };

  const loadImpact = async () => {
    try {
      const res = await apiService.getUserImpact();
      setImpact(res.data);
      // Milestone: First help celebration
      if (res.data.totalPeopleHelped === 1 && !window.localStorage.getItem('hvhn_first_impact_celebrated')) {
        setShowConfetti(true);
        window.localStorage.setItem('hvhn_first_impact_celebrated', 'true');
        setTimeout(() => setShowConfetti(false), 6000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openAddContact = () => {
    setContactForm({ name: '', phone: '', email: '', relation: 'Family' });
    setEditingContactIndex(null);
    setIsEmergencyModalOpen(true);
  };

  const openEditContact = (idx) => {
    setContactForm({ ...emergencyContacts[idx] });
    setEditingContactIndex(idx);
    setIsEmergencyModalOpen(true);
  };

  const deleteContact = async (idx) => {
    if (!window.confirm('Remove this emergency contact?')) return;
    const nextContacts = emergencyContacts.filter((_, i) => i !== idx);
    setEmergencyContacts(nextContacts);
    saveEmergencyContacts(nextContacts);
  };

  const submitContactForm = async (e) => {
    e.preventDefault();
    setSavingContacts(true);
    let nextContacts = [...emergencyContacts];
    
    if (editingContactIndex !== null) {
      nextContacts[editingContactIndex] = contactForm;
    } else {
      nextContacts.push(contactForm);
    }

    try {
      await saveEmergencyContacts(nextContacts);
      setEmergencyContacts(nextContacts);
      setIsEmergencyModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingContacts(false);
    }
  };

  const saveEmergencyContacts = async (contacts) => {
    try {
      await apiService.updateProfile(user?.userId, { emergencyContacts: contacts });
    } catch (err) {
      console.error('Failed to sync emergency contacts', err);
      throw err;
    }
  };


  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const p = profile || user;
  const volunteerPath = p?.isVolunteer ? '/volunteer/dashboard' : '/volunteer/settings';
  const volunteerLabel = p?.isVolunteer ? 'Open Volunteer Dashboard' : 'Enable Volunteer Mode';
  const currentTier = getBadgeTier(p?.points || 0);
  const nextTier = getNextTier(p?.points || 0);
  // Improved progress calculation: show progress within the current bracket
  const progressPercent = nextTier
    ? Math.max(5, Math.min(95, Math.round(((p?.points || 0) - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints) * 100)))
    : 100;

  const TABS = [
    { key: 'created', label: `📝 My Requests (${myRequests.length})` },
    { key: 'helped', label: `🤝 Volunteered (${helpedRequests.length})` },
    { key: 'saved', label: `🔖 Saved (${bookmarks.length})` },
    { key: 'communities', label: `🏘️ Communities (${joinedCommunities.length})` },
  ];

  const renderRequestList = (list, emptyIcon, emptyTitle, emptyDesc, ctaPath, ctaLabel) => {
    if (list.length === 0) {
      return (
        <div className="empty-state" style={{ padding: '60px 20px' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px', opacity: 0.6 }}>{emptyIcon}</div>
          <h3 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '8px' }}>{emptyTitle}</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>{emptyDesc}</p>
          {ctaPath && (
            <Link to={ctaPath} className="btn btn-primary" style={{ display: 'inline-flex' }}>
              {ctaLabel}
            </Link>
          )}
        </div>
      );
    }
    return list.map((req) => (
      <Link to={`/request/${req.id}`} key={req.id} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="request-card" data-urgency={req.urgency}>
          <div className="request-header">
            <div className="request-title">{req.title}</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span className={`badge badge-status-${req.status?.toLowerCase()}`}>{req.status}</span>
              <span className="badge badge-category">{req.category?.replace('_', ' ')}</span>
            </div>
          </div>
          <div className="request-desc">{req.description}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{timeAgo(req.createdAt)}</span>
            {tab === 'saved' && (
              <button
                className="btn btn-sm btn-secondary"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(req.id); }}
              >
                🗑️ Remove
              </button>
            )}
          </div>
        </div>
      </Link>
    ));
  };

  return (
    <div className="animate-in">
      {loadError && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--warning)', fontSize: '0.9rem', marginBottom: '20px' }}>
          {loadError}
        </div>
      )}

      <div className="profile-header">
        <div className="profile-avatar">{p?.fullName?.charAt(0)?.toUpperCase() || 'U'}</div>
        <div className="profile-info" style={{ flex: 1 }}>
          <div className="flex items-center gap-3">
            <h2 className="mb-0">{p?.fullName}</h2>
            <VerificationBadge level={p?.verificationLevel || 'BASIC'} size="lg" />
          </div>
          <p>{p?.email} {p?.verified && <span style={{ color: 'var(--accent-secondary)' }}>✓ Verified</span>}</p>
          <p style={{ fontSize: '0.9rem' }}>
            <span style={{ padding: '4px 12px', background: 'rgba(99,102,241,0.1)', borderRadius: 'var(--radius-full)', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '0.85rem' }}>
              {currentTier.icon} {currentTier.label}
            </span>
            {p?.address && <span style={{ color: 'var(--text-muted)', marginLeft: '12px' }}>📍 {p.address}</span>}
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            {(p?.skills || []).map((skillKey) => {
              const skillInfo = VOLUNTEER_SKILL_OPTIONS.find(s => s.value === skillKey);
              if (!skillInfo) return null;
              return (
                <span 
                  key={skillKey} 
                  className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full border border-blue-200 font-medium shadow-sm"
                >
                  <span>{skillInfo.icon}</span>
                  <span>{skillInfo.label}</span>
                </span>
              );
            })}
          </div>
          {p?.bio && <p className="member-card-bio" style={{ marginTop: '12px', fontSize: '0.9rem' }}>{p.bio}</p>}
        </div>
        <div>
          <Link to="/profile/edit" className="btn btn-secondary btn-sm">
            ✏️ Edit Profile
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <Link to={volunteerPath} className="btn btn-primary">
          {volunteerLabel}
        </Link>
      </div>

      {/* My Impact Dashboard */}
      <div className="card mb-6 overflow-hidden relative border-none bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-xl">
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="confetti-container">
              {[...Array(20)].map((_, i) => <div key={i} className="confetti-piece" style={{"--i": i}} />)}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/20 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/30 animate-bounce">
                <span className="text-xl font-bold">🎉 You made your first impact!</span>
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold tracking-tight">🌍 My Cumulative Impact</h3>
            <div className={`flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm border border-white/20 ${(impact?.currentStreak || 0) >= 3 ? 'animate-pulse' : ''}`}>
              <span className={`text-lg ${(impact?.currentStreak || 0) >= 3 ? 'fire-streak' : ''}`}>🔥</span>
              <span className="font-bold">{impact?.currentStreak || 0} Day Streak</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all cursor-default">
              <div className="text-3xl font-black mb-1">{impact?.totalPeopleHelped || 0}</div>
              <div className="text-[10px] uppercase font-bold text-blue-100/70 tracking-widest leading-none">People Helped</div>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all cursor-default">
              <div className="text-3xl font-black mb-1">{impact?.currentStreak || 0}</div>
              <div className="text-[10px] uppercase font-bold text-blue-100/70 tracking-widest leading-none">Days Streak</div>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all cursor-default">
              <div className="text-3xl font-black mb-1">{impact?.longestStreak || 0}</div>
              <div className="text-[10px] uppercase font-bold text-blue-100/70 tracking-widest leading-none">Longest Streak</div>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all cursor-default">
              <div className="text-3xl font-black mb-1">{impact?.totalDistanceTraveled || 0} <span className="text-sm font-normal">km</span></div>
              <div className="text-[10px] uppercase font-bold text-blue-100/70 tracking-widest leading-none">Distance Covered</div>
            </div>
          </div>

          {(impact?.currentStreak || 0) >= 5 && (
            <div className="mt-6 flex items-center justify-center p-3 bg-amber-400 text-amber-950 rounded-xl font-bold gap-2 animate-bounce">
              <span>🌟</span> Elite Helper: 5+ Day Streak Active! <span>🌟</span>
            </div>
          )}
        </div>
      </div>

      {/* Verification Level Guide */}
      <div className="card mb-6 border-none shadow-md bg-white">
        <div className="p-1">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            🛡️ Identity Trust Center
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className={`p-4 rounded-2xl border relative ${p?.verificationLevel === 'BASIC' ? 'bg-slate-50 border-slate-200 shadow-sm' : 'bg-white border-gray-100 opacity-60'}`}>
              <div className="flex items-center gap-2 mb-2">
                <VerificationBadge level="BASIC" />
                <span className="font-bold text-slate-700">Basic</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">Auto-assigned upon email verification. Access to feed and basic community features.</p>
              {p?.verificationLevel === 'BASIC' && (
                <div className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Current Level</div>
              )}
            </div>
            <div className={`p-4 rounded-2xl border relative ${p?.verificationLevel === 'VERIFIED' ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100'} ${p?.verificationLevel === 'BASIC' ? '' : p?.verificationLevel === 'VERIFIED' ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-2 mb-2">
                <VerificationBadge level="VERIFIED" />
                <span className="font-bold text-blue-700">Verified</span>
              </div>
              <p className="text-xs text-blue-600 leading-relaxed">Join a community using your institution email (e.g., .edu, .ac.in) or a valid join code.</p>
              {p?.verificationLevel === 'VERIFIED' && (
                <div className="mt-3 text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Current Level</div>
              )}
              {p?.verificationLevel === 'BASIC' && (
                <Link to="/communities" className="mt-3 inline-block text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-tighter">Join Community to Level Up →</Link>
              )}
            </div>
            <div className={`p-4 rounded-2xl border relative ${p?.verificationLevel === 'TRUSTED' ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-gray-100'} ${p?.verificationLevel === 'TRUSTED' ? '' : 'opacity-60'}`}>
              <div className="flex items-center gap-2 mb-2">
                <VerificationBadge level="TRUSTED" />
                <span className="font-bold text-emerald-700">Trusted</span>
              </div>
              <p className="text-xs text-emerald-600 leading-relaxed">Assigned manually by administrators for consistent high-impact contributions and verified history.</p>
              {p?.verificationLevel === 'TRUSTED' && (
                <div className="mt-3 text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Current Level</div>
              )}
              {p?.verificationLevel === 'VERIFIED' && (
                <div className="mt-3 text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Eligible for Review</div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="profile-stats">
        <div className="stat-card">
          <div className="stat-value">{p?.points || 0}</div>
          <div className="stat-label">Points</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{p?.requestsHelped || 0}</div>
          <div className="stat-label">People Helped</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{p?.requestsCreated || 0}</div>
          <div className="stat-label">Requests Created</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {p?.requestsHelped > 0 ? `★ ${(p?.rating || 5).toFixed(1)}` : 'New'}
          </div>
          <div className="stat-label">Rating</div>
        </div>
      </div>

      {/* Badge Progress */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>🏅 Badge Progress</h3>
          {nextTier && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {nextTier.minPoints - (p?.points || 0)} pts to {nextTier.icon} {nextTier.label}
            </span>
          )}
        </div>
        <div className="badge-progress-bar">
          <div className="badge-progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="badge-tier-row">
          {BADGE_TIERS.map((tier) => (
            <div
              key={tier.label}
              className={`badge-tier-item ${(p?.points || 0) >= tier.minPoints ? 'unlocked' : ''}`}
            >
              <span className="badge-tier-icon">{tier.icon}</span>
              <span className="badge-tier-label">{tier.label}</span>
              <span className="badge-tier-pts">{tier.minPoints}+</span>
            </div>
          ))}
        </div>
      </div>

      {/* Emergency Contacts Section */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--danger-color)' }}>🚨 Emergency Contacts</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              These contacts will be alerted automatically when you raise an SOS emergency request.
            </p>
          </div>
          {emergencyContacts.length < 3 && (
            <button className="btn btn-secondary btn-sm" onClick={openAddContact}>
              + Add Contact
            </button>
          )}
        </div>

        {emergencyContacts.length === 0 ? (
          <div style={{ padding: '20px', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No emergency contacts registered yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {emergencyContacts.map((contact, idx) => (
              <div key={idx} className="relative p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {contact.relation}
                  </span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditContact(idx)} className="text-gray-400 hover:text-blue-500 p-1">
                      ✏️
                    </button>
                    <button onClick={() => deleteContact(idx)} className="text-gray-400 hover:text-red-500 p-1">
                      🗑️
                    </button>
                  </div>
                </div>
                <div className="font-bold text-gray-900 mb-1">{contact.name}</div>
                <div className="text-sm text-gray-500 flex items-center gap-2 mb-1">
                  <span>📞</span> {contact.phone}
                </div>
                <div className="text-sm text-gray-500 flex items-center gap-2 truncate">
                  <span>📧</span> {contact.email}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Contact Modal */}
      {isEmergencyModalOpen && (
        <div className="modal-overlay" onClick={() => setIsEmergencyModalOpen(false)}>
          <div className="modal max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">
              {editingContactIndex !== null ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
            </h2>
            <form onSubmit={submitContactForm} className="space-y-4">
              <div>
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  value={contactForm.name} 
                  onChange={e => setContactForm({...contactForm, name: e.target.value})}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Relation</label>
                  <select 
                    className="form-select" 
                    value={contactForm.relation} 
                    onChange={e => setContactForm({...contactForm, relation: e.target.value})}
                  >
                    <option value="Family">Family</option>
                    <option value="Friend">Friend</option>
                    <option value="Colleague">Colleague</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    required 
                    value={contactForm.phone} 
                    onChange={e => setContactForm({...contactForm, phone: e.target.value})}
                    placeholder="+91..."
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  required 
                  value={contactForm.email} 
                  onChange={e => setContactForm({...contactForm, email: e.target.value})}
                  placeholder="email@example.com"
                />
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-blue-800 text-sm mt-4">
                ℹ️ This contact will be alerted when you raise an SOS emergency request.
              </div>
              <div className="modal-actions mt-6">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEmergencyModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingContacts}>
                  {savingContacts ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="feed-filters" style={{ marginBottom: '24px' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`filter-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="request-list">
        {tab === 'created' && renderRequestList(
          myRequests, '📋',
          "You haven't raised any requests yet",
          'When you need help from your community, raise a request and nearby verified volunteers will be notified instantly.',
          '/create', '+ Raise a Request'
        )}
        {tab === 'helped' && renderRequestList(
          helpedRequests, '🤝',
          "You haven't volunteered yet",
          'Start helping your community by enabling volunteer mode and accepting nearby help requests.',
          '/feed', '🔍 Find Requests'
        )}
        {tab === 'saved' && renderRequestList(
          bookmarks.length > 0 ? savedRequests : [], '🔖',
          'No saved requests',
          'Bookmark requests from the feed to find them easily here.',
          '/feed', '🔍 Browse Feed'
        )}
        {tab === 'communities' && (
          joinedCommunities.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 20px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '16px', opacity: 0.6 }}>🏘️</div>
              <h3 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '8px' }}>No communities joined yet</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px' }}>
                Join a verified community to connect with neighbors and start receiving hyperlocal help requests.
              </p>
              <Link to="/communities" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                🏘️ Browse Communities
              </Link>
            </div>
          ) : (
            <div className="community-grid-profile">
              {joinedCommunities.map((c) => (
                <Link to={`/community/${c.id}`} key={c.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card community-profile-card">
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                      {c.type === 'COLLEGE' ? '🎓' : c.type === 'HOSPITAL' ? '🏥' : c.type === 'RESIDENTIAL' ? '🏘️' : c.type === 'CORPORATE' ? '🏢' : '🏛️'}
                    </div>
                    <h4 style={{ fontWeight: 700, marginBottom: '4px' }}>{c.name}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      📍 {c.address} • 👥 {c.memberCount} members
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
