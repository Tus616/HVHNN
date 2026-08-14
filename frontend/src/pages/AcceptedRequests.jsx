import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Clock3, MapPin, Trash2, User as UserIcon } from 'lucide-react';
import { Badge, Button, Card, ConfirmationDialog, EmptyState, ErrorState, Skeleton, StatusBadge, UrgencyBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import apiService from '../services/api';
import { timeAgo } from '../utils/timeUtils';
import { normalizeApiError } from '../utils/errors';

const FILTERS = [
  ['all', 'All'],
  ['progress', 'In Progress'],
  ['pending', 'Pending Completion'],
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
  if (filter === 'progress') return ['ACCEPTED', 'ASSIGNED', 'ACTIVE', 'IN_PROGRESS'].includes(status);
  if (filter === 'pending') return ['PENDING_COMPLETION', 'COMPLETION_REQUESTED'].includes(status);
  if (filter === 'completed') return status.includes('COMPLETE') || status === 'CLOSED';
  return true;
}

function AcceptedRequestRow({ request, onRemove }) {
  const status = statusOf(request);
  const canRemove = status.includes('COMPLETE') || status === 'CLOSED' || status === 'CANCELLED';
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
          {request.requesterName && <span><UserIcon size={14} />{request.requesterName}</span>}
        </div>
      </div>
      <div className="hv-request-row-actions">
        <Button to={`/request/${request.id || request.requestId}`} variant="secondary" size="sm">View</Button>
        {canRemove && (
          <Button type="button" variant="danger" size="sm" onClick={() => onRemove(request)}>
            <Trash2 size={14} />Remove
          </Button>
        )}
      </div>
    </article>
  );
}

export default function AcceptedRequests() {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);

  async function loadAccepted() {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.getVolunteeredRequests(user?.userId || user?.id);
      setRequests(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      const normalized = normalizeApiError(err, 'Could not load accepted requests.');
      setError(normalized.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccepted();
  }, [user?.userId, user?.id]);

  async function removeAccepted() {
    if (!removeTarget) return;
    const requestId = removeTarget.id || removeTarget.requestId;
    setRemoving(true);
    setError('');
    try {
      await apiService.removeAcceptedRequest(requestId);
      setRequests((current) => current.filter((r) => (r.id || r.requestId) !== requestId));
      setRemoveTarget(null);
      showToast({ type: 'success', title: 'Removed', message: 'Request removed from your accepted history.' });
    } catch (removeError) {
      const normalized = normalizeApiError(removeError, 'Could not remove this request from history.');
      setError(normalized.message);
      showToast({ type: 'error', title: 'Remove failed', message: normalized.message });
    } finally {
      setRemoving(false);
    }
  }

  const filtered = useMemo(() => requests.filter((r) => matchesFilter(r, filter)), [requests, filter]);
  const stats = useMemo(() => ({
    total: requests.length,
    active: requests.filter((r) => matchesFilter(r, 'progress')).length,
    pending: requests.filter((r) => matchesFilter(r, 'pending')).length,
    completed: requests.filter((r) => matchesFilter(r, 'completed')).length,
  }), [requests]);

  return (
    <div className="animate-in hv-my-requests">
      <header className="hv-compact-page-header">
        <div>
          <p className="ui-eyebrow">Volunteering</p>
          <h1>Accepted Requests</h1>
          <p>Track requests you have accepted as a volunteer, monitor progress, and review completed tasks.</p>
        </div>
        <Button to="/feed"><CheckCheck size={16} />Find requests</Button>
      </header>

      {error && <ErrorState title="Could not load accepted requests" message={error} onRetry={loadAccepted} />}

      <div className="hv-my-requests-grid">
        <Card className="hv-dashboard-card hv-request-list-card">
          <div className="hv-card-heading">
            <div>
              <h2>Accepted Requests</h2>
              <p>{requests.length} volunteered request{requests.length !== 1 ? 's' : ''}</p>
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
            <EmptyState title="No accepted requests" message="Requests you accept as a volunteer will appear here." actionLabel="Browse help feed" actionTo="/feed" />
          ) : (
            <div className="hv-my-request-list">
              {filtered.map((request) => <AcceptedRequestRow key={request.id || request.requestId} request={request} onRemove={setRemoveTarget} />)}
            </div>
          )}
        </Card>

        <aside className="hv-my-side">
          <div className="hv-metric-grid">
            <Card className="hv-metric-card"><small>Total</small><strong>{stats.total}</strong></Card>
            <Card className="hv-metric-card"><small>Active</small><strong>{stats.active}</strong></Card>
            <Card className="hv-metric-card"><small>Pending</small><strong>{stats.pending}</strong></Card>
            <Card className="hv-metric-card"><small>Completed</small><strong>{stats.completed}</strong></Card>
          </div>
        </aside>
      </div>

      <ConfirmationDialog
        open={Boolean(removeTarget)}
        title="Remove from history?"
        message="This removes the request from your accepted requests view. It does not affect the original request or its creator. This cannot be undone."
        confirmLabel="Remove from history"
        destructive
        loading={removing}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeAccepted}
      />
    </div>
  );
}
