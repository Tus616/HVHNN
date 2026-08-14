import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, HeartHandshake, MapPin, MessageSquare, Navigation, RotateCcw, ShieldCheck, Trash2, UserRound, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import apiService from '../services/api';
import { normalizeApiError } from '../utils/errors';
import { timeAgo } from '../utils/timeUtils';
import { Alert, Avatar, Badge, Button, Card, ConfirmationDialog, EmptyState, ErrorState, FormField, Skeleton, StatusBadge, Textarea, UrgencyBadge, UserSummary } from '../components/ui';

const EVENT_LABELS = {
  REQUEST_RAISED: ['Request created', 'The requester shared the help request.'],
  VOLUNTEER_ACCEPTED: ['Volunteer accepted', 'A verified volunteer accepted the request.'],
  REQUEST_ACCEPTED: ['Volunteer accepted', 'A verified volunteer accepted the request.'],
  ON_THE_WAY: ['On the way', 'The volunteer is travelling to the location.'],
  VOLUNTEER_ON_THE_WAY: ['On the way', 'The volunteer is travelling to the location.'],
  REACHED: ['Reached', 'The volunteer reached the location.'],
  VOLUNTEER_REACHED: ['Reached', 'The volunteer reached the location.'],
  HELPING: ['Help started', 'The volunteer started helping.'],
  HELP_STARTED: ['Help started', 'The volunteer started helping.'],
  COMPLETION_REQUESTED: ['Completion requested', 'The volunteer asked the requester to verify completion.'],
  PENDING_COMPLETION: ['Completion requested', 'The volunteer asked the requester to verify completion.'],
  COMPLETION_REJECTED: ['Completion rejected', 'The requester asked for more help.'],
  COMPLETION_VERIFIED: ['Completion verified', 'The requester confirmed help was completed.'],
  REQUEST_COMPLETED: ['Request completed', 'This request has been completed.'],
  COMPLETED: ['Request completed', 'This request has been completed.'],
  REQUEST_CANCELLED: ['Request cancelled', 'The requester cancelled this request.'],
  CANCELLED: ['Request cancelled', 'The requester cancelled this request.'],
  VOLUNTEER_WITHDREW: ['Volunteer withdrew', 'The volunteer withdrew from this request.'],
};

function normalizeStatus(request) {
  const status = String(request?.status || 'OPEN').toUpperCase();
  if (status === 'ACTIVE' || status === 'ACCEPTED') return 'ASSIGNED';
  if (status === 'PENDING_COMPLETION') return 'COMPLETION_REQUESTED';
  return status;
}

function safeLocation(request) {
  return [request?.address || request?.location, request?.city, request?.district, request?.state].filter(Boolean).join(', ') || 'Location details unavailable';
}

function actorName(entry) {
  return entry.actorName || entry.actor?.fullName || entry.userName || 'Sahay';
}

function commentAuthorName(comment) {
  return comment.authorName || comment.author?.fullName || comment.author || 'Member';
}

