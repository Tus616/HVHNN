// FEATURE: Community Management Tools - IMPLEMENTED
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';

const COMMUNITY_TYPES = [
  { value: 'COLLEGE', label: '🎓 College / University' },
  { value: 'HOSPITAL', label: '🏥 Hospital / Clinic' },
  { value: 'RESIDENTIAL', label: '🏘️ Residential Society' },
  { value: 'CORPORATE', label: '🏢 Corporate / Office' },
  { value: 'OTHER', label: '🏛️ Other Organization' },
];

export default function CommunityManage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    name: '', type: 'COLLEGE', description: '', address: '', radiusKm: 5, verificationCode: '', emailDomain: '',
  });
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [activeTab, setActiveTab] = useState('settings');
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', urgency: 'MEDIUM' });
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    loadCommunity();
  }, [id]);

  const loadCommunity = async () => {
    try {
      const [commRes, membersRes] = await Promise.all([
        apiService.getCommunities(),
        apiService.getCommunityMembers(parseInt(id, 10)),
      ]);
      const comm = commRes.data.find(c => c.id === parseInt(id, 10));
      if (comm) {
        setCommunity(comm);
        setForm({
          name: comm.name || '',
          type: comm.type || 'COLLEGE',
          description: comm.description || '',
          address: comm.address || '',
          radiusKm: comm.radiusKm || 5,
          verificationCode: comm.verificationCode || '',
          emailDomain: comm.emailDomain || '',
        });
      }
      setMembers(membersRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.address) {
      showToast('Name and address are required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await apiService.updateCommunity(parseInt(id, 10), form);
      setCommunity(res.data);
      showToast('Community settings updated! ✅');
    } catch (err) {
      showToast(err.message || 'Failed to save.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== community?.name) {
      showToast('Type the community name exactly to confirm deletion.', 'error');
      return;
    }
    try {
      await apiService.deleteCommunity(parseInt(id, 10));
      showToast('Community deleted.');
      navigate('/communities');
    } catch (err) {
      showToast(err.message || 'Failed to delete.', 'error');
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!confirm(`Remove ${memberName} from this community?`)) return;
    try {
      await apiService.removeCommunityMember(parseInt(id, 10), memberId);
      setMembers(prev => prev.filter(m => m.id !== memberId));
      showToast(`${memberName} removed from community.`);
    } catch (err) {
      showToast(err.message || 'Failed to remove member.', 'error');
    }
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.title || !broadcastForm.message) {
      showToast('Title and message are required.', 'error');
      return;
    }
    setBroadcasting(true);
    try {
      await apiService.broadcastCommunityMessage(parseInt(id, 10), {
        title: broadcastForm.title,
        content: broadcastForm.message,
        urgency: broadcastForm.urgency
      });
      showToast('Broadcast sent successfully to all members! 📢');
      setBroadcastForm({ title: '', message: '', urgency: 'MEDIUM' });
      setActiveTab('members');
    } catch (err) {
      showToast(err.message || 'Failed to send broadcast.', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!community) return <div className="empty-state"><h3>Community not found</h3></div>;

  return (
    <div className="animate-in">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/community/${id}`)} style={{ marginBottom: '20px' }}>
        ← Back to Community
      </button>

      <div className="page-header">
        <div>
          <h1>⚙️ Manage {community.name}</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            Edit settings, manage members, and configure verification
          </p>
        </div>
      </div>

      <div className="feed-filters" style={{ marginBottom: '24px' }}>
        <button className={`filter-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
          ⚙️ Settings
        </button>
        <button className={`filter-btn ${activeTab === 'members' ? 'active' : ''}`} onClick={() => setActiveTab('members')}>
          👥 Members ({members.length})
        </button>
        <button className={`filter-btn ${activeTab === 'broadcast' ? 'active' : ''}`} onClick={() => setActiveTab('broadcast')}>
          📢 Broadcast
        </button>
        <button className={`filter-btn ${activeTab === 'verification' ? 'active' : ''}`} onClick={() => setActiveTab('verification')}>
          🔐 Verification
        </button>
        <button className={`filter-btn ${activeTab === 'danger' ? 'active' : ''}`} onClick={() => setActiveTab('danger')}>
          ⚠️ Danger Zone
        </button>
      </div>

      {activeTab === 'settings' && (
        <div className="card">
          <h3 style={{ marginBottom: '20px', fontWeight: 700 }}>Community Settings</h3>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Community Name *</label>
              <input type="text" className="form-input" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value })}>
                {COMMUNITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" rows={3} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Address *</label>
              <input type="text" className="form-input" value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Coverage Radius (km)</label>
                <input type="number" className="form-input" min="1" max="50"
                  value={form.radiusKm} onChange={e => setForm({ ...form, radiusKm: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : '💾 Save Settings'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'members' && (
        <div className="card">
          <h3 style={{ marginBottom: '20px', fontWeight: 700 }}>Members ({members.length})</h3>
          {members.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.5 }}>👥</div>
              <h3>No members data available</h3>
              <p>Members will appear here once they join the community.</p>
            </div>
          ) : (
            <div>
              {members.map(m => (
                <div key={m.id} className="member-list-item">
                  <div className="member-list-info">
                    <div className="member-list-avatar">{m.fullName?.charAt(0) || '?'}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{m.fullName}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {m.email || 'No email'} • {m.roleLabel || 'Member'}
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.id, m.fullName)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'broadcast' && (
        <div className="card">
          <h3 style={{ marginBottom: '12px', fontWeight: 700 }}>📢 Community Broadcast</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.9rem' }}>
            Send a mass notification to every member of this community. Use this for emergencies, events, or important announcements.
          </p>
          <form onSubmit={handleBroadcast}>
            <div className="form-group">
              <label className="form-label">Broadcast Title *</label>
              <input type="text" className="form-input" placeholder="e.g., Blood Donation Camp, Water Supply Update"
                value={broadcastForm.title} onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Message Content *</label>
              <textarea className="form-textarea" rows={4} placeholder="Type your message here..."
                value={broadcastForm.message} onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Urgency</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(u => (
                  <button 
                    key={u}
                    type="button"
                    className={`btn btn-sm ${broadcastForm.urgency === u ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setBroadcastForm({ ...broadcastForm, urgency: u })}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginTop: '24px' }}>
              <button type="submit" className="btn btn-primary" disabled={broadcasting} style={{ width: '100%', justifyContent: 'center' }}>
                {broadcasting ? 'Sending...' : '📢 Send Broadcast to Members'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'verification' && (
        <div className="card">
          <h3 style={{ marginBottom: '20px', fontWeight: 700 }}>Verification Settings</h3>

          <div className="form-group">
            <label className="form-label">Join Code</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="text" className="form-input" value={form.verificationCode}
                onChange={e => setForm({ ...form, verificationCode: e.target.value.toUpperCase() })}
                style={{ maxWidth: '200px', fontWeight: 700, letterSpacing: '2px', textAlign: 'center' }} />
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const newCode = community.name.replace(/[^A-Z]/gi, '').substring(0, 4).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
                setForm({ ...form, verificationCode: newCode });
              }}>
                🔄 Regenerate
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Share this code with members to let them join via the "Join Code" method.
            </p>
          </div>

          <div className="form-group" style={{ marginTop: '24px' }}>
            <label className="form-label">Email Domain Verification</label>
            <input type="text" className="form-input" placeholder="e.g., iitd.ac.in"
              value={form.emailDomain}
              onChange={e => setForm({ ...form, emailDomain: e.target.value.toLowerCase() })}
              style={{ maxWidth: '300px' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
              Members with this email domain can verify via OTP and join automatically. Leave empty to disable.
            </p>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? 'Saving...' : '💾 Save Verification Settings'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div className="card" style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.03)' }}>
          <h3 style={{ marginBottom: '12px', fontWeight: 700, color: '#ef4444' }}>⚠️ Danger Zone</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Deleting this community is irreversible. All members will be removed and all associated data will be lost.
          </p>

          {!showDelete ? (
            <button className="btn btn-danger" onClick={() => setShowDelete(true)}>
              🗑️ Delete Community
            </button>
          ) : (
            <div style={{ padding: '16px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ marginBottom: '12px', color: '#ef4444', fontWeight: 600 }}>
                Type <strong>"{community.name}"</strong> to confirm deletion:
              </p>
              <input
                type="text"
                className="delete-confirm-input"
                placeholder={community.name}
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => { setShowDelete(false); setDeleteConfirm(''); }}>Cancel</button>
                <button className="btn btn-danger" onClick={handleDelete} disabled={deleteConfirm !== community.name}>
                  🗑️ Permanently Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
