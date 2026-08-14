import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, MapPin, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmationDialog, EmptyState, ErrorState, Skeleton, StatusBadge, UrgencyBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import { timeAgo } from '../utils/timeUtils';
import { normalizeApiError } from '../utils/errors';

const FILTERS = [
  ['all', 'All'],
  ['open', 'Open'],
  ['progress', 'In Progress'],
  ['completed', 'Completed'],
];

function statusOf(request) {
  return String(request?.status || request?.requestStatus || 'OPEN').toUpperCase();
}

function categoryOf(request) {
  return String(request?.category || request?.type || 'General').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function locationOf(request) {
  return [request?.address || request?.location, request?.city, request?.district, request?.state].filter(Boolean).slice(0, 2).join(', ') || 'Location not set';
}

function matchesFilter(request, filter) {
  const status = statusOf(request);
  if (filter === 'open') return status === 'OPEN';
  if (filter === 'completed') return status.includes('COMPLETE') || status === 'CLOSED';
  if (filter === 'progress') return ['ACCEPTED', 'ASSIGNED', 'ACTIVE', 'IN_PROGRESS', 'PENDING_COMPLETION', 'COMPLETION_REQUESTED'].includes(status);
  return true;
}

function RequestRow({ request, onDelete }) {
  const status = statusOf(request);
  return (
    <article className="hv-my-request-row">
      <div className="hv-my-request-main">
        <div className="hv-my-request-title">
          <h3>{request.title || 'Untitled request'}</h3>
          <StatusBadge status={status} />
        </div>
        <p>{request.description || request.summary || 'No description provided.'}</p>
        <div className="hv-my-request-meta">
          <Badge>{categoryOf(request)}</Badge>
          <UrgencyBadge urgency={request.urgency || 'MEDIUM'} />
          <span><Clock3 size={14} />{request.createdAt || request.createdAtEpochMs ? timeAgo(request.createdAtEpochMs || request.createdAt) : 'Recently'}</span>
          <span><MapPin size={14} />{locationOf(request)}</span>
        </div>
      </div>
      <div className="hv-request-row-actions">
        <Button to={`/request/${request.id || request.requestId}`} variant="secondary" size="sm">View</Button>
        <Button type="button" variant="danger" size="sm" onClick={() => onDelete(request)}><Trash2 size={14} />Delete</Button>
      </div>
    </article>
  );
}

function ActivityRow({ item }) {
  const Icon = item.icon;
  return (
    <div className="hv-activity-row">
      <span><Icon size={15} /></span>
      <div>
        <strong>{item.title}</strong>
        <small>{item.time}</small>
      </div>
    </div>
  );
}

export default function MyRequests() {
  const { user } = useAuth();
  const [created, setCreated] = useState([]);
  const [helped, setHelped] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const [createdRes, helpedRes, communitiesRes] = await Promise.allSettled([
        apiService.getMyRequests(user?.userId || user?.id),
        apiService.getVolunteeredRequests(user?.userId || user?.id),
        apiService.getJoinedCommunities(user?.userId || user?.id),
      ]);
      if (createdRes.status === 'fulfilled') setCreated(Array.isArray(createdRes.value.data) ? createdRes.value.data : []);
      if (helpedRes.status === 'fulfilled') setHelped(Array.isArray(helpedRes.value.data) ? helpedRes.value.data : []);
      if (communitiesRes.status === 'fulfilled') setCommunities(Array.isArray(communitiesRes.value.data) ? communitiesRes.value.data : []);
      if (createdRes.status === 'rejected') setError(createdRes.reason?.message || 'Could not load your requests.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [user?.userId, user?.id]);

  async function removeRequest() {
    if (!deleteTarget) return;
    const requestId = deleteTarget.id || deleteTarget.requestId;
    setDeleting(true);
    setError('');
    try {
      await apiService.deleteRequest(requestId);
      setCreated((current) => current.filter((request) => (request.id || request.requestId) !== requestId));
      setDeleteTarget(null);
    } catch (deleteError) {
      const normalized = normalizeApiError(deleteError, 'Could not remove this request.');
      setError(normalized.message);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => created.filter((request) => matchesFilter(request, filter)), [created, filter]);
  const stats = useMemo(() => ({
    created: created.length,
    open: created.filter((request) => matchesFilter(request, 'open')).length,
    completed: created.filter((request) => matchesFilter(request, 'completed')).length,
    communities: communities.length,
  }), [communities.length, created]);
  const activity = useMemo(() => {
    const rows = [
      ...created.map((request) => ({
        id: `created-${request.id || request.requestId}`,
        title: `Created: ${request.title || 'Request'}`,
        time: request.createdAt ? timeAgo(request.createdAt) : 'Recently',
        date: new Date(request.createdAt || 0).getTime(),
        icon: Plus,
      })),
      ...helped.map((request) => ({
        id: `helped-${request.id || request.requestId}`,
        title: `Volunteered: ${request.title || 'Request'}`,
        time: request.updatedAt || request.createdAt ? timeAgo(request.updatedAt || request.createdAt) : 'Recently',
        date: new Date(request.updatedAt || request.createdAt || 0).getTime(),
        icon: CheckCircle2,
      })),
    ];
    return rows.sort((a, b) => b.date - a.date).slice(0, 8);
  }, [created, helped]);

  return (
    <div className="animate-in hv-my-requests">
      <header className="hv-compact-page-header">
        <div>
          <p className="ui-eyebrow">Requests</p>
          <h1>My Requests</h1>
          <p>Track your raised requests, volunteer activity, and recent request updates.</p>
        </div>
        <Button to="/create"><Plus size={16} />Raise request</Button>
      </header>

      {error && <ErrorState title="Requests partially loaded" message={error} onRetry={loadDashboard} />}

      <div className="hv-my-requests-grid">
        <Card className="hv-dashboard-card hv-request-list-card">
          <div className="hv-card-heading">
            <div>
              <h2>My Requests</h2>
              <p>{created.length} created requests</p>
            </div>
            <div className="hv-filter-pills" role="tablist" aria-label="Request filters">
              {FILTERS.map(([value, label]) => (
                <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
          </div>
          {loading ? (
            <Skeleton lines={8} />
          ) : filtered.length === 0 ? (
            <EmptyState title="No requests here" message="Requests matching this filter will appear here." actionLabel="Raise request" actionTo="/create" />
          ) : (
            <div className="hv-my-request-list">
              {filtered.map((request) => <RequestRow key={request.id || request.requestId} request={request} onDelete={setDeleteTarget} />)}
            </div>
          )}
        </Card>

        <aside className="hv-my-side">
          <div className="hv-metric-grid">
            <Card className="hv-metric-card"><small>Created</small><strong>{stats.created}</strong></Card>
            <Card className="hv-metric-card"><small>Open</small><strong>{stats.open}</strong></Card>
            <Card className="hv-metric-card"><small>Completed</small><strong>{stats.completed}</strong></Card>
            <Card className="hv-metric-card"><small>Communities</small><strong>{stats.communities}</strong></Card>
          </div>
          <Card className="hv-dashboard-card">
            <div className="hv-card-heading">
              <div>
                <h2>Recent Activity</h2>
                <p>Latest request updates</p>
              </div>
              <Activity size={18} />
            </div>
            {activity.length === 0 ? (
              <EmptyState title="No activity yet" message="Your request activity will appear here." />
            ) : (
              <div className="hv-activity-list">
                {activity.map((item) => <ActivityRow key={item.id} item={item} />)}
              </div>
            )}
          </Card>
        </aside>
      </div>
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Delete request?"
        message="This permanently deletes the request and its request-specific activity. This cannot be undone."
        confirmLabel="Delete request"
        destructive
        loading={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeRequest}
      />
    </div>
  );
}
