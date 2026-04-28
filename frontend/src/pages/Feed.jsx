// FEATURE: Search in Help Feed + SOS Emergency + Request Expiry + Bookmarks + Share
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import apiService from '../services/api';
import useBookmarks from '../hooks/useBookmarks';
import { timeAgo } from '../utils/timeUtils';
import VerificationBadge from '../components/VerificationBadge';
import EmptyState from '../components/EmptyState';
import communityImage from '../assets/community.png';
import searchImage from '../assets/search.png';



const CATEGORIES = ['ALL', 'SAVED', 'BLOOD_DONATION', 'MEDICAL', 'FOOD', 'TRANSPORT', 'EMERGENCY', 'GENERAL'];
const CATEGORY_ICONS = { BLOOD_DONATION: '🩸', MEDICAL: '🏥', FOOD: '🍲', TRANSPORT: '🚗', EMERGENCY: '🚨', GENERAL: '📋' };

const URGENCY_CLASS = { CRITICAL: 'badge-critical', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };

function shareRequest(req, e) {
  e.preventDefault();
  e.stopPropagation();
  const url = `${window.location.origin}/request/${req.id}`;
  const text = `${req.title} — Help needed via HVHN`;
  if (navigator.share) {
    navigator.share({ title: text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${text}\n${url}`).then(
      () => alert('Link copied!'),
      () => {}
    );
  }
}

function getExpiryInfo(request) {
  if (!request.createdAt) return null;
  const created = new Date(request.createdAt).getTime();
  const urgencyHours = { CRITICAL: 24, HIGH: 24, MEDIUM: 72, LOW: 168 };
  const hours = urgencyHours[request.urgency] || 72;
  const expiresAt = created + hours * 3600000;
  const remaining = expiresAt - Date.now();

  if (remaining <= 0) return { expired: true, text: 'EXPIRED', className: 'badge-expired' };

  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  let text, className;
  if (hrs >= 6) { text = `Expires in ${hrs}h ${mins}m`; className = 'expiry-green'; }
  else if (hrs >= 2) { text = `Expires in ${hrs}h ${mins}m`; className = 'expiry-yellow'; }
  else { text = `Expires in ${hrs > 0 ? hrs + 'h ' : ''}${mins}m`; className = 'expiry-red'; }

  return { expired: false, text, className };
}

export default function Feed() {
  const { user } = useAuth();
  const { notifyRequestCreated } = useNotifications();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSOS, setShowSOS] = useState(false);
  const [sosDesc, setSosDesc] = useState('');
  const [sosLoading, setSosLoading] = useState(false);
  const [sosSuccess, setSosSuccess] = useState(false);
  const [toast, setToast] = useState(null);
  const { bookmarks, isBookmarked, toggleBookmark } = useBookmarks();
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState([]);
  const [dismissedAnnIds, setDismissedAnnIds] = useState([]);
  const debounceRef = useRef(null);

  useEffect(() => { 
    loadRequests(); 
    loadPinnedAnnouncements();
  }, []);

  // Update expiry timestamps every minute
  useEffect(() => {
    const timer = setInterval(() => setRequests(r => [...r]), 60000);
    return () => clearInterval(timer);
  }, []);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const loadRequests = async () => {
    try {
      const res = await apiService.getOpenRequests();
      // Backend may return a paginated object ({ content: [...] }) — normalise defensively
      const raw = res.data;
      const items = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.content)
          ? raw.content
          : [];
      setRequests(items);
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPinnedAnnouncements = async () => {
    try {
      const res = await apiService.getPinnedAnnouncements();
      setPinnedAnnouncements(res.data || []);
    } catch (err) {
      console.error('Failed to load pinned announcements', err);
    }
  };

  const { showToast } = useNotifications();


  const handleSOS = async (e) => {
    e.preventDefault();
    if (!sosDesc.trim()) { showToast('Please describe your emergency', 'error'); return; }
    setSosLoading(true);

    try {
      let lat = null, lng = null;
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* location not critical for SOS */ }

      const res = await apiService.createRequest({
        title: '🚨 SOS: ' + sosDesc.trim(),
        description: 'EMERGENCY SOS — ' + sosDesc.trim(),
        category: 'EMERGENCY',
        urgency: 'CRITICAL',
        latitude: lat,
        longitude: lng,
        address: lat ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'GPS location shared',
      }, user);

      showToast('🚨 SOS sent! Volunteers are being notified.', 'success');
      if (notifyRequestCreated) notifyRequestCreated(res.data);
      setShowSOS(false);
      setSosDesc('');
      setSosSuccess(true);
      setTimeout(() => setSosSuccess(false), 8000);
      loadRequests();
    } catch (err) {
      showToast(err.message || 'Failed to send SOS', 'error');
    } finally {
      setSosLoading(false);
    }
  };

  const filterBySearch = (req) => {
    if (!debouncedSearch.trim()) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      (req.title || '').toLowerCase().includes(q) ||
      (req.description || '').toLowerCase().includes(q) ||
      (req.address || '').toLowerCase().includes(q)
    );
  };

  const filtered = (() => {
    let result = Array.isArray(requests) ? requests : [];
    if (filter === 'SAVED') {
      result = result.filter((r) => isBookmarked(r.id));
    } else if (filter !== 'ALL') {
      result = result.filter((r) => r.category === filter);
    }
    return result.filter(filterBySearch);
  })();

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="animate-in">


      <div className="page-header">
        <div>
          <h1>🆘 Help Feed</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            {requests.length} active requests in your network
          </p>
        </div>
        <Link to="/create" className="btn btn-primary">+ Raise Request</Link>
      </div>

      {(Array.isArray(pinnedAnnouncements) ? pinnedAnnouncements : []).filter(a => !dismissedAnnIds.includes(a.id)).map(ann => (
        <div 
          key={ann.id}
          className="animate-in mb-6 p-4 rounded-xl border-l-[6px] border-amber-400 bg-amber-50 shadow-sm flex items-center gap-4 group"
        >
          <div className="text-2xl">📢</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Official Update</span>
              <span className="text-xs text-amber-700/60 font-medium">{ann.authorName}</span>
            </div>
            <h4 className="text-sm font-bold text-amber-900 mt-1">{ann.title}</h4>
          </div>
          <div className="flex items-center gap-2">
            <Link 
              to={`/community/${ann.communityId}`}
              className="text-xs font-bold text-amber-700 bg-amber-200/50 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Learn More
            </Link>
            <button 
              onClick={() => setDismissedAnnIds([...dismissedAnnIds, ann.id])}
              className="text-amber-400 hover:text-amber-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      {sosSuccess && (
        <div 
          className="animate-in" 
          style={{ 
            padding: '16px 20px', 
            background: 'var(--success)', 
            color: 'white', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
          }}
        >
          <span style={{ fontSize: '1.5rem' }}>✅</span>
          <div>
            <div style={{ fontWeight: 700 }}>SOS Sent Successfully!</div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Your emergency contacts have been notified via email.</div>
          </div>
          <button 
            onClick={() => setSosSuccess(false)} 
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="search-bar-container" style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Search help requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px', borderRadius: 'var(--radius-full)', background: 'var(--bg-card)' }}
          />
        </div>
        <button className="btn btn-secondary" onClick={() => setShowSOS(true)} style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          🚨 SOS Emergency
        </button>
      </div>

      <div className="feed-filters">
        {CATEGORIES.map(cat => (
          <button key={cat} className={`filter-btn ${filter === cat ? 'active' : ''}`}
            onClick={() => setFilter(cat)}>
            {cat === 'ALL' ? '🌐 All' : cat === 'SAVED' ? `🔖 Saved (${bookmarks.length})` : `${CATEGORY_ICONS[cat] || ''} ${cat.replace('_', ' ')}`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          type={debouncedSearch ? 'search' : 'requests'}
          image={debouncedSearch ? searchImage : communityImage}
          title={debouncedSearch ? `No results for "${debouncedSearch}"` : 'No requests nearby'}
          message={debouncedSearch ? 'Try different keywords or clear the search filters.' : 'There are no active help requests in your area right now. Check back soon or go online to help!'}
          actionLabel={debouncedSearch ? 'Clear Search' : 'Raise a Request'}
          actionLink={debouncedSearch ? null : '/create'}
          onAction={debouncedSearch ? () => setSearch('') : null}
        />
      ) : (


        <div className="request-list">
          {filtered.map(req => {
            const expiry = getExpiryInfo(req);
            return (
              <div key={req.id} className="request-card-link-wrapper" style={{ position: 'relative' }}>
                <button
                  className={`bookmark-btn-overlay ${isBookmarked(req.id) ? 'active' : ''}`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(req.id); }}
                  title={isBookmarked(req.id) ? 'Remove bookmark' : 'Save request'}
                  style={{
                    position: 'absolute', top: '16px', right: '16px', zIndex: 10,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 'var(--radius-sm)', padding: '6px', fontSize: '1.2rem',
                    cursor: 'pointer', transition: 'all 0.2s',
                    color: isBookmarked(req.id) ? 'var(--accent-primary)' : 'var(--text-muted)'
                  }}
                >
                  {isBookmarked(req.id) ? '🔖' : '🔖'}
                </button>
                <Link to={`/request/${req.id}`} key={req.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="request-card" data-urgency={expiry?.expired ? undefined : req.urgency}>
                    <div className="request-header" style={{ paddingRight: '40px' }}>
                      <div>
                        <div className="request-title">{req.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          by {req.requester?.fullName || 'Anonymous'} 
                          <VerificationBadge level={req.requester?.verificationLevel || (req.requester?.verified ? 'VERIFIED' : 'BASIC')} size="sm" />
                          • {timeAgo(req.createdAtEpochMs || req.createdAt)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {expiry?.expired ? (
                          <span className="badge badge-expired">EXPIRED</span>
                        ) : (
                          <span className={`badge ${URGENCY_CLASS[req.urgency] || ''}`}>{req.urgency}</span>
                        )}
                        <span className="badge badge-category">{CATEGORY_ICONS[req.category] || ''} {req.category?.replace('_', ' ')}</span>
                        {req.category === 'BLOOD_DONATION' && req.requiredBloodGroup && (
                          <span className="badge" style={{ background: 'var(--danger-color)', color: 'white', fontWeight: 'bold' }}>
                            🩸 {req.requiredBloodGroup} Required
                          </span>
                        )}
                        {req.requiredSkill && (
                          <span className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(59,130,246,0.3)', fontWeight: '600' }}>
                            🎯 {req.requiredSkill.charAt(0) + req.requiredSkill.slice(1).toLowerCase()} Required
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="request-desc">{req.description}</div>
                    <div className="request-meta">
                      {req.address && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>📍 {req.address}</span>}
                      {req.community && <span style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)' }}>🏘️ {req.community.name}</span>}
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                        👁️ {(req.viewCount ?? req.views ?? 0)} views
                      </span>
                    </div>
                    {req.aiSummary && (
                      <div style={{ padding: '8px 12px', background: 'rgba(99,102,241,0.05)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--accent-primary)', border: '1px solid rgba(99,102,241,0.1)', marginBottom: '12px' }}>
                        🤖 {req.aiSummary}
                      </div>
                    )}
                    <div className="request-card-actions-row" style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                      <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                        🤝 I Can Help
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => shareRequest(req, e)}
                        title="Share request"
                        style={{ padding: '0 12px' }}
                      >
                        📤 Share
                      </button>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* SOS Floating Button */}
      <button className="sos-float-btn" onClick={() => setShowSOS(true)} title="Send SOS Emergency">
        SOS
      </button>

      {/* SOS Modal */}
      {showSOS && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSOS(false); }}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, color: '#ef4444' }}>🚨 Emergency SOS</h2>
              <button className="btn btn-icon btn-secondary" onClick={() => setShowSOS(false)}>✕</button>
            </div>

            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: '0.88rem', color: '#ef4444' }}>
              ⚠️ This will create a <strong>CRITICAL EMERGENCY</strong> request and immediately notify <strong>ALL online volunteers</strong> in your community.
            </div>

            <form onSubmit={handleSOS}>
              <div className="form-group">
                <label className="form-label">Brief Description *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., Building fire, Medical emergency, Accident..."
                  value={sosDesc}
                  onChange={(e) => setSosDesc(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                📍 Your current GPS location will be auto-detected and shared.
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSOS(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger" disabled={sosLoading} style={{ background: '#ef4444', color: 'white', border: 'none' }}>
                  {sosLoading ? 'Sending...' : '🚨 Send SOS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
