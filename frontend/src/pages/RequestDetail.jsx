// FEATURE: Request Detail + Comments + Status Tracking + Rating + Bookmark + Share
import { useState, useEffect, useCallback, Fragment } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import apiService from '../services/api';
import useBookmarks from '../hooks/useBookmarks';
import ShareDropdown from '../components/ShareDropdown';
import { timeAgo } from '../utils/timeUtils';
import VolunteerNavigationMap from '../components/volunteer/VolunteerNavigationMap';

const URGENCY_CLASS = { CRITICAL: 'badge-critical', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };
const STATUS_CLASS = { OPEN: 'badge-status-open', ACCEPTED: 'badge-status-accepted', ACTIVE: 'badge-status-accepted', COMPLETED: 'badge-status-completed', CANCELLED: 'badge-status-cancelled' };
const CATEGORY_ICONS = { BLOOD_DONATION: '🩸', MEDICAL: '🏥', FOOD: '🍲', TRANSPORT: '🚗', EMERGENCY: '🚨', GENERAL: '📋' };

const STATUS_STEPS = [
  { key: 'ASSIGNED', label: 'Assigned', icon: '✓' },
  { key: 'ON_THE_WAY', label: 'On the Way', icon: '🚗' },
  { key: 'REACHED', label: 'Reached', icon: '📍' },
  { key: 'COMPLETED', label: 'Completed', icon: '✅' },
];

