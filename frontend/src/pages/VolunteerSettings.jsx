import { useEffect, useMemo, useState } from 'react';
import { Activity, LocateFixed, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import VolunteerBadgeList from '../components/volunteer/VolunteerBadgeList';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeader,
  Select,
  Skeleton,
  StatCard,
  Switch,
} from '../components/ui';
import { VOLUNTEER_CATEGORY_OPTIONS, normalizeVolunteerCategories } from '../utils/volunteer';
import { normalizeApiError } from '../utils/errors';
import { formatLocation } from '../utils/displayFormat';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function defaultSchedule() {
  return DAYS.map((day) => ({ day, startTime: '09:00', endTime: '18:00', enabled: false }));
}

function buildFallbackStats(user) {
  return {
    totalHelped: Number(user?.totalHelpCount ?? user?.requestsHelped ?? 0),
    rating: Number(user?.rating || 0),
    rank: Number(user?.rank || 0),
  };
}

function normalizeForm(user = {}) {
  return {
    isVolunteer: Boolean(user.isVolunteer),
    volunteerStatus: user.volunteerStatus || 'OFFLINE',
    volunteerCategories: normalizeVolunteerCategories(user.volunteerCategories || []),
    latitude: user.latitude ?? null,
    longitude: user.longitude ?? null,
    locationSource: user.locationSource || 'PROFILE',
    isAlwaysAvailable: Boolean(user.isAlwaysAvailable),
    availabilitySchedule: user.availabilitySchedule?.length ? user.availabilitySchedule : defaultSchedule(),
  };
}

