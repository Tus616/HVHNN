import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import LocationAutocompleteInput from '../components/LocationAutocompleteInput';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import apiService from '../services/api';
import EmptyState from '../components/EmptyState';


const TYPE_ICONS = { COLLEGE: '🎓', HOSPITAL: '🏥', RESIDENTIAL: '🏘️', CORPORATE: '🏢', OTHER: '🏛️' };
const COMMUNITY_TYPES = [
  { value: 'COLLEGE', label: '🎓 College / University' },
  { value: 'HOSPITAL', label: '🏥 Hospital / Clinic' },
  { value: 'RESIDENTIAL', label: '🏘️ Residential Society' },
  { value: 'CORPORATE', label: '🏢 Corporate / Office' },
  { value: 'OTHER', label: '🏛️ Other Organization' },
];

export default function Communities() {
  const { user } = useAuth();
  const { notifyCommunityJoined, notifyCommunityCreated } = useNotifications();
  const [communities, setCommunities] = useState([]);
  const [joinedIds, setJoinedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    name: '', type: 'COLLEGE', description: '', address: '', radiusKm: 5, verificationCode: '', emailDomain: ''
  });

  // Email domain verification state
  const [joinMode, setJoinMode] = useState('code'); // 'code' or 'email'
  const [emailForOTP, setEmailForOTP] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [commRes, joinedRes] = await Promise.all([
        apiService.getCommunities(),
        apiService.getJoinedCommunities(user?.userId),
      ]);
      setCommunities(commRes.data);
      setJoinedIds(joinedRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleAddressChange = (address) => setForm((current) => ({ ...current, address }));

  const { showToast } = useNotifications();

  const showToastMsg = (msg, type = 'success') => {
    showToast({ message: msg, type });
  };


  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name || !form.type || !form.address) {
      showToastMsg('Please fill in all required fields.', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await apiService.createCommunity({ ...form }, user?.userId);
      setCommunities([...communities, res.data]);
      setJoinedIds([...joinedIds, res.data.id]);
      setShowCreate(false);
      setForm({ name: '', type: 'COLLEGE', description: '', address: '', radiusKm: 5, verificationCode: '', emailDomain: '' });
      showToastMsg(`🎉 Community "${res.data.name}" created! Verification code: ${res.data.verificationCode}`);
      notifyCommunityCreated(res.data.name, res.data.verificationCode);
    } catch (err) {
      showToastMsg(err.message || 'Failed to create community.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      showToastMsg('Please enter the verification code.', 'error');
      return;
    }
    setJoining(true);
    try {
      const res = await apiService.joinCommunity(showJoin.id, verificationCode.trim(), user?.userId);
      setJoinedIds([...joinedIds, showJoin.id]);
      // Update member count in local state
      setCommunities(communities.map(c => c.id === showJoin.id ? { ...c, memberCount: c.memberCount + 1 } : c));
      showToastMsg(`✅ ${res.data.message}`);
      notifyCommunityJoined(showJoin.name);
      setShowJoin(null);
      setVerificationCode('');
    } catch (err) {
      showToastMsg(err.message || 'Failed to join community.', 'error');
    } finally {
      setJoining(false);
    }
  };

  // Email OTP send
  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!emailForOTP.trim() || !emailForOTP.includes('@')) {
      showToastMsg('Please enter a valid institutional email.', 'error');
      return;
    }
    setJoining(true);
    try {
      await apiService.sendEmailOTP(showJoin.id, emailForOTP.trim());
      setOtpSent(true);
      showToastMsg('OTP sent to your email!');
    } catch (err) {
      showToastMsg(err.message || 'Failed to send OTP. Check your email domain.', 'error');
    } finally {
      setJoining(false);
    }
  };

  // Email OTP verify & join
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 4) {
      showToastMsg('Please enter the OTP.', 'error');
      return;
    }
    setJoining(true);
    try {
      const res = await apiService.verifyEmailOTP(showJoin.id, emailForOTP.trim(), otpCode.trim(), user?.userId);
      setJoinedIds([...joinedIds, showJoin.id]);
      setCommunities(communities.map(c => c.id === showJoin.id ? { ...c, memberCount: c.memberCount + 1 } : c));
      showToastMsg(`✅ ${res.data?.message || 'Email verified! You have joined the community.'}`);
      notifyCommunityJoined(showJoin.name);
      setShowJoin(null);
      setEmailForOTP('');
      setOtpCode('');
      setOtpSent(false);
    } catch (err) {
      showToastMsg(err.message || 'Invalid OTP. Try again.', 'error');
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async (communityId, communityName) => {
    try {
      await apiService.leaveCommunity(communityId, user?.userId);
      setJoinedIds(joinedIds.filter(id => id !== communityId));
      setCommunities(communities.map(c => c.id === communityId ? { ...c, memberCount: Math.max(0, c.memberCount - 1) } : c));
      showToastMsg(`Left ${communityName}.`);
    } catch (err) {
      showToastMsg(err.message || 'Failed to leave community.', 'error');
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="animate-in">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1>🏘️ Verified Communities</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            {joinedIds.length} joined • {communities.length} total communities
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="search-bar-container" style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
            <input
              type="text"
              className="form-input"
              placeholder="Search communities by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', borderRadius: 'var(--radius-full)', background: 'var(--bg-card)' }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Create Community
          </button>
        </div>
      </div>

      <div className="feature-grid">
        {communities
          .filter(c => 
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
            (c.location || c.address || '').toLowerCase().includes(searchQuery.toLowerCase())
          ).length === 0 ? (
            <EmptyState
              type="communities"
              title="No communities found"
              message={searchQuery ? `No results for "${searchQuery}". Try a different location or name.` : "You haven't joined any communities yet, and none are visible nearby."}
              actionLabel="Create a Community"
              onAction={() => setShowCreate(true)}
            />
          ) : (
            communities
              .filter(c => 
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (c.location || c.address || '').toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map(c => {
                const isJoined = joinedIds.includes(c.id);
                const type = (c.type || c.category || 'OTHER').toUpperCase();
                return (
                  <div key={c.id} className="card card-glass-lite" style={{ textAlign: 'center', borderColor: isJoined ? 'rgba(16, 185, 129, 0.3)' : undefined, position: 'relative' }}>
                    {isJoined && (
                      <div className="badge-joined-indicator" style={{ position: 'absolute', top: '12px', right: '12px', padding: '4px 10px', background: 'rgba(16,185,129,0.15)', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>
                        ✓ Joined
                      </div>
                    )}
                    <div style={{ fontSize: '3rem', marginBottom: '16px', marginTop: '12px' }}>{TYPE_ICONS[type] || '🏛️'}</div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>{c.name}</h3>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                      <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                        {type}
                      </span>
                      {c.requestCount > 0 && (
                        <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontSize: '0.7rem' }}>
                          🆘 {c.requestCount} active helps
                        </span>
                      )}
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '12px 0', minHeight: '3em' }}>{c.description}</p>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {c.location || c.address}</div>
                      <div>👥 {c.memberCount} member{c.memberCount !== 1 ? 's' : ''}</div>
                    </div>
                    {isJoined ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link to={`/community/${c.id}`} className="btn btn-success btn-sm" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none' }}>
                          → Go to Community
                        </Link>
                        <button className="btn btn-danger btn-sm"
                          onClick={() => handleLeave(c.id, c.name)} title="Leave Community">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}
                        onClick={() => { setShowJoin(c); setVerificationCode(''); setJoinMode('code'); setEmailForOTP(''); setOtpCode(''); setOtpSent(false); }}>
                        Join Community
                      </button>
                    )}
                  </div>
                );
              })
          )}
      </div>


      {/* Join Community Modal - Enhanced with Email Verification */}
      {showJoin && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowJoin(null); setVerificationCode(''); } }}>
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Join {showJoin.name}</h2>
              <button className="btn btn-icon btn-secondary" onClick={() => { setShowJoin(null); setVerificationCode(''); }} style={{ fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '8px' }}>{TYPE_ICONS[showJoin.type] || '🏛️'}</div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{showJoin.description}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>📍 {showJoin.address} • 👥 {showJoin.memberCount} members</p>
            </div>

            {/* Verification Mode Tabs */}
            <div className="auth-mode-toggle" style={{ marginBottom: '20px' }}>
              <button className={`auth-mode-btn ${joinMode === 'code' ? 'active' : ''}`} onClick={() => setJoinMode('code')}>
                🔑 Join Code
              </button>
              <button className={`auth-mode-btn ${joinMode === 'email' ? 'active' : ''}`} onClick={() => setJoinMode('email')}>
                📧 Email Domain
              </button>
            </div>

            {joinMode === 'code' ? (
              <>
                <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '0.85rem', color: 'var(--warning)' }}>
                  🔐 Enter the verification code provided by your community admin to join.
                </div>
                <form onSubmit={handleJoin}>
                  <div className="form-group">
                    <label className="form-label">Verification Code *</label>
                    <input type="text" className="form-input" placeholder="e.g., IITD2026"
                      value={verificationCode} onChange={e => setVerificationCode(e.target.value.toUpperCase())}
                      required autoFocus
                      style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '3px', fontWeight: 700 }} />
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => { setShowJoin(null); setVerificationCode(''); }}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={joining}>
                      {joining ? 'Joining...' : '🤝 Join Community'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div style={{ padding: '12px 16px', background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>
                  📧 Verify your institutional email domain (e.g., <strong>@iitd.ac.in</strong>, <strong>@aiims.edu</strong>) to join automatically.
                </div>

                {!otpSent ? (
                  <form onSubmit={handleSendOTP}>
                    <div className="form-group">
                      <label className="form-label">Institutional Email *</label>
                      <input type="email" className="form-input" placeholder="you@iitd.ac.in"
                        value={emailForOTP} onChange={e => setEmailForOTP(e.target.value)}
                        required autoFocus />
                    </div>
                    <div className="modal-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowJoin(null); }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" disabled={joining}>
                        {joining ? 'Sending...' : '📩 Send OTP'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOTP}>
                    <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '0.85rem', color: '#10b981' }}>
                      ✅ OTP sent to <strong>{emailForOTP}</strong>. Check your inbox (and spam folder).
                    </div>
                    <div className="form-group">
                      <label className="form-label">Enter OTP *</label>
                      <input type="text" className="form-input" placeholder="123456"
                        value={otpCode} onChange={e => setOtpCode(e.target.value)}
                        required autoFocus maxLength={6}
                        style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '8px', fontWeight: 700 }} />
                    </div>
                    <div className="modal-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => setOtpSent(false)}>← Back</button>
                      <button type="submit" className="btn btn-primary" disabled={joining}>
                        {joining ? 'Verifying...' : '✅ Verify & Join'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(99,102,241,0.05)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              💡 Demo codes: <strong>IITD2026</strong> (IIT Delhi), <strong>AIIMS2026</strong> (AIIMS), <strong>GVS2026</strong> (Green Valley)
            </div>
          </div>
        </div>
      )}

      {/* Create Community Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0 }}>🏗️ Create Your Community</h2>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowCreate(false)} style={{ fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 'var(--radius-md)', marginBottom: '24px', fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
              💡 Once created, your community will receive a unique <strong>verification code</strong> that you can share with members to join. You will be auto-joined as the first member.
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Community Name *</label>
                <input type="text" name="name" className="form-input"
                  placeholder="e.g., IIT Bombay, Apollo Hospital, Sunshine Society"
                  value={form.name} onChange={handleChange} required />
              </div>

              <div className="form-group">
                <label className="form-label">Community Type *</label>
                <select name="type" className="form-select" value={form.type} onChange={handleChange} required>
                  {COMMUNITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea name="description" className="form-textarea"
                  placeholder="Briefly describe your community and its purpose..."
                  value={form.description} onChange={handleChange} rows={3} />
              </div>

              <div className="form-group">
                <label className="form-label">Address / Location *</label>
                <LocationAutocompleteInput
                  name="address"
                  placeholder="Full address or area name"
                  value={form.address}
                  onValueChange={handleAddressChange}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Coverage Radius (km)</label>
                  <input type="number" name="radiusKm" className="form-input"
                    placeholder="5" min="1" max="50"
                    value={form.radiusKm} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">Custom Verification Code</label>
                  <input type="text" name="verificationCode" className="form-input"
                    placeholder="Auto-generated if empty"
                    value={form.verificationCode} onChange={handleChange} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : '🚀 Create Community'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
