import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import AdminLoadingState from '../../components/admin/AdminLoadingState';
import { adminApi } from '../../services/adminApi';
import { ErrorState } from '../../components/ui';
import { humanizeEnum } from '../../utils/displayFormat';
import { normalizeApiError } from '../../utils/errors';

export default function AdminSettingsPage() {
  const { user, showToast } = useOutletContext();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);

      try {
        setError('');
        const response = await adminApi.getSettings(user);
        if (!active) return;
        setSettings(response.data);
      } catch (error) {
        if (!active) return;
        setError(normalizeApiError(error, 'Could not load admin settings.').message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, [user]);

  if (loading) {
    return <AdminLoadingState label="Loading settings..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!settings) {
    return <ErrorState message="Admin settings are unavailable." />;
  }

  async function handlePasswordSave(event) {
    event.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showToast({ type: 'warning', title: 'Incomplete form', message: 'Fill all password fields first.' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast({ type: 'danger', title: 'Passwords do not match', message: 'Please confirm the new password again.' });
      return;
    }

    setSavingPassword(true);

    try {
      await adminApi.updatePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast({ type: 'success', title: 'Password updated', message: 'Your admin password was updated successfully.' });
    } catch (error) {
      showToast({ type: 'danger', title: 'Could not update password', message: normalizeApiError(error, 'Please try again.').message });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handlePreferenceToggle(key) {
    const nextPreferences = {
      ...settings.preferences,
      [key]: !settings.preferences[key],
    };

    setSettings((current) => ({
      ...current,
      preferences: nextPreferences,
    }));
    setSavingPreferences(true);

    try {
      await adminApi.updateNotificationPreferences(nextPreferences);
      showToast({ type: 'success', title: 'Preferences saved', message: 'Notification settings updated.' });
    } catch (error) {
      showToast({ type: 'danger', title: 'Save failed', message: normalizeApiError(error, 'Please try again.').message });
    } finally {
      setSavingPreferences(false);
    }
  }

  return (
    <div className="admin-page-stack">
      <section className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">Settings</p>
          <h2>Admin profile and preferences</h2>
          <p>Manage account credentials and notification controls for the admin console.</p>
        </div>
      </section>

      <section className="admin-settings-grid">
        <div className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h3>Admin Profile</h3>
              <p>Current signed-in admin account</p>
            </div>
          </div>

          <div className="admin-detail-grid">
            <div>
              <span className="admin-detail-label">Name</span>
              <p>{settings.profile.fullName}</p>
            </div>
            <div>
              <span className="admin-detail-label">Role</span>
              <p>{humanizeEnum(settings.profile.role)}</p>
            </div>
            <div className="admin-detail-span-two">
              <span className="admin-detail-label">Email</span>
              <p>{settings.profile.email}</p>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-section-heading">
            <div>
              <h3>Change Password</h3>
              <p>Update your admin credentials securely</p>
            </div>
          </div>

          <form className="admin-form-grid" onSubmit={handlePasswordSave}>
            <div className="admin-form-field admin-form-span-two">
              <label>Current Password</label>
              <input
                type="password"
                className="admin-input"
                value={passwordForm.currentPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
              />
            </div>

            <div className="admin-form-field">
              <label>New Password</label>
              <input
                type="password"
                className="admin-input"
                value={passwordForm.newPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
              />
            </div>

            <div className="admin-form-field">
              <label>Confirm Password</label>
              <input
                type="password"
                className="admin-input"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              />
            </div>

            <div className="admin-actions-row">
              <button type="submit" className="admin-btn admin-btn-primary" disabled={savingPassword}>
                {savingPassword ? 'Saving...' : 'Save Password'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="admin-card">
        <div className="admin-section-heading">
          <div>
            <h3>Notification Preferences</h3>
            <p>Control how admin updates are delivered.</p>
          </div>
        </div>

        <div className="admin-preferences-list">
          <button type="button" className="admin-toggle-row" onClick={() => handlePreferenceToggle('emailAlertsHighUrgency')}>
            <div>
              <strong>Email alerts on new High urgency request</strong>
              <span>Immediate email notification when a high urgency request is created.</span>
            </div>
            <span className={`admin-toggle ${settings.preferences.emailAlertsHighUrgency ? 'active' : ''}`} />
          </button>

          <button type="button" className="admin-toggle-row" onClick={() => handlePreferenceToggle('dailySummaryEmail')}>
            <div>
              <strong>Daily summary email</strong>
              <span>Receive a daily summary of request volume, volunteers, and pending work.</span>
            </div>
            <span className={`admin-toggle ${settings.preferences.dailySummaryEmail ? 'active' : ''}`} />
          </button>
        </div>

        {savingPreferences && <p className="admin-inline-note">Saving preferences...</p>}
      </section>
    </div>
  );
}