export default function VolunteerSettings() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState(normalizeForm(user));
  const [stats, setStats] = useState(buildFallbackStats(user));
  const [saving, setSaving] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setForm(normalizeForm(user || {}));
  }, [user]);

  useEffect(() => {
    let active = true;
    async function loadStats() {
      setLoadingStats(true);
      if (!user?.userId || !user?.isVolunteer) {
        setStats(buildFallbackStats(user));
        setLoadingStats(false);
        return;
      }
      try {
        const response = await apiService.getVolunteerStats(user.userId);
        if (active) setStats(response.data || buildFallbackStats(user));
      } catch {
        if (active) setStats(buildFallbackStats(user));
      } finally {
        if (active) setLoadingStats(false);
      }
    }
    loadStats();
    return () => { active = false; };
  }, [user?.userId, user?.isVolunteer]);

  const locationSummary = useMemo(() => formatLocation({ ...user, ...form }), [form, user]);

  function toggleCategory(category) {
    if (!form.isVolunteer) return;
    setForm((current) => {
      const selected = new Set(current.volunteerCategories);
      if (selected.has(category)) selected.delete(category);
      else selected.add(category);
      return { ...current, volunteerCategories: Array.from(selected) };
    });
  }

  function updateSchedule(index, patch) {
    setForm((current) => {
      const next = [...current.availabilitySchedule];
      next[index] = { ...next[index], ...patch };
      return { ...current, availabilitySchedule: next };
    });
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      setError('This browser does not support current location. Update your profile address manually instead.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          locationSource: 'BROWSER',
        }));
        setNotice('Current location will be used for volunteer matching after save.');
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('Location permission was denied or unavailable.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  async function handleSave() {
    if (form.isVolunteer && form.volunteerCategories.length === 0) {
      setError('Choose at least one help category before enabling volunteer mode.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      let latestUser = user || {};
      const toggleResponse = await apiService.toggleVolunteer(user.userId, form.isVolunteer);
      latestUser = { ...latestUser, ...toggleResponse.data };

      if (form.isVolunteer) {
        const [categoryResponse, availabilityResponse] = await Promise.all([
          apiService.updateVolunteerCategories(user.userId, form.volunteerCategories),
          apiService.updateVolunteerAvailability(user.userId, form.volunteerStatus),
        ]);
        latestUser = { ...latestUser, ...categoryResponse.data, ...availabilityResponse.data };

        if (form.latitude != null && form.longitude != null) {
          const locationResponse = await apiService.updateVolunteerLocation(user.userId, {
            latitude: form.latitude,
            longitude: form.longitude,
          });
          latestUser = { ...latestUser, ...locationResponse.data };
        }

        await apiService.updateVolunteerSchedule(user.userId, {
          isAlwaysAvailable: form.isAlwaysAvailable,
          schedule: form.availabilitySchedule,
        });

        const profileResponse = await apiService.getProfile(user.userId);
        latestUser = { ...latestUser, ...profileResponse.data };
      }

      updateUser?.(latestUser);
      setNotice(form.isVolunteer ? 'Volunteer settings saved.' : 'Volunteer mode disabled.');
    } catch (saveError) {
      setError(normalizeApiError(saveError, 'We could not save volunteer settings.').message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-in p7d-page">
      <PageHeader
        eyebrow="Volunteer"
        title="Volunteer settings"
        description="Control when and how you appear for nearby verified help requests."
        action={user?.isVolunteer && <Button to="/volunteer/dashboard" variant="secondary"><Activity size={16} /> Open dashboard</Button>}
      />

      {error && <ErrorState message={error} />}
      {notice && <Alert variant="success" title="Volunteer settings">{notice}</Alert>}

      <div className="p7d-two-column p7d-two-column--wide p7d-volunteer-layout">
        <Card className="p7d-volunteer-primary">
          <SectionHeader title="Volunteer mode" description="Choose when you are available to help." />
          <Switch
            label={form.isVolunteer ? 'Volunteer mode on' : 'Volunteer mode off'}
            checked={form.isVolunteer}
            onChange={() => setForm((current) => ({
              ...current,
              isVolunteer: !current.isVolunteer,
              volunteerStatus: !current.isVolunteer ? 'ONLINE' : 'OFFLINE',
            }))}
            description="Turn on to receive nearby requests that match your categories and location."
          />

          <div className="p7d-form-grid">
            <label className="ui-field">
              <span>Availability status</span>
              <Select
                value={form.volunteerStatus}
                disabled={!form.isVolunteer}
                onChange={(event) => setForm((current) => ({ ...current, volunteerStatus: event.target.value }))}
              >
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
              </Select>
            </label>
          </div>

          <SectionHeader title="Help categories" description="Choose the types of requests you can help with." />
          <div className={`p7d-category-grid ${!form.isVolunteer ? 'is-disabled' : ''}`}>
            {VOLUNTEER_CATEGORY_OPTIONS.map((category) => {
              const selected = form.volunteerCategories.includes(category.value);
              return (
                <button
                  key={category.value}
                  type="button"
                  className={`p7d-category-card ${selected ? 'is-selected' : ''}`}
                  disabled={!form.isVolunteer}
                  onClick={() => toggleCategory(category.value)}
                  aria-pressed={selected}
                >
                  <span>{category.icon}</span>
                  <strong>{category.label}</strong>
                </button>
              );
            })}
          </div>

          {!form.isVolunteer && (
            <EmptyState title="Volunteer mode is off" message="Categories and availability are disabled until volunteer mode is enabled." />
          )}

          <SectionHeader title="Location relevance" description="Use your profile area for better nearby matching." />
          <div className="p7d-location-panel">
            <div>
              <strong>{locationSummary}</strong>
              <p>Source: {form.locationSource.replace(/_/g, ' ')}</p>
            </div>
            <Button type="button" variant="secondary" loading={locating} onClick={detectLocation} disabled={!form.isVolunteer}>
              <LocateFixed size={16} /> Use current location
            </Button>
          </div>
          <p className="p7d-muted">For manual address changes, update your profile location.</p>
          <Button to="/profile/edit" variant="secondary" size="sm">Edit profile location</Button>
        </Card>

        <div className="p7d-volunteer-side">
          <Card className="p7d-volunteer-snapshot">
            <SectionHeader title="Volunteer snapshot" description="Your volunteering activity." />
            {loadingStats ? <Skeleton lines={4} /> : (
              <>
                <div className="p7d-stat-grid p7d-stat-grid--compact">
                  <StatCard label="Total helped" value={stats.totalHelped || 0} />
                  <StatCard label="Rating" value={stats.rating ? stats.rating.toFixed(1) : 'New'} />
                  <StatCard label="Rank" value={stats.rank || 'Unranked'} />
                </div>
                <SectionHeader title="Badges" />
                <VolunteerBadgeList totalHelpCount={stats.totalHelped || 0} emptyMessage="Your first completed help unlocks Helper." />
              </>
            )}
          </Card>

          <Card className="p7d-volunteer-schedule">
            <SectionHeader title="Availability schedule" description="Set weekly times for when you can help." />
            <Switch
              label="Always available"
              checked={form.isAlwaysAvailable}
              disabled={!form.isVolunteer}
              onChange={() => setForm((current) => ({ ...current, isAlwaysAvailable: !current.isAlwaysAvailable }))}
              description="When enabled, weekly schedule entries are ignored."
            />

            {!form.isAlwaysAvailable && (
              <div className="p7d-schedule-list">
                {form.availabilitySchedule.map((entry, index) => (
                  <div key={entry.day} className="p7d-schedule-row">
                    <Switch
                      label={entry.day}
                      checked={Boolean(entry.enabled)}
                      disabled={!form.isVolunteer}
                      onChange={() => updateSchedule(index, { enabled: !entry.enabled })}
                    />
                    <Select value={entry.startTime} disabled={!form.isVolunteer || !entry.enabled} onChange={(event) => updateSchedule(index, { startTime: event.target.value })}>
                      {Array.from({ length: 24 }).map((_, hour) => <option key={hour} value={`${String(hour).padStart(2, '0')}:00`}>{String(hour).padStart(2, '0')}:00</option>)}
                    </Select>
                    <Select value={entry.endTime} disabled={!form.isVolunteer || !entry.enabled} onChange={(event) => updateSchedule(index, { endTime: event.target.value })}>
                      {Array.from({ length: 24 }).map((_, hour) => <option key={hour} value={`${String(hour).padStart(2, '0')}:00`}>{String(hour).padStart(2, '0')}:00</option>)}
                    </Select>
                  </div>
                ))}
              </div>
            )}
            {form.isAlwaysAvailable && <Badge variant="success">Always available</Badge>}
          </Card>

          <Card className="p7d-volunteer-actions-card">
            <SectionHeader title="Actions" description="Save changes or return to app settings." />
            <div className="p7d-volunteer-actions">
              <Button as={Link} to="/settings" variant="secondary">Back to settings</Button>
              <Button type="button" loading={saving} onClick={handleSave}><Save size={16} /> Save volunteer settings</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
