import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Clock3, HeartHandshake, LogOut, MapPin, Shield, Smartphone, Trash2, User, Users } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import apiService from '../services/api';
import { normalizeApiError } from '../utils/errors';
import { Alert, Button, Card, ConfirmationDialog, EmptyState, ErrorState, FormField, Input, PageHeader, SectionHeader, Select, Skeleton, Switch, Tabs } from '../components/ui';
import { timeAgo } from '../utils/timeUtils';
import { formatLocation, formatVolunteerCategory } from '../utils/displayFormat';

const DEFAULT_PREFS = {
  inAppEnabled: true,
  pushEnabled: false,
  emailEnabled: false,
  requestNotifications: true,
  communityNotifications: true,
  qnaNotifications: true,
  campaignNotifications: true,
  chatNotifications: true,
  nearbyRequestNotifications: true,
  systemNotifications: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  quietHoursTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  nearbyRequestRadiusKm: 5,
};

const CATEGORY_PREFS = [
  ['requestNotifications', 'Help requests', 'New request activity, accepts, progress, and closures.'],
  ['nearbyRequestNotifications', 'Nearby requests', 'Local help requests inside your notification radius.'],
  ['communityNotifications', 'Communities', 'Membership, announcements, and manager updates.'],
  ['qnaNotifications', 'Q&A', 'Questions, answers, votes, and accepted guidance.'],
  ['campaignNotifications', 'Campaigns', 'Community drive updates and pledge coordination.'],
  ['chatNotifications', 'Messages', 'Direct and community chat notifications.'],
];

function pushStateCopy(permission, enabled) {
  if (permission === 'unsupported') return ['Unsupported', 'This browser does not support web push notifications.'];
  if (permission === 'denied') return ['Blocked in browser', 'Change browser site settings manually before enabling push again.'];
  if (permission === 'granted' && enabled) return ['Browser notifications enabled', 'This device can receive push alerts.'];
  if (permission === 'granted') return ['Permission granted', 'Turn on push to register this browser with Sahay.'];
  return ['Not enabled', 'Enable browser notifications when you are ready.'];
}

function safeDeviceLabel(device) {
  return device.deviceName || device.browser || device.appVersion || 'Sahay web device';
}

