import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';

export default function Leaderboard() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('ALL_TIME');

  useEffect(() => {
    loadLeaderboard();
  }, [timeRange]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await apiService.getLeaderboard(timeRange);
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const badgeIcon = { Hero: '🦸', Champion: '🏆', Helper: '🤝', Volunteer: '💪', Newcomer: '🌱' };
  const rankIcons = ['🥇', '🥈', '🥉'];
  
  const myRank = users.findIndex(u => u.id === user?.userId) + 1;
  const myData = users.find(u => u.id === user?.userId);

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>🏆 Community Leaderboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Top helpers making a difference this week</p>
        </div>
        <div className="feed-filters" style={{ margin: 0 }}>
          {['TODAY', 'WEEKLY', 'ALL_TIME'].map(range => (
            <button 
              key={range} 
              className={`filter-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {myData && (
        <div className="card" style={{ 
          marginBottom: '32px', 
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          padding: '20px 32px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Your Rank</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>#{myRank}</div>
          </div>
          <div className="profile-avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem' }}>
            {myData.fullName?.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{myData.fullName}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {myData.requestsHelped} requests helped • {myData.points} points
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="badge badge-category" style={{ fontSize: '0.9rem' }}>{badgeIcon[myData.badge]} {myData.badge}</div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--success)' }}>Keep helping to climb!</div>
          </div>
        </div>
      )}

      {/* Top 3 */}
      <div className="grid-3" style={{ marginBottom: '32px' }}>
        {users.slice(0, 3).map((u, i) => (
          <div key={u.id} className="stat-card" style={{ 
            position: 'relative',
            background: i === 0 ? 'rgba(245,158,11,0.05)' : 'var(--bg-card)',
            border: i === 0 ? '1px solid rgba(245,158,11,0.3)' : undefined 
          }}>
            <div style={{ position: 'absolute', top: '12px', left: '12px', fontSize: '1.5rem' }}>{rankIcons[i]}</div>
            <div className="profile-avatar" style={{ width: '64px', height: '64px', fontSize: '1.5rem', margin: '20px auto 12px' }}>
              {u.fullName?.charAt(0)}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{u.fullName}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{u.communityName || 'Independant'}</div>
            <div className="stat-value" style={{ fontSize: '2rem', margin: '8px 0', color: 'var(--text-primary)' }}>{u.points}</div>
            <div className="stat-label">Points</div>
            <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {u.requestsHelped} helped • ★ {u.rating?.toFixed(1) || 'New'}
            </div>
            <div style={{ marginTop: '12px' }}>
              <span className="badge badge-category" style={{ background: 'var(--bg-secondary)', padding: '4px 12px' }}>{badgeIcon[u.badge]} {u.badge}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Full Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th style={{ padding: '16px 24px' }}>Rank</th>
              <th>Name</th>
              <th>Community</th>
              <th>Badge</th>
              <th>Points</th>
              <th>Helped</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ background: u.id === user?.userId ? 'rgba(99, 102, 241, 0.05)' : undefined }}>
                <td className="rank" style={{ padding: '16px 24px' }}>{i < 3 ? rankIcons[i] : `#${i + 1}`}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="profile-avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                      {u.fullName?.charAt(0)}
                    </div>
                    <div>
                      <div className="user-name" style={{ fontWeight: u.id === user?.userId ? 700 : 500 }}>{u.fullName}</div>
                      {u.id === user?.userId && <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)' }}>You</div>}
                    </div>
                    {u.verified && <span style={{ color: 'var(--accent-secondary)', fontSize: '0.8rem' }}>✓</span>}
                  </div>
                </td>
                <td><span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{u.communityName || '—'}</span></td>
                <td><span className="badge badge-category" style={{ fontSize: '0.75rem' }}>{badgeIcon[u.badge]} {u.badge}</span></td>
                <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.points}</td>
                <td>{u.requestsHelped}</td>
                <td>{u.requestsHelped > 0 ? `★ ${u.rating?.toFixed(1)}` : 'New'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