function Timeline({ request }) {
  const events = Array.isArray(request.timeline) ? request.timeline : [];
  const fallback = [{
    event: 'REQUEST_RAISED',
    actorName: request.requester?.fullName || 'Requester',
    timestamp: request.createdAtEpochMs || request.createdAt,
  }];
  const entries = events.length > 0 ? events : fallback;
  return (
    <Card className="p7-detail-card">
      <div className="p7-section-heading">
        <h2>Timeline</h2>
        <p>Readable request progress without internal enum noise.</p>
      </div>
      <div className="p7-timeline">
        {entries.map((entry, index) => {
          const [label, description] = EVENT_LABELS[entry.event] || [String(entry.event || 'Update').replace(/_/g, ' '), entry.description || 'Request activity updated.'];
          return (
            <div className="p7-timeline-item" key={`${entry.event}-${entry.timestamp}-${index}`}>
              <span className="p7-timeline-dot"><CheckCircle2 size={16} /></span>
              <div>
                <strong>{label}</strong>
                <p>{entry.description || description}</p>
                <small>{actorName(entry)} · {entry.timestamp ? timeAgo(entry.timestamp) : 'Time unavailable'}</small>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Comments({ comments, value, onChange, onSubmit, submitting, user, onDeleteComment, deletingComment }) {
  const currentUserId = user?.userId || user?.id;
  const canDeleteComment = (comment) => {
    const authorId = comment.authorId || comment.userId || comment.author?.id;
    return user?.role === 'ADMIN' || String(authorId || '') === String(currentUserId || '');
  };

  return (
    <Card className="p7-detail-card">
      <div className="p7-section-heading">
        <h2>Comments</h2>
        <p>Use comments for clarifying safe, practical details.</p>
      </div>
      {comments.length === 0 ? (
        <EmptyState title="No comments yet" message="Ask a useful question or share how you can help." />
      ) : (
        <div className="p7-comments-list">
          {comments.map((comment) => (
            <article key={comment.id || `${comment.createdAt}-${comment.text}`} className="p7-comment">
              <Avatar name={commentAuthorName(comment)} src={comment.authorProfileImage || comment.avatarUrl || comment.author?.avatarUrl || comment.author?.profileImage} />
              <div>
                <div className="p7-comment__header">
                  <span><strong>{commentAuthorName(comment)}</strong><small>{timeAgo(comment.time || comment.createdAt)}</small></span>
                  {comment.id && canDeleteComment(comment) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={deletingComment === comment.id}
                      onClick={() => onDeleteComment(comment)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
                <p>{comment.text || comment.body}</p>
              </div>
            </article>
          ))}
        </div>
      )}
      <form className="p7-comment-form" onSubmit={onSubmit}>
        <FormField label="Add a comment" hint={`${value.length}/500 characters`}>
          <Textarea rows={3} maxLength={500} value={value} onChange={(event) => onChange(event.target.value)} />
        </FormField>
        <Button type="submit" loading={submitting} disabled={!value.trim() || value.length > 500}><MessageSquare size={16} /> Post Comment</Button>
      </form>
    </Card>
  );
}

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { notifyRequestAccepted, notifyRequestCompleted, notifyPoints, showToast } = useNotifications();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState('');
  const [deletingComment, setDeletingComment] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  const loadRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getRequestById(id);
      const nextRequest = response.data || null;
      setRequest(nextRequest);
      const commentsResponse = await apiService.getRequestComments(id);
      setComments((commentsResponse.data || []).map((comment) => ({
        ...comment,
        author: commentAuthorName(comment),
        authorId: comment.authorId || comment.userId || comment.author?.id,
        time: comment.createdAt || comment.time,
      })));
    } catch (err) {
      setError(normalizeApiError(err, 'Could not load this request.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequest();
  }, [id]);

  const status = normalizeStatus(request);
  const requesterId = request?.requester?.id || request?.requesterId || request?.userId;
  const volunteerId = request?.volunteer?.id || request?.volunteerId;
  const currentUserId = user?.userId || user?.id;
  const isRequester = String(requesterId) === String(currentUserId);
  const isVolunteer = String(volunteerId) === String(currentUserId);
  const isPendingCompletion = status === 'COMPLETION_REQUESTED';
  const activeVolunteerState = ['ASSIGNED', 'IN_PROGRESS'].includes(status);

  const primaryAction = useMemo(() => {
    if (!request) return null;
    if (status === 'OPEN' && !isRequester && user?.isVolunteer && request.canAccept !== false) {
      return { key: 'accept', label: 'Accept Request', icon: HeartHandshake, kind: 'primary', run: () => apiService.acceptRequest(id, user) };
    }
    if (activeVolunteerState && isVolunteer) {
      const progress = String(request.volunteerProgressStatus || '').toUpperCase();
      if (!progress || progress === 'ASSIGNED') return { key: 'ON_THE_WAY', label: 'Mark On the Way', icon: Navigation, kind: 'primary', run: () => apiService.updateVolunteerRequestStatus(id, 'ON_THE_WAY', user) };
      if (progress === 'ON_THE_WAY') return { key: 'REACHED', label: 'Mark Reached', icon: MapPin, kind: 'primary', run: () => apiService.updateVolunteerRequestStatus(id, 'REACHED', user) };
      if (progress === 'REACHED') return { key: 'HELPING', label: 'Start Helping', icon: ShieldCheck, kind: 'primary', run: () => apiService.updateVolunteerRequestStatus(id, 'HELPING', user) };
      return { key: 'completion', label: 'Request Completion', icon: CheckCircle2, kind: 'primary', run: () => apiService.requestCompletion(id, user) };
    }
    if (isPendingCompletion && isRequester) {
      return { key: 'verify', label: 'Confirm Completion', icon: CheckCircle2, kind: 'primary', run: () => apiService.verifyRequestCompletion(id, user) };
    }
    return null;
  }, [activeVolunteerState, id, isPendingCompletion, isRequester, isVolunteer, request, status, user]);

  const runAction = async (action) => {
    if (!action || actionLoading) return;
    setActionLoading(action.key);
    try {
      await action.run();
      if (action.key === 'accept') {
        notifyRequestAccepted?.(request, user?.fullName);
        notifyPoints?.(10, 'accepting a help request');
      }
      if (action.key === 'verify') {
        notifyRequestCompleted?.(request);
        notifyPoints?.(50, 'verified completion');
      }
      if (action.key === 'delete') {
        showToast({ type: 'success', title: 'Request deleted', message: 'The request was permanently deleted.' });
        navigate('/my-requests', { replace: true });
        return;
      }
      showToast({ type: 'success', title: 'Request updated', message: 'Latest request status loaded.' });
      await loadRequest();
    } catch (err) {
      const normalized = normalizeApiError(err, 'Could not update this request.');
      showToast({ type: 'error', title: 'Action failed', message: normalized.message });
    } finally {
      setActionLoading('');
    }
  };

  const requestConfirmation = (action, message) => {
    setConfirmAction({
      ...action,
      message,
    });
  };

  const addComment = async (event) => {
    event.preventDefault();
    if (!commentText.trim()) return;
    setCommenting(true);
    try {
      const response = await apiService.addRequestComment(id, commentText.trim());
      const comment = response.data || {};
      setComments((current) => [...current, {
        ...comment,
        text: comment.text || commentText.trim(),
        author: comment.authorName || comment.author || user?.fullName || 'You',
        authorProfileImage: comment.authorProfileImage || comment.avatarUrl || user?.profileImage || user?.avatarUrl,
        avatarUrl: comment.avatarUrl || comment.authorProfileImage || user?.avatarUrl || user?.profileImage,
        time: comment.createdAt || new Date().toISOString(),
      }]);
      setCommentText('');
    } catch (err) {
      const normalized = normalizeApiError(err, 'Could not post this comment.');
      showToast({ type: 'error', title: 'Comment failed', message: normalized.message });
    } finally {
      setCommenting(false);
    }
  };

  const deleteComment = async (comment) => {
    setDeletingComment(comment.id);
    try {
      await apiService.deleteRequestComment(id, comment.id);
      setComments((current) => current.filter((entry) => entry.id !== comment.id));
      showToast({ type: 'success', title: 'Comment deleted', message: 'The comment was removed from this request.' });
    } catch (err) {
      const normalized = normalizeApiError(err, 'Could not delete this comment.');
      showToast({ type: 'error', title: 'Delete failed', message: normalized.message });
    } finally {
      setDeletingComment('');
    }
  };

  if (loading) {
    return <div className="p7-detail"><Skeleton lines={8} /><Skeleton lines={6} /></div>;
  }

  if (error) {
    return <ErrorState title="Request unavailable" message={error.message} onRetry={loadRequest} />;
  }

  if (!request) {
    return <EmptyState title="Request not found" message="This request may have been deleted or you may not have access." actionLabel="Back to Feed" actionTo="/feed" />;
  }

  const ActionIcon = primaryAction?.icon;

  return (
    <div className="p7-detail">
      <Link to="/feed" className="p7-back-link">Back to feed</Link>
      <section className="p7-detail-hero">
        <div>
          <div className="p7-request-card__badges">
            <UrgencyBadge urgency={request.urgency} />
            <StatusBadge status={status} />
            <Badge variant="default">{String(request.category || 'GENERAL').replace(/_/g, ' ')}</Badge>
            {request.community?.name && <Badge variant="info">{request.community.name}</Badge>}
          </div>
          <h1>{request.title}</h1>
          <p>{request.description}</p>
          <div className="p7-detail-meta">
            <span><Clock size={16} /> {timeAgo(request.createdAtEpochMs || request.createdAt)}</span>
            <span><MapPin size={16} /> {safeLocation(request)}</span>
            {request.distanceKm != null && <span>{Number(request.distanceKm).toFixed(1)} km away</span>}
          </div>
        </div>
      </section>

      <div className="p7-detail-layout">
        <main className="p7-detail-main">
          <Card className="p7-detail-card">
            <div className="p7-section-heading">
              <h2>Request Summary</h2>
              <p>Visible details are intentionally practical and safe.</p>
            </div>
            <div className="p7-summary-grid">
              <div><span>Request ID</span><strong>{request.id}</strong></div>
              <div><span>Category</span><strong>{String(request.category || 'GENERAL').replace(/_/g, ' ')}</strong></div>
              <div><span>Status</span><strong>{status.replace(/_/g, ' ')}</strong></div>
              <div><span>Urgency</span><strong>{request.urgency || 'MEDIUM'}</strong></div>
              <div><span>Location</span><strong>{safeLocation(request)}</strong></div>
              <div><span>Contact</span><strong>{request.contactPhone || request.contact || 'Use in-app updates'}</strong></div>
              {request.distanceKm != null && <div><span>Distance</span><strong>{Number(request.distanceKm).toFixed(1)} km</strong></div>}
              <div><span>Created</span><strong>{request.createdAtEpochMs || request.createdAt ? timeAgo(request.createdAtEpochMs || request.createdAt) : 'Recently'}</strong></div>
              <div><span>Views</span><strong>{request.viewCount ?? request.views ?? 0}</strong></div>
              <div><span>Responses</span><strong>{request.responseCount ?? request.responses ?? 0}</strong></div>
            </div>
          </Card>
          <Timeline request={request} />
          <Comments
            comments={comments}
            value={commentText}
            onChange={setCommentText}
            onSubmit={addComment}
            submitting={commenting}
            user={user}
            deletingComment={deletingComment}
            onDeleteComment={(comment) => requestConfirmation({
              key: `delete-comment-${comment.id}`,
              label: 'Delete Comment',
              run: () => deleteComment(comment),
            }, 'Delete this comment from the request?')}
          />
        </main>

        <aside className="p7-action-panel">
          <Card>
            <div className="p7-section-heading">
              <h2>Action Panel</h2>
              <p>{isRequester ? 'Requester controls' : isVolunteer ? 'Volunteer controls' : 'Available actions'}</p>
            </div>
            {primaryAction ? (
              <Button
                type="button"
                size="lg"
                variant={primaryAction.kind}
                loading={actionLoading === primaryAction.key}
                onClick={() => runAction(primaryAction)}
              >
                {ActionIcon && <ActionIcon size={18} />} {primaryAction.label}
              </Button>
            ) : (
              <Alert title={isRequester ? 'Request availability' : 'No action available'}>
                {isRequester ? 'Use the availability controls below for open or closed requests.' : 'This request does not have an action available for your current role and state.'}
              </Alert>
            )}

            {isRequester && (status === 'OPEN' || status === 'CANCELLED') && (
              <div className="p7-action-toggle" role="group" aria-label="Request availability">
                <Button
                  type="button"
                  variant={status === 'OPEN' ? 'primary' : 'secondary'}
                  loading={actionLoading === 'keep-open'}
                  onClick={() => runAction({ key: 'keep-open', label: 'Keep Open', run: () => apiService.updateRequestAvailability(id, 'OPEN') })}
                >
                  <CheckCircle2 size={16} /> Keep Open
                </Button>
                <Button
                  type="button"
                  variant={status === 'CANCELLED' ? 'primary' : 'secondary'}
                  loading={actionLoading === 'close'}
                  onClick={() => requestConfirmation({
                    key: 'close',
                    label: 'Close Request',
                    run: () => apiService.updateRequestAvailability(id, 'CLOSED'),
                  }, 'Close this request so volunteers no longer see it as open?')}
                >
                  <XCircle size={16} /> Close Request
                </Button>
              </div>
            )}

            {activeVolunteerState && isVolunteer && (
              <Button
                type="button"
                variant="danger"
                onClick={() => requestConfirmation({
                  key: 'withdraw',
                  label: 'Withdraw',
                  run: () => apiService.withdrawRequest(id),
                }, 'Withdraw from this request? The requester will need another volunteer.')}
                loading={actionLoading === 'withdraw'}
              >
                <XCircle size={16} /> Withdraw
              </Button>
            )}

            {isPendingCompletion && isRequester && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => requestConfirmation({
                  key: 'reject',
                  label: 'Reject Completion',
                  run: () => apiService.rejectRequestCompletion(id, user),
                }, 'Reject completion and return the request to active help?')}
                loading={actionLoading === 'reject'}
              >
                <RotateCcw size={16} /> Reject Completion
              </Button>
            )}

            {(activeVolunteerState || isPendingCompletion) && isRequester && (
              <Button
                type="button"
                variant="danger"
                onClick={() => requestConfirmation({
                  key: 'cancel',
                  label: 'Cancel Request',
                  run: () => apiService.cancelRequest(id),
                }, 'Cancel this help request? Volunteers will no longer be able to accept it.')}
                loading={actionLoading === 'cancel'}
              >
                <XCircle size={16} /> Cancel Request
              </Button>
            )}

            {isRequester && (
              <Button
                type="button"
                variant="danger"
                onClick={() => requestConfirmation({
                  key: 'delete',
                  label: 'Delete Request',
                  run: () => apiService.deleteRequest(id),
                }, 'Permanently delete this request and its request-specific records? This cannot be undone.')}
                loading={actionLoading === 'delete'}
              >
                <Trash2 size={16} /> Delete Request
              </Button>
            )}
          </Card>

          <Card>
            <div className="p7-section-heading">
              <h2>People</h2>
              <p>Public-safe participant details.</p>
            </div>
            <UserSummary user={request.requester || { name: request.requesterName || 'Requester', role: 'Requester' }} />
            {request.volunteer ? <UserSummary user={{ ...request.volunteer, role: 'Volunteer' }} /> : <p className="p7-muted"><UserRound size={16} /> No volunteer assigned yet.</p>}
          </Card>

          <Card className="p7-safety-note">
            <AlertTriangle size={20} />
            <strong>Safety reminder</strong>
            <p>Keep sensitive documents, exact private details, and payments out of comments. Use status updates for coordination.</p>
          </Card>
        </aside>
      </div>

      <ConfirmationDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.label}
        message={confirmAction?.message}
        confirmLabel={confirmAction?.label}
        destructive
        loading={actionLoading === confirmAction?.key}
        onClose={() => setConfirmAction(null)}
        onConfirm={async () => {
          const action = confirmAction;
          setConfirmAction(null);
          await runAction(action);
        }}
      />
    </div>
  );
}