const EVENT_META = {
  REQUEST_RAISED: { icon: '🚀', label: 'Request Raised', color: 'gray' },
  VOLUNTEER_NOTIFIED: { icon: '🔔', label: 'Volunteers Notified', color: 'gray' },
  VOLUNTEER_ACCEPTED: { icon: '🤝', label: 'Volunteer Accepted', color: 'green' },
  ON_THE_WAY: { icon: '🚗', label: 'On the Way', color: 'green' },
  REACHED: { icon: '📍', label: 'Reached Location', color: 'green' },
  COMPLETED: { icon: '✅', label: 'Request Completed', color: 'green' },
  EXPIRED: { icon: '⏲️', label: 'Request Expired', color: 'red' },
  CANCELLED: { icon: '❌', label: 'Request Cancelled', color: 'red' },
};

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { notifyRequestAccepted, notifyRequestCompleted, notifyPoints } = useNotifications();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const [toast, setToast] = useState(null);
  const [activeMapRequest, setActiveMapRequest] = useState(null);

  // Comments
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // Rating
  const [showRating, setShowRating] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  
  // AI Suggestions
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { loadRequest(); }, [id]);

  const loadRequest = async () => {
    try {
      const res = await apiService.getRequestById(id);
      setRequest(res.data);

      // Check if rating pending
      if (res.data.requesterRatingPending && !res.data.requesterRated && res.data.requester?.id === user?.userId) {
        setShowRating(true);
      }

      // Load mock comments
      setComments(getMockComments(id));
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to load request', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (request && user?.isVolunteer && request.status === 'OPEN' && !isRequester) {
      loadAiSuggestion();
    }
  }, [request?.id, user?.userId]);

  const loadAiSuggestion = async () => {
    setAiLoading(true);
    try {
      const res = await apiService.ai.getResponseSuggestion(request, user);
      setAiSuggestion(res.data);
    } catch (err) {
      console.warn('AI suggestion failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const useAiSuggestion = () => {
    if (aiSuggestion) {
      setNewComment(aiSuggestion.volunteer_message);
      showToast('AI suggestion copied to comment box!');
    }
  };

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Mock comments
  function getMockComments(reqId) {
    const stored = sessionStorage.getItem(`comments_${reqId}`);
    if (stored) return JSON.parse(stored);
    const defaults = [
      { id: 1, text: 'I can help with this! Contact me.', author: 'Sneha Gupta', time: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, text: 'Is the situation still ongoing? I am nearby.', author: 'Vikram Singh', time: new Date(Date.now() - 1800000).toISOString() },
    ];
    return defaults;
  }

  function saveComments(reqId, list) {
    sessionStorage.setItem(`comments_${reqId}`, JSON.stringify(list));
  }

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const comment = {
      id: Date.now(),
      text: newComment.trim(),
      author: user?.fullName || 'You',
      time: new Date().toISOString(),
    };
    const updated = [...comments, comment];
    setComments(updated);
    saveComments(id, updated);
    setNewComment('');
    showToast('Comment posted!');
  };

  const handleAccept = async () => {
    if (!user?.isVolunteer) {
      showToast('Enable volunteer mode to accept this request.', 'error');
      navigate('/volunteer/settings');
      return;
    }
    try {
      await apiService.acceptRequest(id, user);
      showToast('Request accepted! Thank you for volunteering! 🎉');
      notifyRequestAccepted(request, user.fullName);
      notifyPoints(10, 'accepting a help request');
      setActiveMapRequest(request);
      loadRequest();
    } catch (err) {
      showToast(err.message || 'Failed to accept', 'error');
    }
  };

  const handleComplete = async () => {
    try {
      await apiService.completeRequest(id);
      showToast('Request marked as completed! +50 points earned! 🏆');
      notifyRequestCompleted(request);
      notifyPoints(50, 'completing a help request');
      loadRequest();
    } catch (err) {
      showToast(err.message || 'Failed to complete', 'error');
    }
  };

  const handleCancel = async () => {
    try {
      await apiService.cancelRequest(id);
      showToast('Request cancelled.');
      loadRequest();
    } catch (err) {
      showToast(err.message || 'Failed to cancel', 'error');
    }
  };

  const handleSubmitRating = async () => {
    if (rating === 0) { showToast('Please select a rating', 'error'); return; }
    setRatingLoading(true);
    try {
      await apiService.rateVolunteer({
        requestId: request.id,
        volunteerId: request.volunteer?.id,
        rating,
        feedback: ratingFeedback,
      }, user?.userId);
      showToast('Rating submitted! Thank you! ⭐');
      setShowRating(false);
      loadRequest();
    } catch (err) {
      showToast(err.message || 'Failed to submit rating', 'error');
    } finally {
      setRatingLoading(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!request) return <div className="empty-state"><h3>Request not found</h3></div>;

  const isRequester = String(request.requester?.id) === String(user?.userId);
  const isVolunteer = String(request.volunteer?.id) === String(user?.userId);
  const displayStatus = request.status === 'ACCEPTED' ? 'ACTIVE' : request.status;
  const currentProgress = request.volunteerProgressStatus || (request.status === 'ACTIVE' ? 'ASSIGNED' : null);

  return (
    <div className="animate-in">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {activeMapRequest && (
        <VolunteerNavigationMap
          request={activeMapRequest}
          onClose={() => setActiveMapRequest(null)}
          onArrived={async (reqId) => {
            setActiveMapRequest(null);
            try {
              await apiService.updateVolunteerRequestStatus(reqId, 'REACHED', user);
              showToast('Status updated to REACHED!');
              loadRequest();
            } catch(e) {
              showToast('Could not update status to REACHED', 'error');
            }
          }}
        />
      )}

      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: '20px' }}>
        ← Back
      </button>

      {/* Volunteer Status Tracking Banner (for requester) */}
      {request.volunteer && (displayStatus === 'ACTIVE' || displayStatus === 'COMPLETED') && (
        <div className="status-tracking-banner">
          <h3>🎉 {displayStatus === 'COMPLETED' ? 'Request Completed!' : 'Volunteer Found!'}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div className="profile-avatar" style={{ width: '40px', height: '40px', fontSize: '1rem', background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
              {request.volunteer?.fullName?.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{request.volunteer?.fullName}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                ⭐ {request.volunteer?.rating?.toFixed(1) || '5.0'} rating
                {request.volunteer?.badge && ` • ${request.volunteer.badge}`}
              </div>
            </div>
          </div>
          {currentProgress && (
            <div className="status-steps">
              {STATUS_STEPS.map((step, idx) => {
                const stepIdx = STATUS_STEPS.findIndex(s => s.key === currentProgress);
                const isCompleted = idx < stepIdx;
                const isActive = idx === stepIdx;
                return (
                  <Fragment key={step.key}>
                    {idx > 0 && <div className={`status-step-line ${idx <= stepIdx ? 'completed' : ''}`} />}
                    <div className={`status-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                      <div className="status-step-dot">{isCompleted || isActive ? step.icon : idx + 1}</div>
                      <div className="status-step-label">{step.label}</div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="request-detail-grid">
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span className={`badge ${URGENCY_CLASS[request.urgency]}`}>{request.urgency}</span>
              <span className={`badge ${STATUS_CLASS[displayStatus]}`}>{displayStatus}</span>
              <span className="badge badge-category">{CATEGORY_ICONS[request.category]} {request.category?.replace('_', ' ')}</span>
              {request.category === 'BLOOD_DONATION' && request.requiredBloodGroup && (
                <span className="badge" style={{ background: 'var(--danger-color)', color: 'white', fontWeight: 'bold' }}>
                  🩸 {request.requiredBloodGroup} Required
                </span>
              )}
              {request.verificationStatus === 'FLAGGED' ? (
                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid currentColor' }}>
                  ⚠️ Flagged for Review
                </span>
              ) : request.verificationStatus === 'VERIFIED' || request.ocrVerified ? (
                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid currentColor' }}>
                  ✅ Verified Medical Request
                </span>
              ) : null}
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px' }}>{request.title}</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '1rem', marginBottom: '24px' }}>{request.description}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>📍 Location</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{request.address || 'Not specified'}</div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>📞 Contact</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{request.contactPhone || 'Not specified'}</div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>👁️ Views</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{request.viewCount} views • {request.responseCount} responses</div>
              </div>
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>🕐 Posted</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{request.createdAt ? new Date(request.createdAt).toLocaleString() : '-'}</div>
              </div>
            </div>
          </div>

          {request.aiSummary && (
            <div className="card" style={{ marginBottom: '20px', border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.03)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-primary)' }}>🤖 AI Analysis</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '12px' }}>{request.aiSummary}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                {request.aiCategory && <span className="badge badge-category">AI Category: {request.aiCategory}</span>}
                {request.aiUrgency && <span className={`badge ${URGENCY_CLASS[request.aiUrgency]}`}>AI Urgency: {request.aiUrgency}</span>}
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="card comments-section">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>💬 Comments & Responses ({comments.length})</h3>
            <div className="comment-list">
              {comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No comments yet. Be the first to respond!
                </div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="comment-item">
                    <div className="comment-avatar">{c.author?.charAt(0) || '?'}</div>
                    <div className="comment-content">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                        <span className="comment-author">{c.author}</span>
                        <span className="comment-time">{timeAgo(c.time)}</span>
                      </div>
                      <div className="comment-text">{c.text}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form className="comment-form" onSubmit={handleAddComment}>
              <input
                type="text"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm">Post</button>
            </form>
          </div>

          {/* Timeline */}
          <div className="card" style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>📋 Activity Timeline</h3>
              {request.status === 'COMPLETED' && request.totalResponseTimeMinutes && (
                <div className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', padding: '4px 12px' }}>
                  Total Response Time: <strong>{request.totalResponseTimeMinutes} minutes</strong>
                </div>
              )}
            </div>

            <div className="timeline-container" style={{ position: 'relative', paddingLeft: '32px' }}>
              {/* Vertical Line */}
              <div style={{ 
                position: 'absolute', 
                left: '7px', 
                top: '10px', 
                bottom: '10px', 
                width: '2px', 
                background: 'rgba(255,255,255,0.05)' 
              }} />

              {(request.timeline || []).length === 0 ? (
                <div style={{ padding: '8px 0', color: 'var(--text-muted)' }}>No activity recorded yet.</div>
              ) : (
                request.timeline.map((entry, idx) => {
                  const meta = EVENT_META[entry.event] || { icon: '•', label: entry.event, color: 'gray' };
                  const colorMap = {
                    green: '#10b981',
                    red: '#ef4444',
                    blue: '#3b82f6',
                    gray: 'var(--text-muted)'
                  };

                  return (
                    <div key={idx} style={{ position: 'relative', marginBottom: '24px' }}>
                      {/* Dot */}
                      <div style={{ 
                        position: 'absolute', 
                        left: '-32px', 
                        top: '4px', 
                        width: '16px', 
                        height: '16px', 
                        borderRadius: '50%', 
                        background: 'var(--card-bg)', 
                        border: `3px solid ${colorMap[meta.color]}`,
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px'
                      }} />

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '1.1rem' }}>{meta.icon}</span>
                            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{meta.label}</span>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {entry.actorName && (
                              <span style={{ 
                                color: meta.color === 'gray' ? 'var(--text-muted)' : colorMap[meta.color],
                                fontWeight: 500 
                              }}>
                                {entry.actorName}
                              </span>
                            )}
                            {entry.actorName && ' • '}
                            <span>{new Date(entry.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '4px' }}>
                          {timeAgo(entry.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Requester</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="profile-avatar" style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}>
                {request.requester?.fullName?.charAt(0) || '?'}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{request.requester?.fullName || 'Anonymous'}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>⭐ {request.requester?.rating?.toFixed(1) || '5.0'} rating</div>
              </div>
            </div>
          </div>

          {request.volunteer && (
            <div className="card" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Volunteer</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="profile-avatar" style={{ width: '48px', height: '48px', fontSize: '1.2rem', background: 'linear-gradient(135deg, #10b981, #06b6d4)' }}>
                  {request.volunteer?.fullName?.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{request.volunteer?.fullName}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    ⭐ {request.volunteer?.rating?.toFixed(1) || '5.0'} rating
                    {request.volunteer?.badge && (
                      <span style={{ marginLeft: '8px', padding: '2px 8px', background: 'rgba(16,185,129,0.15)', borderRadius: 'var(--radius-full)', fontSize: '0.75rem', color: '#10b981' }}>
                        {request.volunteer.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {request.community && (
            <div className="card" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Community</h3>
              <div style={{ fontWeight: 600 }}>🏘️ {request.community.name}</div>
            </div>
          )}

          <div className="card" style={{ borderColor: 'var(--border-active)' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Bookmark & Share */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                <button
                  className={`btn btn-sm ${isBookmarked(request.id) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => toggleBookmark(request.id)}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {isBookmarked(request.id) ? '🔖 Saved' : '🔖 Save'}
                </button>
                <ShareDropdown request={request} />
              </div>

              {request.status === 'OPEN' && !isRequester && user?.isVolunteer && aiSuggestion && (
                <div className="card" style={{ padding: '12px', background: 'rgba(99,102,241,0.05)', border: '1px solid var(--accent-primary)', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ✨ Response Assistant
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '12px', lineHeight: 1.5 }}>
                    "{aiSuggestion.volunteer_message}"
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.7rem', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                      🕒 Reach in {aiSuggestion.estimated_time_to_reach}
                    </div>
                    {aiSuggestion.safety_tips?.slice(0, 1).map((tip, i) => (
                      <div key={i} style={{ fontSize: '0.7rem', background: 'rgba(239,68,68,0.05)', padding: '2px 8px', borderRadius: '4px', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.1)' }}>
                        ⚠️ {tip}
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={useAiSuggestion} style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}>
                    Use this Message
                  </button>
                </div>
              )}

              {request.status === 'OPEN' && !isRequester && user?.isVolunteer && (
                <button className="btn btn-primary" onClick={handleAccept} style={{ width: '100%', justifyContent: 'center' }}>
                  🙋 I Can Help
                </button>
              )}
              {request.status === 'OPEN' && !isRequester && !user?.isVolunteer && (
                <>
                  <Link to="/volunteer/settings" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    Enable Volunteer Mode
                  </Link>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Turn on volunteer mode first, then come back here to accept this request.
                  </div>
                </>
              )}
              {(displayStatus === 'ACTIVE') && isVolunteer && request.volunteerProgressStatus !== 'COMPLETED' && request.latitude && request.longitude && (
                <button className="btn btn-primary" onClick={() => setActiveMapRequest(request)} style={{ width: '100%', justifyContent: 'center' }}>
                  📍 Show Navigation Map
                </button>
              )}
              {(displayStatus === 'ACTIVE') && (isRequester || isVolunteer) && (
                <button className="btn btn-success" onClick={handleComplete} style={{ width: '100%', justifyContent: 'center' }}>
                  ✅ Mark as Completed
                </button>
              )}
              {(request.status === 'OPEN' || displayStatus === 'ACTIVE') && isRequester && (
                <button className="btn btn-danger" onClick={handleCancel} style={{ width: '100%', justifyContent: 'center' }}>
                  ❌ Cancel Request
                </button>
              )}
              {request.status === 'COMPLETED' && (
                <div style={{ textAlign: 'center', padding: '12px', color: 'var(--success)', fontWeight: 600 }}>
                  ✅ This request has been completed
                </div>
              )}
              {request.status === 'CANCELLED' && (
                <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  This request was cancelled
                </div>
              )}
            </div>
          </div>

          {/* Rating Result */}
          {request.volunteerRating && (
            <div className="card" style={{ marginTop: '16px', border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', color: '#10b981' }}>⭐ Volunteer Rating</h3>
              <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{'⭐'.repeat(request.volunteerRating)}</div>
              {request.volunteerFeedback && (
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>"{request.volunteerFeedback}"</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rating Modal */}
      {showRating && request.status === 'COMPLETED' && isRequester && !request.requesterRated && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRating(false); }}>
          <div className="modal" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: '8px' }}>⭐ Rate Your Volunteer</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
              How was your experience with <strong>{request.volunteer?.fullName}</strong>?
            </p>

            <div className="rating-stars">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  className={`rating-star ${star <= rating ? 'active' : ''}`}
                  onClick={() => setRating(star)}
                  type="button"
                >
                  ⭐
                </button>
              ))}
            </div>

            <div className="form-group">
              <textarea
                className="form-textarea"
                placeholder="Optional feedback..."
                value={ratingFeedback}
                onChange={(e) => setRatingFeedback(e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setShowRating(false)}>Skip</button>
              <button className="btn btn-primary" onClick={handleSubmitRating} disabled={ratingLoading}>
                {ratingLoading ? 'Submitting...' : '✨ Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
