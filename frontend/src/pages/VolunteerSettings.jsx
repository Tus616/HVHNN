import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import VolunteerBadgeList from '../components/volunteer/VolunteerBadgeList';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import { VOLUNTEER_CATEGORY_OPTIONS, VOLUNTEER_SKILL_OPTIONS } from '../utils/volunteer';
import VerificationBadge from '../components/VerificationBadge';

function buildFallbackStats(user) {
  const totalHelped = user?.totalHelpCount ?? user?.requestsHelped ?? 0;
  return {
    totalHelped,
    rating: Number(user?.rating || 0),
    rank: 0,
    badges: [...(user?.badges || [])],
  };
}

export default function VolunteerSettings() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    isVolunteer: Boolean(user?.isVolunteer),
    volunteerStatus: user?.volunteerStatus || 'OFFLINE',
    volunteerCategories: [...(user?.volunteerCategories || [])],
    skills: [...(user?.skills || [])],
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null,
    isAlwaysAvailable: user?.isAlwaysAvailable || false,
    availabilitySchedule: user?.availabilitySchedule?.length ? user.availabilitySchedule : 
      ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => ({ day: d, startTime: '09:00', endTime: '18:00', enabled: false }))
  });
  const [stats, setStats] = useState(buildFallbackStats(user));
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setForm({
      isVolunteer: Boolean(user?.isVolunteer),
      volunteerStatus: user?.volunteerStatus || 'OFFLINE',
      volunteerCategories: [...(user?.volunteerCategories || [])],
      skills: [...(user?.skills || [])],
      latitude: user?.latitude ?? null,
      longitude: user?.longitude ?? null,
      isAlwaysAvailable: user?.isAlwaysAvailable || false,
      availabilitySchedule: user?.availabilitySchedule?.length ? user.availabilitySchedule : 
        ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => ({ day: d, startTime: '09:00', endTime: '18:00', enabled: false }))
    });
    setStats(buildFallbackStats(user));
  }, [user]);

  useEffect(() => {
    if (!user?.userId || !user?.isVolunteer) {
      setStats(buildFallbackStats(user));
      return;
    }

    let active = true;
    apiService.getVolunteerStats(user.userId)
      .then((response) => {
        if (active) setStats(response.data);
      })
      .catch(() => {
        if (active) setStats(buildFallbackStats(user));
      });

    return () => {
      active = false;
    };
  }, [user]);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(null), 3200);
  }

  function toggleCategory(category) {
    setForm((current) => {
      const isSelected = (Array.isArray(current.volunteerCategories) ? current.volunteerCategories : []).includes(category);
      return {
        ...current,
        volunteerCategories: isSelected
          ? (Array.isArray(current.volunteerCategories) ? current.volunteerCategories : []).filter((entry) => entry !== category)
          : [...(Array.isArray(current.volunteerCategories) ? current.volunteerCategories : []), category],
      };
    });
  }

  function toggleSkill(skill) {
    setForm((current) => {
      const isSelected = (Array.isArray(current.skills) ? current.skills : []).includes(skill);
      return {
        ...current,
        skills: isSelected
          ? (Array.isArray(current.skills) ? current.skills : []).filter((entry) => entry !== skill)
          : [...(Array.isArray(current.skills) ? current.skills : []), skill],
      };
    });
  }

  function updateStatus(nextStatus) {
    setForm((current) => ({ ...current, volunteerStatus: nextStatus }));
  }

  function detectLocation() {
    if (!navigator.geolocation) {
      showToast('Geolocation is not available in this browser.', 'error');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        }));
        setLocating(false);
        showToast('Volunteer location updated from GPS.');
      },
      () => {
        setLocating(false);
        showToast('We could not access your location. Check browser permissions and try again.', 'error');
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  async function handleSave() {
    if (form.isVolunteer && form.volunteerCategories.length === 0) {
      showToast('Choose at least one help category before saving volunteer mode.', 'error');
      return;
    }

    setSaving(true);
    try {
      let latestUser = user || {};

      const toggleResponse = await apiService.toggleVolunteer(user.userId, form.isVolunteer);
      latestUser = { ...latestUser, ...toggleResponse.data };
      updateUser(latestUser);

      if (form.isVolunteer) {
        const categoriesResponse = await apiService.updateVolunteerCategories(user.userId, form.volunteerCategories);
        latestUser = { ...latestUser, ...categoriesResponse.data };
        updateUser(latestUser);

        const statusResponse = await apiService.updateVolunteerAvailability(user.userId, form.volunteerStatus);
        latestUser = { ...latestUser, ...statusResponse.data };
        updateUser(latestUser);

        if (form.latitude != null && form.longitude != null) {
          const locationResponse = await apiService.updateVolunteerLocation(user.userId, {
            latitude: form.latitude,
            longitude: form.longitude,
          });
          latestUser = { ...latestUser, ...locationResponse.data };
          updateUser(latestUser);
        }

        const skillsResponse = await apiService.updateSkills(form.skills);
        latestUser = { ...latestUser, ...skillsResponse.data };
        updateUser(latestUser);

        await apiService.updateVolunteerSchedule(user.userId, {
          isAlwaysAvailable: form.isAlwaysAvailable,
          schedule: form.availabilitySchedule
        });
        
        // Refresh local user state
        const profileRes = await apiService.getProfile(user.userId);
        latestUser = { ...latestUser, ...profileRes.data };
        updateUser(latestUser);

        try {
          const statsResponse = await apiService.getVolunteerStats(user.userId);
          setStats(statsResponse.data);
        } catch {
          setStats(buildFallbackStats(latestUser));
        }
      } else {
        setStats(buildFallbackStats({ ...latestUser, totalHelpCount: 0, badges: [] }));
      }

      showToast(form.isVolunteer ? 'Volunteer settings saved.' : 'Volunteer mode disabled.');
    } catch (error) {
      showToast(error.message || 'We could not save your volunteer settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-in volunteer-page-shell">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      <div className="page-header">
        <div>
          <h1>Volunteer Settings</h1>
          <p className="volunteer-page-subtitle">
            Turn volunteer mode on, choose your response categories, and keep your live location ready for nearby alerts.
          </p>
        </div>
        {user?.isVolunteer && (
          <Link to="/volunteer/dashboard" className="btn btn-secondary">
            Open Dashboard
          </Link>
        )}
      </div>

      <div className="volunteer-settings-grid">
        <div className="card">
          <div className="volunteer-panel-header">
            <div>
              <h3>Volunteer Mode</h3>
              <p>Only verified members can appear for nearby requests.</p>
            </div>
            <button
              type="button"
              className={`volunteer-toggle ${form.isVolunteer ? 'active' : ''}`}
              onClick={() => setForm((current) => ({ ...current, isVolunteer: !current.isVolunteer }))}
              aria-pressed={form.isVolunteer}
            >
              <span />
            </button>
          </div>

          {form.isVolunteer ? (
            <div className="volunteer-settings-section">
              <div className="volunteer-status-row">
                <button
                  type="button"
                  className={`btn ${form.volunteerStatus === 'ONLINE' ? 'btn-success' : 'btn-secondary'}`}
                  onClick={() => updateStatus('ONLINE')}
                >
                  Online
                </button>
                <button
                  type="button"
                  className={`btn ${form.volunteerStatus === 'OFFLINE' ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => updateStatus('OFFLINE')}
                >
                  Offline
                </button>
              </div>

              <div className="volunteer-settings-section">
                <div className="volunteer-section-label">Help Categories</div>
                <div className="volunteer-category-grid">
                  {VOLUNTEER_CATEGORY_OPTIONS.map((category) => {
                    const active = (Array.isArray(form.volunteerCategories) ? form.volunteerCategories : []).includes(category.value);
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
              </div>

              <div className="volunteer-settings-section">
                <div className="volunteer-section-label">My Skills & Expertise</div>
                <p className="text-sm text-gray-500 mb-3">Select specialized skills to be matched with high-priority requests.</p>
                <div className="flex flex-wrap gap-2">
                  {VOLUNTEER_SKILL_OPTIONS.map((skill) => {
                    const active = (Array.isArray(form.skills) ? form.skills : []).includes(skill.value);
                    return (
                      <button
                        key={skill.value}
                        type="button"
                        onClick={() => toggleSkill(skill.value)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-200 ${
                          active 
                            ? 'bg-green-100 border-green-300 text-green-700 shadow-sm font-medium' 
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-lg">{skill.icon}</span>
                        <span className="text-sm">{skill.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="volunteer-settings-section">
                <div className="volunteer-section-label">Live Location</div>
                <div className="volunteer-location-box">
                  <div>
                    {form.latitude != null && form.longitude != null ? (
                      <span>
                        {form.latitude}, {form.longitude}
                      </span>
                    ) : (
                      <span>No GPS location saved yet</span>
                    )}
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={detectLocation} disabled={locating}>
                    {locating ? 'Locating...' : 'Update Location'}
                  </button>
                </div>
              </div>

              {/* Availability Scheduler */}
              <div className="volunteer-settings-section border-t pt-6 mt-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="volunteer-section-label">Availability Schedule</div>
                    <p className="text-sm text-gray-500">Automate your online status based on time of day.</p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <span className="text-sm font-bold text-gray-700 group-hover:text-green-600 transition-colors">Always Available</span>
                    <div 
                      className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${form.isAlwaysAvailable ? 'bg-green-500' : 'bg-gray-300'}`}
                      onClick={() => setForm(f => ({ ...f, isAlwaysAvailable: !f.isAlwaysAvailable }))}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${form.isAlwaysAvailable ? 'translate-x-6' : ''}`} />
                    </div>
                  </label>
                </div>

                {!form.isAlwaysAvailable ? (
                  <div className="space-y-3">
                    {(Array.isArray(form.availabilitySchedule) ? form.availabilitySchedule : []).map((entry, idx) => (
                      <div key={entry.day} className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${entry.enabled ? 'bg-green-50/50 border-green-200' : 'bg-gray-50/50 border-gray-100 opacity-60'}`}>
                        <div className="w-12 font-black text-gray-400 text-xs">{entry.day}</div>
                        <button
                          type="button"
                          onClick={() => {
                            const newSched = [...form.availabilitySchedule];
                            newSched[idx].enabled = !newSched[idx].enabled;
                            setForm(f => ({ ...f, availabilitySchedule: newSched }));
                          }}
                          className={`w-10 h-5 rounded-full relative flex-shrink-0 transition-colors ${entry.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${entry.enabled ? 'translate-x-5' : ''}`} />
                        </button>
                        
                        <div className="flex-1 flex items-center gap-2">
                          <select
                            disabled={!entry.enabled}
                            value={entry.startTime}
                            onChange={(e) => {
                              const newSched = [...form.availabilitySchedule];
                              newSched[idx].startTime = e.target.value;
                              setForm(f => ({ ...f, availabilitySchedule: newSched }));
                            }}
                            className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-green-500"
                          >
                            {Array.from({length: 48}).map((_, i) => {
                              const h = Math.floor(i/2);
                              const m = i%2 === 0 ? '00' : '30';
                              const val = `${String(h).padStart(2, '0')}:${m}`;
                              return <option key={val} value={val}>{val}</option>;
                            })}
                          </select>
                          <span className="text-gray-400 text-xs">to</span>
                          <select
                            disabled={!entry.enabled}
                            value={entry.endTime}
                            onChange={(e) => {
                              const newSched = [...form.availabilitySchedule];
                              newSched[idx].endTime = e.target.value;
                              setForm(f => ({ ...f, availabilitySchedule: newSched }));
                            }}
                            className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:border-green-500"
                          >
                            {Array.from({length: 49}).map((_, i) => {
                              const h = Math.floor(i/2);
                              const m = i%2 === 0 ? '00' : '30';
                              const val = h === 24 ? '23:59' : `${String(h).padStart(2, '0')}:${m}`;
                              if (h === 24 && i%2 !== 0) return null;
                              return <option key={val} value={val}>{val}</option>;
                            })}
                          </select>
                        </div>
                      </div>
                    ))}
                    <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-800 text-sm">
                      <div className="font-bold mb-1 flex items-center gap-2">
                        <span>🗓️</span> Schedule Summary
                      </div>
                      {(Array.isArray(form.availabilitySchedule) ? form.availabilitySchedule : []).some(e => e.enabled) ? (
                        <p>
                          Auto-ONLINE: {(Array.isArray(form.availabilitySchedule) ? form.availabilitySchedule : [])
                            .filter(e => e?.enabled)
                            .map(e => `${e.day} (${e.startTime}-${e.endTime})`)
                            .join(', ')}
                        </p>
                      ) : (
                        <p>No active schedule. You'll remain in your last selected state.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-green-50 rounded-2xl border border-green-100">
                    <div className="text-4xl mb-3">🟢</div>
                    <div className="font-bold text-green-800">Always Available Mode Active</div>
                    <p className="text-sm text-green-700/70 mt-1">
                      You will appear ONLINE at all times. The weekly schedule is ignored.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="volunteer-empty-inline">
              Enable volunteer mode to receive nearby requests and appear on the responder network.
            </div>
          )}

          <div className="volunteer-actions-row">
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        <div className="card volunteer-stats-card">
          <h3>Volunteer Snapshot</h3>
          <div className="profile-stats volunteer-stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.totalHelped || 0}</div>
              <div className="stat-label">Total Helped</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">★ {(stats.rating || 0).toFixed(1)}</div>
              <div className="stat-label">Rating</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.rank || '--'}</div>
              <div className="stat-label">Volunteer Rank</div>
            </div>
          </div>

          <div className="volunteer-settings-section">
            <div className="volunteer-section-label">Badges</div>
            <VolunteerBadgeList totalHelpCount={stats.totalHelped || 0} emptyMessage="Your first completed help unlocks Helper." />
          </div>
        </div>

        {/* Identity Trust Guide */}
        <div className="card md:col-span-2 border-none shadow-md bg-white">
          <div className="p-1">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              🛡️ How to Level Up Your Trust
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 relative">
                <div className="flex items-center gap-2 mb-2">
                  <VerificationBadge level="BASIC" />
                  <span className="font-bold text-slate-700">Basic</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">Auto-assigned upon email verification. Access to feed and basic community features.</p>
                {user?.verificationLevel === 'BASIC' && (
                  <div className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Current Level</div>
                )}
              </div>
              <div className={`p-4 rounded-2xl border relative ${user?.verificationLevel === 'VERIFIED' ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <VerificationBadge level="VERIFIED" />
                  <span className="font-bold text-blue-700">Verified</span>
                </div>
                <p className="text-xs text-blue-600 leading-relaxed">Join a community using your institution email (e.g., .edu, .ac.in) or a valid join code.</p>
                {user?.verificationLevel === 'VERIFIED' && (
                  <div className="mt-3 text-[10px] font-bold text-blue-500 uppercase tracking-tighter">Current Level</div>
                )}
                {user?.verificationLevel === 'BASIC' && (
                  <Link to="/communities" className="mt-3 inline-block text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-tighter">Explore Communities →</Link>
                )}
              </div>
              <div className={`p-4 rounded-2xl border relative ${user?.verificationLevel === 'TRUSTED' ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <VerificationBadge level="TRUSTED" />
                  <span className="font-bold text-emerald-700">Trusted</span>
                </div>
                <p className="text-xs text-emerald-600 leading-relaxed">Assigned manually by administrators for consistent high-impact contributions and verified history.</p>
                {user?.verificationLevel === 'TRUSTED' && (
                  <div className="mt-3 text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Current Level</div>
                )}
                {user?.verificationLevel === 'VERIFIED' && (
                  <div className="mt-3 text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">Eligible for Review</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
