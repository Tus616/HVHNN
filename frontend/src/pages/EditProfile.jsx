// FEATURE: Edit Profile (Phase 6 Expansion)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';

export default function EditProfile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    bio: '',
    bloodGroup: '',
    isBloodDonor: false,
  });

  useEffect(() => {
    loadProfile();
  }, [user]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadProfile = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await apiService.getProfile(user.userId);
      const profile = res.data || user;
      setForm({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
        address: profile.address || '',
        bio: profile.bio || '',
        bloodGroup: profile.bloodGroup || '',
        isBloodDonor: profile.isBloodDonor || false,
      });
    } catch (err) {
      showToast(err.message || 'Failed to load latest profile data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiService.updateProfile(form);
      const updatedData = res.data || form; // fallback to form if backend doesn't return full object
      updateUser(updatedData);
      showToast('Profile updated successfully! ✅');
      setTimeout(() => navigate('/profile'), 1500);
    } catch (err) {
      showToast(err.message || 'Failed to save profile updates', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  return (
    <div className="animate-in">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <button className="btn btn-secondary btn-sm" onClick={() => navigate('/profile')} style={{ marginBottom: '20px' }}>
        ← Back to Profile
      </button>

      <div className="page-header">
        <div>
          <h1>⚙️ Edit Profile</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            Update your personal details, bio, and primary address.
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div className="profile-avatar" style={{ width: '64px', height: '64px', fontSize: '1.8rem' }}>
            {form.fullName?.charAt(0)?.toUpperCase() || user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="community-section-eyebrow">Avatar Setup</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Linked directly to your HVHN profile identity.
            </p>
            <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: '8px' }} disabled>
              Upload Photo (Coming Soon)
            </button>
          </div>
        </div>

        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input 
              type="text" 
              className="form-input" 
              value={form.fullName}
              onChange={e => setForm({ ...form, fullName: e.target.value })} 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contact Phone</label>
            <input 
              type="tel" 
              className="form-input" 
              placeholder="+91..."
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Primary Address</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="E.g., Block A, Green Valley Society"
              value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })} 
            />
            <button 
              type="button" 
              className="btn btn-sm btn-secondary" 
              style={{ marginTop: '8px' }}
              onClick={() => {
                if(navigator.geolocation) {
                  showToast('Detecting location...', 'success');
                  navigator.geolocation.getCurrentPosition(() => {
                    setForm(f => ({ ...f, address: 'Current GPS Location Detected' }));
                  }, () => showToast('GPS access denied', 'error'));
                }
              }}
            >
              📍 Auto-Detect Location
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Bio / About Me</label>
            <textarea 
              className="form-textarea" 
              rows={4} 
              placeholder="Tell your community a little about yourself, your skills, or how you like to help."
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })} 
            />
          </div>

          <div className="form-group" style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', marginTop: '16px' }}>
            <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🩸 Blood Donation
            </h4>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label className="form-label">Blood Group</label>
                <select 
                  className="form-input" 
                  value={form.bloodGroup} 
                  onChange={e => setForm({ ...form, bloodGroup: e.target.value })}
                >
                  <option value="">Unknown / Do not disclose</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 200px', cursor: 'pointer', marginTop: '24px' }}>
                <input 
                  type="checkbox" 
                  checked={form.isBloodDonor} 
                  onChange={e => setForm({ ...form, isBloodDonor: e.target.checked })} 
                  style={{ width: '20px', height: '20px', accentColor: 'var(--danger-color)' }}
                />
                <span style={{ fontWeight: 500 }}>Register as Volunteer Blood Donor</span>
              </label>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '12px' }}>
              If you check this box, nearby verified users can match with you during critical blood shortages. You will only be matched with compatible blood types.
            </p>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/profile')}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : '💾 Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