export default function Settings() {
  const { user, logout } = useAuth();
  const { isDyslexic, toggleDyslexia, isHighContrast, toggleHighContrast, isLargeText, toggleLargeText } = useAccessibility();
  const { isDark, toggleTheme } = useTheme();
  const { enablePushNotifications, disablePushNotifications, pushPermission, showToast } = useNotifications();
  const [active, setActive] = useState('profile');
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [devices, setDevices] = useState([]);
  const [deviceToRemove, setDeviceToRemove] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const [prefRes, deviceRes] = await Promise.all([
        apiService.getNotificationPreferences(),
        apiService.listNotificationDevices(),
      ]);
      setPrefs({ ...DEFAULT_PREFS, ...prefRes.data, systemNotifications: true });
      setDevices(deviceRes.data || []);
    } catch (err) {
      setError(normalizeApiError(err, 'Could not load settings.').message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function savePrefs(nextPrefs) {
    setPrefs(nextPrefs);
    setSaving(true);
    try {
      const response = await apiService.updateNotificationPreferences(nextPrefs);
      setPrefs({ ...DEFAULT_PREFS, ...response.data, systemNotifications: true });
      showToast({ type: 'success', title: 'Settings saved', message: 'Notification preferences updated.' });
    } catch (err) {
      const normalized = normalizeApiError(err, 'Could not save notification preferences.');
      setError(normalized.message);
      showToast({ type: 'error', title: 'Save failed', message: normalized.message });
    } finally {
      setSaving(false);
    }
  }

  function togglePref(key) {
    savePrefs({ ...prefs, [key]: !prefs[key] });
  }

  async function enablePush() {
    setSaving(true);
    try {
      await enablePushNotifications();
      await loadSettings();
      showToast({ type: 'success', title: 'Push enabled', message: 'This browser can receive Sahay alerts.' });
    } catch (err) {
      const normalized = normalizeApiError(err, 'Could not enable push notifications.');
      showToast({ type: 'error', title: 'Push unavailable', message: normalized.message });
    } finally {
      setSaving(false);
    }
  }

  async function disablePush() {
    setSaving(true);
    try {
      await disablePushNotifications();
      await loadSettings();
      showToast({ type: 'info', title: 'Push disabled', message: 'Saved browser devices were removed.' });
    } finally {
      setSaving(false);
    }
  }

  async function removeDevice() {
    if (!deviceToRemove) return;
    setSaving(true);
    try {
      await apiService.deleteNotificationDevice(deviceToRemove);
      setDevices((current) => current.filter((device) => device.id !== deviceToRemove));
      showToast({ type: 'info', title: 'Device removed', message: 'The selected browser device was removed.' });
    } finally {
      setSaving(false);
      setDeviceToRemove(null);
    }
  }

  const [pushTitle, pushDescription] = pushStateCopy(pushPermission, prefs.pushEnabled);

  const tabs = [
    {
      id: 'profile',
      label: 'Profile',
      content: (
        <div className="p7c-settings-grid">
          <Card>
            <SectionHeader title="Profile" description="Keep identity, contact, and profile location changes in the profile editor." />
            <div className="p7c-profile-card">
              <div>
                <strong>{user?.fullName || 'Sahay member'}</strong>
                <p>{user?.email}</p>
              </div>
              <div>
                <Button to="/profile/edit" variant="secondary"><User size={16} /> Edit profile</Button>
                <Button to="/volunteer/settings" variant="secondary"><Users size={16} /> Volunteer settings</Button>
              </div>
            </div>
          </Card>
          <Alert title="Location privacy">Your saved area helps match nearby requests while sensitive location details stay private.</Alert>
        </div>
      ),
    },
    {
      id: 'location',
      label: 'Location',
      content: (
        <div className="p7c-settings-grid">
          <Card>
            <SectionHeader title="Location" description="Profile location is used for nearby matching and notification radius decisions." />
            <div className="p7d-location-panel">
              <MapPin size={20} aria-hidden="true" />
              <div>
                <strong>{formatLocation(user || {})}</strong>
                <p>Use Edit profile to update, refresh, or clear your saved location.</p>
              </div>
            </div>
            <div className="p7c-action-row">
              <Button to="/profile/edit" variant="secondary"><MapPin size={16} /> Manage location</Button>
            </div>
          </Card>
          <Alert title="Nearby matching">Clearing location may reduce nearby request and volunteer matching accuracy until a new location is saved.</Alert>
        </div>
      ),
    },
    {
      id: 'volunteer',
      label: 'Volunteer',
      content: (
        <div className="p7c-settings-grid">
          <Card>
            <SectionHeader title="Volunteer mode" description="Volunteer availability, categories, schedule, and matching location live in one settings flow." />
            <div className="p7d-detail-list">
              <div><span>Mode</span><strong>{user?.isVolunteer ? 'Enabled' : 'Disabled'}</strong></div>
              <div><span>Status</span><strong>{user?.volunteerStatus ? String(user.volunteerStatus).replace(/_/g, ' ') : 'Not set'}</strong></div>
              <div>
                <span>Categories</span>
                <div className="p7d-chip-row">
                  {(Array.isArray(user?.volunteerCategories) && user.volunteerCategories.length)
                    ? user.volunteerCategories.map((category) => <span key={category} className="ui-badge">{formatVolunteerCategory(category)}</span>)
                    : <span className="ui-badge">None selected</span>}
                </div>
              </div>
            </div>
            <div className="p7c-action-row">
              <Button to="/volunteer/settings" variant="secondary"><HeartHandshake size={16} /> Manage volunteer settings</Button>
            </div>
          </Card>
        </div>
      ),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      content: (
        <div className="p7c-settings-grid">
          <Card>
            <SectionHeader title="General delivery" description="Choose where Sahay can surface updates. System and security alerts remain enabled." />
            {loading ? <Skeleton lines={8} /> : (
              <div className="p7c-pref-grid">
                <Switch label="In-app notifications" checked={prefs.inAppEnabled} onChange={() => togglePref('inAppEnabled')} description="Show updates in the notification center and bell preview." />
                <Switch label="Email notifications" checked={prefs.emailEnabled} onChange={() => togglePref('emailEnabled')} description="Receive important updates by email where supported." />
                <Switch label="System and security" checked description="Always on for account, safety, and security messages." onChange={() => {}} />
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Categories" description="Tune the activity types you want to hear about." />
            {loading ? <Skeleton lines={8} /> : (
              <div className="p7c-pref-grid">
                {CATEGORY_PREFS.map(([key, label, description]) => (
                  <Switch key={key} label={label} checked={Boolean(prefs[key])} onChange={() => togglePref(key)} description={description} />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Quiet hours" description="In-app notifications may still appear. Push/email alerts can be delayed during quiet hours." />
            {loading ? <Skeleton lines={4} /> : (
              <div className="p7c-quiet-grid">
                <Switch label="Enable quiet hours" checked={Boolean(prefs.quietHoursEnabled)} onChange={() => togglePref('quietHoursEnabled')} />
                <FormField label="Start">
                  <Input type="time" value={prefs.quietHoursStart || '22:00'} onChange={(event) => savePrefs({ ...prefs, quietHoursStart: event.target.value })} disabled={!prefs.quietHoursEnabled} />
                </FormField>
                <FormField label="End">
                  <Input type="time" value={prefs.quietHoursEnd || '07:00'} onChange={(event) => savePrefs({ ...prefs, quietHoursEnd: event.target.value })} disabled={!prefs.quietHoursEnabled} />
                </FormField>
                <FormField label="Timezone">
                  <Select value={prefs.quietHoursTimezone || 'Asia/Kolkata'} onChange={(event) => savePrefs({ ...prefs, quietHoursTimezone: event.target.value })} disabled={!prefs.quietHoursEnabled}>
                    <option value="Asia/Kolkata">Asia/Kolkata</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/London">Europe/London</option>
                  </Select>
                </FormField>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeader title="Nearby requests" description="Choose how far away local request alerts can come from." />
            <FormField label="Alert radius">
              <Input type="number" min="1" max="50" value={prefs.nearbyRequestRadiusKm || 5} onChange={(event) => savePrefs({ ...prefs, nearbyRequestRadiusKm: Number(event.target.value) })} />
            </FormField>
          </Card>
          {saving && <Alert title="Saving">Updating your notification settings.</Alert>}
        </div>
      ),
    },
    {
      id: 'devices',
      label: 'Devices',
      content: (
        <div className="p7c-settings-grid">
          <Card>
            <SectionHeader
              title="Browser push"
              description={pushDescription}
              action={(
                <div className="p7c-action-row">
                  <Button size="sm" onClick={enablePush} loading={saving} disabled={pushPermission === 'unsupported' || pushPermission === 'denied'}>
                    <Bell size={16} /> Enable
                  </Button>
                  <Button size="sm" variant="secondary" onClick={disablePush} loading={saving}>Disable</Button>
                </div>
              )}
            />
            <div className="p7c-push-state">
              <Bell size={18} />
              <div>
                <strong>{pushTitle}</strong>
                <p>Permission: {pushPermission}</p>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Registered devices" description="Browsers that can receive Sahay push notifications." />
            {devices.length === 0 ? (
              <EmptyState title="No push devices registered" message="Enable push on this browser to receive urgent updates when Sahay is not open." />
            ) : (
              <div className="p7c-device-list">
                {devices.map((device) => (
                  <div key={device.id} className="p7c-device-row">
                    <Smartphone size={20} aria-hidden="true" />
                    <div>
                      <strong>{device.platform || 'WEB'} - {safeDeviceLabel(device)}</strong>
                      <p>
                        App {device.appVersion || 'web'}
                        {device.lastUsedAt && <> - Last used {timeAgo(device.lastUsedAt)}</>}
                        {device.active === false && <> - inactive</>}
                      </p>
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setDeviceToRemove(device.id)}>
                      <Trash2 size={15} /> Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ),
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      content: (
        <Card>
          <SectionHeader title="Accessibility" description="Local display preferences for this browser." />
          <div className="p7c-pref-grid">
            <Switch label="Dark mode" checked={isDark} onChange={toggleTheme} />
            <Switch label="Dyslexia friendly font" checked={isDyslexic} onChange={toggleDyslexia} />
            <Switch label="High contrast mode" checked={isHighContrast} onChange={toggleHighContrast} />
            <Switch label="Large text mode" checked={isLargeText} onChange={toggleLargeText} />
          </div>
        </Card>
      ),
    },
    {
      id: 'account',
      label: 'Account',
      content: (
        <Card>
          <SectionHeader title="Account and session" description="Session state clears protected data on logout." />
          <div className="p7c-action-row">
            <Button variant="secondary" to="/profile"><Shield size={16} /> View public profile</Button>
            <Button variant="danger" onClick={logout}><LogOut size={16} /> Logout</Button>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div className="animate-in p7c-settings">
      <PageHeader
        eyebrow="Settings"
        title="Preferences and account"
        description="Profile links, notification delivery, push devices, quiet hours, accessibility, and session controls."
        action={<Button to="/feed" variant="secondary"><MapPin size={16} /> Back to feed</Button>}
      />
      {error && <ErrorState message={error} onRetry={loadSettings} />}
      {!error && <Tabs tabs={tabs} active={active} onChange={setActive} />}
      <div className="p7c-settings-footer">
        <Clock3 size={16} />
        <span>Sahay keeps sensitive device details private.</span>
        <Link to="/notifications">Open notification center</Link>
      </div>
      <ConfirmationDialog
        open={Boolean(deviceToRemove)}
        title="Remove this device?"
        message="This removes the selected browser from your push notification devices. It does not affect other devices."
        confirmLabel="Remove device"
        destructive
        onCancel={() => setDeviceToRemove(null)}
        onConfirm={removeDevice}
      />
    </div>
  );
}
