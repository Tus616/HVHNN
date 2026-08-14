import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import { VOLUNTEER_CATEGORY_OPTIONS, normalizeVolunteerCategories } from '../utils/volunteer';

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
    address: user?.address || '',
    city: user?.city || '',
    district: user?.district || '',
    state: user?.state || '',
    postalCode: user?.postalCode || '',
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null,
    locationSource: user?.locationSource || 'UNKNOWN',
    volunteerEnabled: Boolean(user?.isVolunteer || user?.volunteerEnabled),
    volunteerCategories: normalizeVolunteerCategories(user?.volunteerCategories || []),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.onboardingCompleted) {
      navigate('/feed', { replace: true });
    }
  }, [navigate, user?.onboardingCompleted]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleCategory(category) {
    setForm((current) => {
      const selected = current.volunteerCategories.includes(category);
      return {
        ...current,
        volunteerCategories: selected
          ? current.volunteerCategories.filter((entry) => entry !== category)
          : [...current.volunteerCategories, category],
      };
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Browser location is unavailable. You can still enter your area manually.');
      return;
    }
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          locationSource: 'BROWSER',
          address: current.address || 'Current browser location',
        }));
      },
      () => setError('Location permission denied or unavailable. Manual area fields still work.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.fullName.trim() || !form.phone.trim()) {
      setError('Full name and phone are required.');
      return;
    }
    if (form.volunteerEnabled && form.volunteerCategories.length === 0) {
      setError('Choose at least one volunteer category or continue as a normal member.');
      return;
    }

    setSaving(true);
    try {
      const response = await apiService.completeOnboarding({
        ...form,
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        volunteerCategories: form.volunteerEnabled ? form.volunteerCategories : [],
      });
      updateUser(response.data);
      navigate('/feed', { replace: true });
    } catch (err) {
      setError(err.message || 'We could not complete onboarding.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-page animate-in">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <h2>Complete Your Sahay Profile</h2>
          <p className="auth-subtitle">Set up your identity once. Volunteer mode is optional.</p>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-input" value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Phone *</label>
            <input className="form-input" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" value={form.address} onChange={(event) => updateField('address', event.target.value)} />
            <button type="button" className="btn btn-sm btn-secondary" onClick={useCurrentLocation} style={{ marginTop: '8px' }}>
              Use Current Location
            </button>
            {form.latitude != null && form.longitude != null && (
              <p style={{ fontSize: '0.82rem', color: 'var(--success)', marginTop: '8px' }}>
                Coordinates attached: {form.latitude}, {form.longitude}
              </p>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" value={form.city} onChange={(event) => updateField('city', event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">District</label>
              <input className="form-input" value={form.district} onChange={(event) => updateField('district', event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input className="form-input" value={form.state} onChange={(event) => updateField('state', event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Postal Code</label>
              <input className="form-input" value={form.postalCode} onChange={(event) => updateField('postalCode', event.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Bio</label>
            <textarea className="form-textarea" rows={3} value={form.bio} onChange={(event) => updateField('bio', event.target.value)} />
          </div>

          <div className="form-group" style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', fontWeight: 700 }}>
              <input
                type="checkbox"
                checked={form.volunteerEnabled}
                onChange={(event) => updateField('volunteerEnabled', event.target.checked)}
              />
              Set me up as a volunteer
            </label>

            {form.volunteerEnabled && (
              <div className="volunteer-category-grid" style={{ marginTop: '14px' }}>
                {VOLUNTEER_CATEGORY_OPTIONS.map((category) => {
                  const active = form.volunteerCategories.includes(category.value);
                  return (
                    <button
                      key={category.value}
                      type="button"
                      className={`volunteer-category-card ${active ? 'active' : ''}`}
                      onClick={() => toggleCategory(category.value)}
                    >
                      <span className="volunteer-category-icon" aria-hidden="true">{category.icon}</span>
                      <span>{category.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Finish Onboarding'}
          </button>
        </form>
      </div>
    </div>
  );
}
