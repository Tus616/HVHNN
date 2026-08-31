import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import VolunteerBadgeList from '../components/volunteer/VolunteerBadgeList';
import VolunteerRequestCard from '../components/volunteer/VolunteerRequestCard';
import VolunteerStatusActions from '../components/volunteer/VolunteerStatusActions';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import { formatVolunteerProgressStatus } from '../utils/volunteer';
import VolunteerNavigationMap from '../components/volunteer/VolunteerNavigationMap';

const TABS = [
  { key: 'incoming', label: 'Incoming Requests' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

export default function VolunteerDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('incoming');
  const [dashboard, setDashboard] = useState({ incoming: [], active: [], completed: [], stats: null });
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState('');
  const [toast, setToast] = useState(null);
  const [activeMapRequest, setActiveMapRequest] = useState(null);

  useEffect(() => {
    if (!user?.isVolunteer) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    const loadDashboard = async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);

      try {
        const [incomingResponse, activeResponse, completedResponse, statsResponse] = await Promise.all([
          apiService.getVolunteerIncomingRequests(user.userId),
          apiService.getVolunteerActiveRequests(user.userId),
          apiService.getVolunteerCompletedRequests(user.userId),
          apiService.getVolunteerStats(user.userId),
        ]);

        if (!active) return;
        setDashboard({
          incoming: incomingResponse.data || [],
          active: activeResponse.data || [],
          completed: completedResponse.data || [],
          stats: statsResponse.data || null,
        });
      } catch (error) {
        if (active) {
          showToast(error.message || 'We could not load your volunteer dashboard.', 'error');
        }
      } finally {
        if (active && !silent) setLoading(false);
      }
    };

    loadDashboard();
    const timer = window.setInterval(() => loadDashboard({ silent: true }), 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.isVolunteer, user?.userId]);

  function showToast(message, type = 'success') {
    setToast({ message, type });
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(null), 3200);
  }

  async function acceptRequest(requestId) {
    const incoming = Array.isArray(dashboard.incoming) ? dashboard.incoming : [];
    const reqToAccept = incoming.find(r => r.id === requestId);
    setActionKey(`accept-${requestId}`);
    try {
      await apiService.acceptVolunteerRequest(requestId, user);
      showToast('Request accepted. The requester has been notified.');
      setTab('active');
      if (reqToAccept) setActiveMapRequest(reqToAccept);
      await refreshLists();
    } catch (error) {
      showToast(error.message || 'We could not accept this request.', 'error');
    } finally {
      setActionKey('');
    }
  }

  async function declineRequest(requestId) {
    setActionKey(`decline-${requestId}`);
    try {
      await apiService.declineVolunteerRequest(requestId, user);
      showToast('Request declined.');
      await refreshLists();
    } catch (error) {
      showToast(error.message || 'We could not decline this request.', 'error');
    } finally {
      setActionKey('');
    }
  }

  async function updateRequestStatus(requestId, status) {
    setActionKey(`${status}-${requestId}`);
    try {
      await apiService.updateVolunteerRequestStatus(requestId, status, user);
      showToast(status === 'COMPLETED' ? 'Request marked complete. Rating prompt sent to requester.' : `Updated request to ${formatVolunteerProgressStatus(status)}.`);
      await refreshLists();
    } catch (error) {
      showToast(error.message || 'We could not update this request.', 'error');
    } finally {
      setActionKey('');
    }
  }

  async function refreshLists() {
    const [incomingResponse, activeResponse, completedResponse, statsResponse] = await Promise.all([
      apiService.getVolunteerIncomingRequests(user.userId),
      apiService.getVolunteerActiveRequests(user.userId),
      apiService.getVolunteerCompletedRequests(user.userId),
      apiService.getVolunteerStats(user.userId),
    ]);

    setDashboard({
      incoming: incomingResponse.data || [],
      active: activeResponse.data || [],
      completed: completedResponse.data || [],
      stats: statsResponse.data || null,
    });
  }

  if (!user?.isVolunteer) {
    return (
      <div className="animate-in">
        <div className="empty-state">
          <div className="empty-icon">🤝</div>
          <h3>Volunteer dashboard unlocks after you enable volunteer mode</h3>
          <p>Set your categories, go online, and keep your location fresh to start receiving nearby requests.</p>
          <Link to="/volunteer/settings" className="btn btn-primary" style={{ marginTop: '18px' }}>
            Open Volunteer Settings
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const activeTabData = dashboard[tab] || [];
  const isOffline = user?.volunteerStatus === 'OFFLINE';
  const nextWindow = isOffline ? (() => {
    if (!user?.availabilitySchedule?.length || user.isAlwaysAvailable) return null;
    const now = new Date();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const currentDay = days[now.getDay()];
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const schedule = Array.isArray(user?.availabilitySchedule) ? user.availabilitySchedule : [];
    const enabledSlots = schedule.filter(e => e.enabled);
    if (!enabledSlots.length) return null;
    const todayWindow = enabledSlots.find(e => e.day === currentDay && e.startTime > currentTime);
    if (todayWindow) return `Today at ${todayWindow.startTime}`;
    for (let i = 1; i <= 7; i++) {
      const nextDayIdx = (now.getDay() + i) % 7;
      const nextDay = days[nextDayIdx];
      const window = enabledSlots.find(e => e.day === nextDay);
      if (window) return `${i === 1 ? 'Tomorrow' : nextDay} at ${window.startTime}`;
    }
    return null;
  })() : null;

  return (
    <div className="animate-in volunteer-page-shell">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {activeMapRequest && (
        <VolunteerNavigationMap
          request={activeMapRequest}
          onClose={() => setActiveMapRequest(null)}
          onArrived={async (id) => {
            setActiveMapRequest(null);
            await updateRequestStatus(id, 'REACHED');
          }}
        />
      )}

      <div className="page-header">
        <div>
          <h1>Volunteer Dashboard</h1>
          <p className="volunteer-page-subtitle">
            Stay close to incoming requests, update your live help progress, and track the trust you’ve earned.
          </p>
        </div>
        <Link to="/volunteer/settings" className="btn btn-secondary">
          Settings
        </Link>
      </div>

      <div className="card volunteer-dashboard-hero">
        <div className="volunteer-dashboard-stats">
          <div>
            <div className="volunteer-stat-kicker">Total Helped</div>
            <div className="volunteer-stat-value">{dashboard.stats?.totalHelped || 0}</div>
          </div>
          <div>
            <div className="volunteer-stat-kicker">Rating</div>
            <div className="volunteer-stat-value">
              {dashboard.stats?.totalHelped > 0 ? `★ ${(dashboard.stats?.rating || 0).toFixed(1)}` : 'New'}
            </div>
          </div>
          <div>
            <div className="volunteer-stat-kicker">Rank</div>
            <div className="volunteer-stat-value">{dashboard.stats?.rank || '--'}</div>
          </div>
        </div>
        <VolunteerBadgeList totalHelpCount={dashboard.stats?.totalHelped || 0} emptyMessage="Complete your first request to unlock badges." />
      </div>

      {isOffline && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded-r-xl flex items-center justify-between animate-pulse-subtle">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌙</span>
            <div>
              <div className="font-bold text-orange-900">You are currently Offline</div>
              <div className="text-sm text-orange-800">
                {nextWindow ? `Scheduled to go online: ${nextWindow}` : 'You won\'t receive new requests until you go online.'}
              </div>
            </div>
          </div>
          <Link to="/volunteer/settings" className="text-sm font-bold text-orange-600 hover:text-orange-700 underline underline-offset-4">
            Edit Schedule
          </Link>
        </div>
      )}

      <div className="feed-filters" style={{ marginBottom: '24px' }}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`filter-btn ${tab === item.key ? 'active' : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label} ({dashboard[item.key]?.length || 0})
          </button>
        ))}
      </div>

      {activeTabData.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">{tab === 'incoming' ? '📭' : tab === 'active' ? '🚗' : '🏁'}</div>
          <h3>
            {tab === 'incoming' && 'No nearby volunteer requests right now'}
            {tab === 'active' && 'No active volunteer requests'}
            {tab === 'completed' && 'No completed volunteer history yet'}
          </h3>
          <p>
            {tab === 'incoming' && 'Keep your volunteer status online and we will refresh this every 30 seconds.'}
            {tab === 'active' && 'Accepted requests will appear here with live status controls.'}
            {tab === 'completed' && 'Finished requests and the ratings you receive will show up here.'}
          </p>
        </div>
      ) : (
        <div className="request-list">
          {tab === 'incoming' && activeTabData.map((request) => (
            <VolunteerRequestCard
              key={request.id}
              request={request}
              footer={(
                <div className="volunteer-card-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={actionKey === `accept-${request.id}`}
                    onClick={() => acceptRequest(request.id)}
                  >
                    {actionKey === `accept-${request.id}` ? 'Accepting...' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={actionKey === `decline-${request.id}`}
                    onClick={() => declineRequest(request.id)}
                  >
                    {actionKey === `decline-${request.id}` ? 'Declining...' : 'Decline'}
                  </button>
                </div>
              )}
            />
          ))}

          {tab === 'active' && activeTabData.map((request) => (
            <VolunteerRequestCard
              key={request.id}
              request={request}
              footer={(
                <div className="volunteer-active-summary" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div><strong>Requester:</strong> {request.requester?.fullName || 'Unknown'}</div>
                    <div><strong>Contact:</strong> {request.contactPhone || 'Not provided'}</div>
                  </div>
                  {(request.status === 'ACTIVE' && request.volunteerProgressStatus !== 'COMPLETED' && request.latitude && request.longitude) && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setActiveMapRequest(request)}>
                      📍 Show Map
                    </button>
                  )}
                </div>
              )}
            >
              <VolunteerStatusActions
                request={request}
                loading={actionKey.endsWith(`-${request.id}`)}
                onUpdate={(status) => updateRequestStatus(request.id, status)}
              />
            </VolunteerRequestCard>
          ))}

          {tab === 'completed' && activeTabData.map((request) => (
            <VolunteerRequestCard
              key={request.id}
              request={request}
              compact
              footer={(
                <div className="volunteer-active-summary">
                  <div><strong>Rating:</strong> {request.volunteerRating ? `★ ${request.volunteerRating}/5` : 'Pending'}</div>
                  {request.volunteerFeedback && <div><strong>Feedback:</strong> {request.volunteerFeedback}</div>}
                </div>
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
