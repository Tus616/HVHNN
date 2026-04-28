import { useState, useEffect } from 'react';
import apiService from '../services/api';
import VerificationBadge from '../components/VerificationBadge';

const URGENCY_CLASS = { CRITICAL: 'badge-critical', HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' };
const STATUS_CLASS = { OPEN: 'badge-status-open', ACCEPTED: 'badge-status-accepted', COMPLETED: 'badge-status-completed', CANCELLED: 'badge-status-cancelled', IN_PROGRESS: 'badge-status-accepted' };

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [pendingTrusted, setPendingTrusted] = useState([]);
  const [flaggedRequests, setFlaggedRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState(null);
  const [reviewingId, setReviewingId] = useState(null);

  useEffect(() => {
    Promise.all([
      apiService.getDashboardStats(),
      apiService.getAdminRequests(),
      apiService.getAdminUsers(),
      apiService.getPendingTrusted(),
      apiService.getFlaggedRequests(),
    ]).then(([statsRes, reqRes, usersRes, pendingRes, flaggedRes]) => {
      setStats(statsRes.data || null);
      setRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setPendingTrusted(Array.isArray(pendingRes.data) ? pendingRes.data : []);
      setFlaggedRequests(Array.isArray(flaggedRes.data) ? flaggedRes.data : []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function promoteToTrusted(userId) {
    setVerifyingId(userId);
    try {
      await apiService.promoteToTrusted(userId);
      const [usersRes, pendingRes] = await Promise.all([
        apiService.getAdminUsers(),
        apiService.getPendingTrusted()
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setPendingTrusted(Array.isArray(pendingRes.data) ? pendingRes.data : []);
    } catch (err) {
      console.error(err);
      alert('Failed to promote user: ' + err.message);
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleReviewRequest(requestId, status) {
    setReviewingId(requestId);
    try {
      await apiService.reviewRequest(requestId, status);
      const [statsRes, reqRes, flaggedRes] = await Promise.all([
        apiService.getDashboardStats(),
        apiService.getAdminRequests(),
        apiService.getFlaggedRequests()
      ]);
      setStats(statsRes.data || null);
      setRequests(Array.isArray(reqRes.data) ? reqRes.data : []);
      setFlaggedRequests(Array.isArray(flaggedRes.data) ? flaggedRes.data : []);
    } catch (err) {
      console.error(err);
      alert('Review failed: ' + err.message);
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1>📊 Admin Dashboard</h1>
      </div>

      {/* Tab Navigation */}
      <div className="feed-filters" style={{ marginBottom: '24px' }}>
        <button className={`filter-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📊 Overview
        </button>
        <button className={`filter-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
          📋 All Requests ({requests.length})
        </button>
        <button className={`filter-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
          👥 Users ({users.length})
        </button>
        <button className={`filter-btn ${activeTab === 'verification' ? 'active' : ''}`} onClick={() => setActiveTab('verification')}>
          🛡️ Trusted Review ({pendingTrusted.length})
        </button>
        <button className={`filter-btn ${activeTab === 'flagged' ? 'active' : ''}`} onClick={() => setActiveTab('flagged')}>
          🚩 Flagged/OCR ({flaggedRequests.length})
        </button>
      </div>

      {/* Overview */}
      {activeTab === 'overview' && stats && (
        <>
          <div className="dashboard-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalRequests}</div>
              <div className="stat-label">Total Requests</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)', WebkitBackgroundClip: 'text' }}>{stats.openRequests}</div>
              <div className="stat-label">Open</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', WebkitBackgroundClip: 'text' }}>{stats.completedRequests}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalUsers}</div>
              <div className="stat-label">Total Users</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', WebkitBackgroundClip: 'text' }}>{stats.totalVolunteers}</div>
              <div className="stat-label">Active Volunteers</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.totalCommunities}</div>
              <div className="stat-label">Communities</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>
                {stats.averageResponseTimeMinutes ? `${stats.averageResponseTimeMinutes}m` : '0m'}
              </div>
              <div className="stat-label">Avg. Response Time</div>
            </div>
            <div className="stat-card" style={{ border: stats.flaggedRequests > 0 ? '1px solid var(--danger)' : '' }}>
              <div className="stat-value" style={{ color: stats.flaggedRequests > 0 ? 'var(--danger)' : '' }}>
                {stats.flaggedRequests || 0}
              </div>
              <div className="stat-label">Flagged Calls</div>
            </div>
          </div>

          {/* Charts (text-based representation) */}
          <div className="grid-2">
            <div className="card">
              <h3 style={{ marginBottom: '20px', fontWeight: 700 }}>📊 Requests by Category</h3>
              {stats.requestsByCategory && Object.entries(stats.requestsByCategory).map(([cat, count]) => {
                const max = Math.max(...Object.values(stats.requestsByCategory));
                const pct = max > 0 ? (count / max * 100) : 0;
                return (
                  <div key={cat} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{cat.replace('_', ' ')}</span>
                      <span style={{ fontWeight: 600 }}>{count}</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-gradient)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card">
              <h3 style={{ marginBottom: '20px', fontWeight: 700 }}>📈 Requests by Status</h3>
              {stats.requestsByStatus && Object.entries(stats.requestsByStatus).map(([status, count]) => {
                const max = Math.max(...Object.values(stats.requestsByStatus));
                const pct = max > 0 ? (count / max * 100) : 0;
                const colors = { OPEN: '#3b82f6', ACCEPTED: '#f59e0b', COMPLETED: '#10b981', CANCELLED: '#6b7280', IN_PROGRESS: '#8b5cf6' };
                return (
                  <div key={status} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{status}</span>
                      <span style={{ fontWeight: 600 }}>{count}</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: colors[status] || '#6366f1', borderRadius: '3px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Requests Table */}
      {activeTab === 'requests' && (
        <div className="admin-section">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Urgency</th>
                  <th>Status</th>
                  <th>Requester</th>
                  <th>Volunteer</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>#{r.id}</td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</td>
                    <td><span className="badge badge-category">{r.category?.replace('_', ' ')}</span></td>
                    <td><span className={`badge ${URGENCY_CLASS[r.urgency]}`}>{r.urgency}</span></td>
                    <td><span className={`badge ${STATUS_CLASS[r.status]}`}>{r.status}</span></td>
                    <td>{r.requester?.fullName || r.requesterName || '-'}</td>
                    <td>{r.volunteer?.fullName || r.volunteerName || '-'}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Users Table */}
      {activeTab === 'users' && (
        <div className="admin-section">
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Level</th>
                  <th>Points</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="profile-avatar w-8 h-8 text-xs">{u.fullName?.charAt(0)}</div>
                        <div>
                          <div className="font-bold text-gray-900">{u.fullName}</div>
                          <div className="text-xs text-gray-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${u.role === 'ADMIN' ? 'badge-critical' : 'badge-category'}`}>{u.role}</span></td>
                    <td>
                      <VerificationBadge level={u.verificationLevel || 'BASIC'} size="sm" />
                    </td>
                    <td className="font-bold">{u.points}</td>
                    <td>{u.verified ? '✅ Yes' : '❌ No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verification Management (Trusted) */}
      {activeTab === 'verification' && (
        <div className="admin-section">
          <div className="card mb-6">
            <h3 className="text-lg font-bold mb-2">Pending Trusted Review</h3>
            <p className="text-sm text-gray-500">Users who are currently VERIFIED and eligible for manual promotion to TRUSTED based on their contribution history.</p>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Level</th>
                  <th>Points</th>
                  <th>Helped</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingTrusted.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">No users pending trusted review.</td>
                  </tr>
                ) : (
                  pendingTrusted.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="profile-avatar w-8 h-8 text-xs">{u.fullName?.charAt(0)}</div>
                          <div>
                            <div className="font-bold text-gray-900">{u.fullName}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <VerificationBadge level={u.verificationLevel || 'VERIFIED'} />
                      </td>
                      <td className="font-bold">{u.points}</td>
                      <td>{u.requestsHelped}</td>
                      <td>
                        <button 
                          className="btn btn-sm btn-primary"
                          disabled={verifyingId === u.id}
                          onClick={() => promoteToTrusted(u.id)}
                        >
                          {verifyingId === u.id ? 'Promoting...' : 'Promote to Trusted'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Flagged Requests (OCR/Risk Review) */}
      {activeTab === 'flagged' && (
        <div className="admin-section">
          <div className="card mb-6">
            <h3 className="text-lg font-bold mb-2">Flagged Request Verification Queue</h3>
            <p className="text-sm text-gray-500">Requests flagged by AI for risk scoring anomalies or OCR mismatches in medical documents.</p>
          </div>
          
          {flaggedRequests.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">No requests currently flagged for review.</div>
          ) : (
            flaggedRequests.map(req => (
              <div key={req.id} className="card mb-4" style={{ borderLeft: '4px solid var(--danger)' }}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${URGENCY_CLASS[req.urgency]}`}>{req.urgency}</span>
                      <span className="badge badge-category">{req.category}</span>
                      <span className="text-xs text-gray-400">#{req.id}</span>
                    </div>
                    <h3 className="font-bold text-lg">{req.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{req.description}</p>
                    <div className="text-xs font-mono text-danger-dark bg-danger-light inline-block px-2 py-1 rounded">
                      <strong>Flags:</strong> {req.riskFlags?.join(', ') || 'No flags listed'} (Score: {req.riskScore})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">Requester</div>
                    <div className="font-bold">{req.requesterName}</div>
                  </div>
                </div>

                {req.ocrDetails && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                    <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">AI OCR Analysis (Gemini Vision)</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>Hospital:</strong> {req.ocrDetails.hospitalName || 'N/A'}</div>
                      <div><strong>Doctor:</strong> {req.ocrDetails.doctorName || 'N/A'}</div>
                      <div><strong>Diagnosis:</strong> {req.ocrDetails.diagnosis || 'N/A'}</div>
                      <div><strong>Is Authentic:</strong> {req.ocrDetails.isAuthentic ? '✅ Yes' : '⚠️ Suspicious'}</div>
                      <div><strong>Confidence:</strong> {Math.round(req.ocrDetails.confidenceScore * 100)}%</div>
                      <div><strong>Match Reason:</strong> {req.ocrDetails.matchReason || 'N/A'}</div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-3 border-t">
                  <button 
                    className="btn btn-secondary" 
                    disabled={reviewingId === req.id}
                    onClick={() => handleReviewRequest(req.id, 'REJECTED')}
                  >
                    Reject Request
                  </button>
                  <button 
                    className="btn btn-primary"
                    disabled={reviewingId === req.id}
                    onClick={() => handleReviewRequest(req.id, 'VERIFIED')}
                  >
                    Mark as Verified
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
