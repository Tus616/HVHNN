// FEATURE: Community Sidebar (Phase 6 Expansion)
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import apiService from '../services/api';

export default function CommunitySidebar({ community, members, requests, isJoined, isOwnerOrAdmin, onUpdate }) {
  const { user } = useAuth();
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/communities?joinCode=${community.verificationCode || ''}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      showToast('Invite link copied!');
    } else {
      showToast('Sharing not supported on this browser', 'error');
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setBroadcasting(true);
    try {
      await apiService.broadcastMessage(community.id, broadcastMsg);
      showToast('Broadcast sent successfully!');
      setBroadcastMsg('');
    } catch (err) {
      showToast('Failed to send broadcast', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  const activeReqs = requests.filter(r => r.status === 'OPEN' || r.status === 'ACCEPTED').length;

  return (
    <aside className="community-sidebar card">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="community-section-eyebrow">Community Context</div>
      <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{community.name}</h3>
      <div className="community-chip-row" style={{ marginBottom: '16px' }}>
        <span className="badge badge-category">{community.type}</span>
        {isJoined && <span className="community-status-pill community-status-pill-success">Member</span>}
        {isOwnerOrAdmin && <span className="community-status-pill community-status-pill-neutral">Admin</span>}
      </div>

      <div className="sidebar-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
        <div className="sidebar-stat" style={{ background: 'var(--surface)' }}>
          <div className="sidebar-stat-value">{members.length}</div>
          <div className="sidebar-stat-label">Members</div>
        </div>
        <div className="sidebar-stat" style={{ background: 'var(--surface)' }}>
          <div className="sidebar-stat-value" style={{ color: 'var(--accent-primary)' }}>{activeReqs}</div>
          <div className="sidebar-stat-label">Active Reqs</div>
        </div>
      </div>

      <button className="btn btn-secondary" style={{ width: '100%', marginBottom: '24px' }} onClick={handleShare}>
        🔗 Copy Invite Link
      </button>

      {isOwnerOrAdmin && (
        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <div className="community-section-eyebrow" style={{ color: 'var(--accent-primary)', marginBottom: '12px' }}>Admin Controls</div>
          
          <Link to={`/community/${community.id}/manage`} className="btn btn-secondary btn-sm" style={{ width: '100%', marginBottom: '16px', justifyContent: 'center' }}>
            👥 Manage Members
          </Link>

          <h5>📣 Broadcast Message</h5>
          <form onSubmit={handleBroadcast} style={{ marginTop: '8px' }}>
            <textarea 
              className="form-textarea" 
              rows={3}
              placeholder="Send an urgent update to all members..."
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            />
            <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }} disabled={broadcasting}>
              {broadcasting ? 'Sending...' : 'Send Broadcast'}
            </button>
          </form>
        </div>
      )}

      {/* Mini Recent Activity */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', marginTop: '24px' }}>
        <div className="community-section-eyebrow">Recent Requests</div>
        {requests.slice(0, 3).map(r => (
          <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', fontSize: '0.85rem' }}>
            <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{r.title}</strong>
            <span style={{ color: 'var(--text-secondary)' }}>Status: {r.status}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
