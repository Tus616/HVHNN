import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import apiService from '../services/api';

export default function CommunitiesSidebar() {
  const { user } = useAuth();
  const [joinedCommunities, setJoinedCommunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.userId) {
      apiService.getJoinedCommunities(user.userId)
        .then(res => setJoinedCommunities(res.data || []))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [user]);

  if (!user) return null;

  return (
    <aside className="app-sidebar" style={{ backgroundColor: 'var(--surface-50)' }}>
      {/* User Profile Hook */}
      <Link to="/profile" className="sidebar-profile-card">
        <div className="sidebar-avatar">
          {user.profileImage ? (
            <img src={user.profileImage} alt={user.fullName} />
          ) : (
            user.fullName?.charAt(0)?.toUpperCase() || 'U'
          )}
        </div>
        <div className="sidebar-profile-info">
          <div className="sidebar-profile-name">{user.fullName}</div>
          <div className="sidebar-profile-badge">Community Member</div>
        </div>
      </Link>

      {/* Quick Actions */}
      <div className="sidebar-section" style={{ marginTop: '20px' }}>
        <div className="sidebar-nav-label">Quick Actions</div>
        <button 
          className="btn btn-primary" 
          style={{ width: '100%', marginBottom: '10px', justifyContent: 'center' }}
          onClick={() => window.dispatchEvent(new CustomEvent('open-create-community'))}
        >
          ➕ Create Community
        </button>
        <button 
          className="btn btn-secondary" 
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => window.dispatchEvent(new CustomEvent('open-join-community'))}
        >
          🤝 Join Community
        </button>
      </div>

      <div className="sidebar-section" style={{ marginTop: '20px', flex: 1, overflowY: 'auto' }}>
        <div className="sidebar-nav-label">My Communities ({joinedCommunities.length})</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '10px' }}><div className="spinner" style={{ width: '20px', height: '20px' }}/></div>
        ) : joinedCommunities.length === 0 ? (
          <div style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)' }}>
            You haven't joined any communities yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {joinedCommunities.map(id => (
              <CommunityLinkLoader key={id} communityId={id} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function CommunityLinkLoader({ communityId }) {
  const [community, setCommunity] = useState(null);

  useEffect(() => {
    apiService.getCommunityDetail(communityId)
      .then(res => setCommunity(res.data))
      .catch(() => {});
  }, [communityId]);

  if (!community) return null;

  return (
    <Link to={`/community/${community.id}`} className="sidebar-nav-link" style={{ padding: '8px 12px' }}>
      <span className="sidebar-nav-icon">🏘️</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {community.name}
      </span>
    </Link>
  );
}
