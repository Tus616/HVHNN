import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import apiService from '../services/api';
import VerificationBadge from '../components/VerificationBadge';

/* ─── helpers ─── */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COLORS = {
  OPEN: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Open' },
  ACCEPTED: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'In Progress' },
  PENDING: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Pending' },
  COMPLETED: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Resolved' },
  CLOSED: { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Closed' },
};

export default function CommunityDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifyRequestAccepted, notifyPoints } = useNotifications();

  /* ─── state ─── */
  const [community, setCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isJoined, setIsJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');
  const [toast, setToast] = useState(null);

  // Request modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newRequest, setNewRequest] = useState({ title: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Join modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  // Actions
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Message modal
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageTo, setMessageTo] = useState(null);
  const [messageText, setMessageText] = useState('');

  const userId = user?.userId || user?.id;
  const isOwnerOrAdmin = user?.isAdmin || user?.role === 'ADMIN';

  /* ─── load ─── */
  useEffect(() => { loadCommunityData(); }, [id, userId]);

  function showToast(msg, type = 'success') {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadCommunityData() {
    try {
      const [commRes, joinedRes] = await Promise.all([
        apiService.getCommunities(),
        apiService.getJoinedCommunities(userId),
      ]);

      const found = (commRes.data || []).find(c => String(c.id) === String(id));
      setCommunity(found || null);

      const joinedIds = (joinedRes.data || []).map(String);
      setIsJoined(joinedIds.includes(String(id)));

      // Load members & requests (backend endpoints)
      try {
        const membersRes = await apiService.getCommunityMembers(id);
        setMembers(membersRes.data || []);
      } catch { setMembers([]); }

      try {
        const reqRes = await apiService.getCommunityRequests(id);
        setRequests(reqRes.data || []);
      } catch { setRequests([]); }

    } catch (err) {
      console.error('Failed to load community:', err);
    } finally {
      setLoading(false);
    }
  }

  /* ─── handlers ─── */
  async function handleJoin(e) {
    if (e) e.preventDefault();
    setIsJoining(true);
    try {
      await apiService.joinCommunity(id, joinCode, userId);
      showToast(`Welcome to ${community.name}!`);
      setShowJoinModal(false);
      setJoinCode('');
      loadCommunityData();
    } catch (err) {
      showToast(err.message || 'Failed to join community', 'error');
    } finally { setIsJoining(false); }
  }

  async function handleLeave() {
    if (!window.confirm(`Are you sure you want to leave ${community.name}?`)) return;
    setIsLeaving(true);
    try {
      await apiService.leaveCommunity(id, userId);
      showToast(`You have left ${community.name}`);
      navigate('/communities');
    } catch (err) {
      showToast(err.message || 'Failed to leave', 'error');
    } finally { setIsLeaving(false); }
  }

  async function handleDelete() {
    if (!window.confirm(`PERMANENT: Delete ${community.name} and all its data?`)) return;
    setIsDeleting(true);
    try {
      await apiService.deleteCommunity(id);
      showToast(`"${community.name}" deleted`);
      navigate('/communities');
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error');
    } finally { setIsDeleting(false); }
  }

  function handleRaiseRequest(e) {
    if (e) e.preventDefault();
    navigate(`/create?communityId=${id}`);
  }

  function handleMessageMember(member) {
    setMessageTo(member);
    setMessageText('');
    setShowMessageModal(true);
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!messageText.trim() || !messageTo) return;
    try {
      // Create a chat room and navigate to messages
      await apiService.createDirectChatRoom({
        participantId: messageTo.userId || messageTo.id
      });
      showToast(`Message sent to ${messageTo.fullName || 'member'}!`);
      setShowMessageModal(false);
      navigate('/chats');
    } catch (err) {
      showToast(err.message || 'Failed to send message', 'error');
    }
  }

  /* ─── render ─── */
  if (loading) {
    return (
      <div className="cd-loading">
        <div className="spinner" />
        <p>Loading community...</p>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="cd-empty">
        <div className="cd-empty-icon">🏘️</div>
        <h2>Community not found</h2>
        <p>This community may have been deleted or doesn't exist.</p>
        <Link to="/communities" className="btn btn-primary">Back to Communities</Link>
      </div>
    );
  }

  const reqArr = Array.isArray(requests) ? requests : [];
  const openCount = reqArr.filter(r => r.status === 'OPEN' || r.status === 'PENDING').length;
  const resolvedCount = reqArr.filter(r => r.status === 'COMPLETED' || r.status === 'CLOSED').length;

  // Find admin from members list
  const memberArr = Array.isArray(members) ? members : [];
  const adminMember = memberArr.find(m => m.role === 'ADMIN') || memberArr[0];

  return (
    <div className="cd-page animate-in">
      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Back button */}
      <button className="cd-back-btn" onClick={() => navigate('/communities')}>
        ← Back to Communities
      </button>

      <div className="cd-layout">
        {/* ───────── SIDEBAR ───────── */}
        <aside className="cd-sidebar">
          {/* Community Info Card */}
          <div className="cd-sidebar-card">
            <div className="cd-sidebar-avatar">
              {community.name?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <h2 className="cd-sidebar-name">{community.name}</h2>
            <span className="cd-sidebar-category">{community.category || community.type || 'Community'}</span>
            <p className="cd-sidebar-desc">{community.description || 'No description provided.'}</p>

            <div className="cd-sidebar-meta">
              {community.location && (
                <div className="cd-sidebar-meta-item">
                  <span className="cd-meta-icon">📍</span>
                  <span>{community.location}</span>
                </div>
              )}
              <div className="cd-sidebar-meta-item">
                <span className="cd-meta-icon">👥</span>
                <span>{community.memberCount || memberArr.length} members</span>
              </div>
              <div className="cd-sidebar-meta-item">
                <span className="cd-meta-icon">📋</span>
                <span>{reqArr.length} requests</span>
              </div>
              {community.createdAt && (
                <div className="cd-sidebar-meta-item">
                  <span className="cd-meta-icon">📅</span>
                  <span>Created {timeAgo(community.createdAt)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Admin Info */}
          {adminMember && (
            <div className="cd-sidebar-card">
              <div className="cd-sidebar-section-title">👑 Community Admin</div>
              <div className="cd-admin-row">
                <div className="cd-admin-avatar">
                  {adminMember.fullName?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div>
                  <div className="cd-admin-name">{adminMember.fullName || 'Admin'}</div>
                  <div className="cd-admin-role">{adminMember.role || 'ADMIN'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="cd-sidebar-card">
            <div className="cd-sidebar-section-title">📊 Quick Stats</div>
            <div className="cd-stats-grid">
              <div className="cd-stat">
                <div className="cd-stat-value cd-stat-blue">{openCount}</div>
                <div className="cd-stat-label">Open</div>
              </div>
              <div className="cd-stat">
                <div className="cd-stat-value cd-stat-green">{resolvedCount}</div>
                <div className="cd-stat-label">Resolved</div>
              </div>
              <div className="cd-stat">
                <div className="cd-stat-value">{memberArr.length}</div>
                <div className="cd-stat-label">Members</div>
              </div>
              <div className="cd-stat">
                <div className="cd-stat-value cd-stat-amber">{reqArr.length - openCount - resolvedCount}</div>
                <div className="cd-stat-label">In Progress</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="cd-sidebar-card cd-sidebar-actions">
            {!isJoined ? (
              <button
                className="btn btn-primary cd-action-btn"
                onClick={() => community.hasJoinCode ? setShowJoinModal(true) : handleJoin()}
                disabled={isJoining}
              >
                {isJoining ? 'Joining...' : '🚀 Join Community'}
              </button>
            ) : (
              <>
                <button
                  className="btn btn-primary cd-action-btn"
                  onClick={handleRaiseRequest}
                >
                  ✋ Raise Request
                </button>
                <button
                  className="cd-leave-btn"
                  onClick={handleLeave}
                  disabled={isLeaving}
                >
                  {isLeaving ? 'Leaving...' : '🚪 Leave Community'}
                </button>
                {isOwnerOrAdmin && (
                  <button
                    className="cd-delete-btn"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : '🗑️ Delete Community'}
                  </button>
                )}
              </>
            )}
          </div>
        </aside>

        {/* ───────── MAIN CONTENT ───────── */}
        <main className="cd-main">
          {/* Tabs */}
          <div className="cd-tabs">
            <button
              className={`cd-tab ${activeTab === 'requests' ? 'cd-tab-active' : ''}`}
              onClick={() => setActiveTab('requests')}
            >
              📋 Requests <span className="cd-tab-count">{reqArr.length}</span>
            </button>
            <button
              className={`cd-tab ${activeTab === 'members' ? 'cd-tab-active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              👥 Members <span className="cd-tab-count">{memberArr.length}</span>
            </button>
          </div>

          {/* ─── REQUESTS TAB ─── */}
          {activeTab === 'requests' && (
            <div className="cd-content animate-in">
              {/* Header row */}
              <div className="cd-content-header">
                <div>
                  <h3 className="cd-content-title">Community Requests</h3>
                  <p className="cd-content-subtitle">All help requests raised by members</p>
                </div>
                {isJoined && (
                  <button className="btn btn-primary" onClick={handleRaiseRequest}>
                    + Raise Request
                  </button>
                )}
              </div>

              {reqArr.length === 0 ? (
                <div className="cd-empty-tab">
                  <div className="cd-empty-tab-icon">📋</div>
                  <h4>No requests yet</h4>
                  <p>Be the first to raise a help request in this community.</p>
                  {isJoined && (
                    <button className="btn btn-primary" onClick={handleRaiseRequest}>
                      Raise Request
                    </button>
                  )}
                </div>
              ) : (
                <div className="cd-request-list">
                  {reqArr.map(req => {
                    const status = STATUS_COLORS[req.status] || STATUS_COLORS.OPEN;
                    // Try to get requester name from members list
                    const requester = memberArr.find(m => m.userId === req.requestedBy);
                    const requesterName = req.requesterName || requester?.fullName || 'Community Member';
                    return (
                      <div key={req.id} className="cd-request-card">
                        <div className="cd-request-top">
                          <h4 className="cd-request-title">{req.title}</h4>
                          <span
                            className="cd-request-status"
                            style={{ background: status.bg, color: status.color }}
                          >
                            {status.label}
                          </span>
                        </div>
                        <p className="cd-request-desc">{req.description}</p>
                        <div className="cd-request-footer">
                          <div className="cd-request-author">
                            <div className="cd-request-author-avatar">
                              {requesterName.charAt(0).toUpperCase()}
                            </div>
                            <span>by <strong>{requesterName}</strong></span>
                          </div>
                          <span className="cd-request-time">{timeAgo(req.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── MEMBERS TAB ─── */}
          {activeTab === 'members' && (
            <div className="cd-content animate-in">
              <div className="cd-content-header">
                <div>
                  <h3 className="cd-content-title">Community Members</h3>
                  <p className="cd-content-subtitle">{memberArr.length} members in this community</p>
                </div>
              </div>

              {memberArr.length === 0 ? (
                <div className="cd-empty-tab">
                  <div className="cd-empty-tab-icon">👥</div>
                  <h4>No members yet</h4>
                  <p>Members who join this community will appear here.</p>
                </div>
              ) : (
                <div className="cd-member-grid">
                  {memberArr.map(member => (
                    <div key={member.id} className="cd-member-card">
                      <div className="cd-member-top">
                        <div className="cd-member-avatar">
                          {member.profileImage ? (
                            <img src={member.profileImage} alt={member.fullName} />
                          ) : (
                            member.fullName?.charAt(0)?.toUpperCase() || 'M'
                          )}
                        </div>
                        <div className="cd-member-info">
                          <div className="cd-member-name-row">
                            <h4 className="cd-member-name">{member.fullName || 'Member'}</h4>
                            {member.verificationLevel && member.verificationLevel !== 'BASIC' && (
                              <VerificationBadge level={member.verificationLevel} size="sm" />
                            )}
                          </div>
                          <span className="cd-member-role-badge" data-role={member.role}>
                            {member.role || 'MEMBER'}
                          </span>
                        </div>
                      </div>
                      {member.joinedAt && (
                        <div className="cd-member-joined">Joined {timeAgo(member.joinedAt)}</div>
                      )}
                      {isJoined && user && member.userId !== user.userId && (
                        <button
                          className="cd-message-btn"
                          onClick={() => handleMessageMember(member)}
                        >
                          💬 Message Member
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ───────── MODALS ───────── */}


      {/* Join Community Modal */}
      {showJoinModal && (
        <div className="cd-modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="cd-modal cd-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h3>🔑 Join {community.name}</h3>
              <button className="cd-modal-close" onClick={() => setShowJoinModal(false)}>✕</button>
            </div>
            <form onSubmit={handleJoin} className="cd-modal-body">
              <p className="cd-modal-note">This community requires a join code to enter.</p>
              <div className="cd-form-group">
                <label className="cd-form-label">Join Code</label>
                <input
                  type="text"
                  className="cd-form-input"
                  placeholder="Enter community code"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="cd-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowJoinModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isJoining}>
                  {isJoining ? 'Verifying...' : 'Verify & Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {showMessageModal && messageTo && (
        <div className="cd-modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="cd-modal cd-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="cd-modal-header">
              <h3>💬 Message {messageTo.fullName}</h3>
              <button className="cd-modal-close" onClick={() => setShowMessageModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSendMessage} className="cd-modal-body">
              <div className="cd-form-group">
                <label className="cd-form-label">Your Message</label>
                <textarea
                  className="cd-form-textarea"
                  placeholder={`Say hi to ${messageTo.fullName}...`}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  required
                  rows={3}
                  autoFocus
                />
              </div>
              <div className="cd-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMessageModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Send Message</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
