import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, ChevronRight, Filter, MessageSquare, RefreshCcw, Shield, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import apiService from '../services/api';
import { useNotifications } from '../context/NotificationContext';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui';
import { safeInternalPath } from '../utils/errors';
import { timeAgo } from '../utils/timeUtils';

const FILTERS = [
  { id: 'all', label: 'All', category: '' },
  { id: 'unread', label: 'Unread', unreadOnly: true },
  { id: 'requests', label: 'Requests', category: 'REQUEST' },
  { id: 'communities', label: 'Communities', category: 'COMMUNITY' },
  { id: 'qna', label: 'Q&A', category: 'QNA' },
  { id: 'campaigns', label: 'Campaigns', category: 'CAMPAIGN' },
  { id: 'messages', label: 'Messages', category: 'CHAT' },
  { id: 'system', label: 'System', category: 'SYSTEM' },
];

const CATEGORY_ICONS = {
  REQUEST: Bell,
  COMMUNITY: Users,
  QNA: MessageSquare,
  CAMPAIGN: Users,
  CHAT: MessageSquare,
  SYSTEM: Shield,
  SECURITY: Shield,
};

function normalizeNotification(notification) {
  const createdAt = notification.createdAt || notification.time || new Date().toISOString();
  return {
    ...notification,
    message: notification.body || notification.message || '',
    link: notification.actionUrl || notification.link || '/notifications',
    time: createdAt,
    createdAt,
    read: Boolean(notification.read),
  };
}

function dayLabel(value) {
  const date = value ? new Date(value) : new Date();
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left, right) => left.toDateString() === right.toDateString();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return 'Earlier';
}

function groupNotifications(items) {
  return items.reduce((groups, item) => {
    const label = dayLabel(item.createdAt || item.time);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
    return groups;
  }, {});
}

export default function Notifications() {
  const {
    notifications: realtimeNotifications,
    unreadCount,
    refreshUnreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const [activeFilter, setActiveFilter] = useState('all');
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const filter = FILTERS.find((entry) => entry.id === activeFilter) || FILTERS[0];

  async function load(nextPage = 0, append = false) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const response = await apiService.getNotifications({
        page: nextPage,
        limit: 20,
        category: filter.category || undefined,
        unreadOnly: filter.unreadOnly || undefined,
      });
      const nextItems = (response.data?.notifications || []).map(normalizeNotification);
      setItems((current) => append ? [...current, ...nextItems.filter((item) => !current.some((entry) => entry.id === item.id))] : nextItems);
      setPage(nextPage);
      setHasMore(Boolean(response.data?.hasMore || response.data?.nextPage));
      refreshUnreadCount().catch(() => {});
    } catch (loadError) {
      setError(loadError.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load(0, false);
  }, [activeFilter]);

  useEffect(() => {
    if (activeFilter !== 'all' && activeFilter !== 'unread') return;
    setItems((current) => {
      const merged = [...realtimeNotifications, ...current].map(normalizeNotification);
      const seen = new Set();
      return merged.filter((item) => {
        if (!item.id || seen.has(item.id)) return false;
        if (activeFilter === 'unread' && item.read) return false;
        seen.add(item.id);
        return true;
      });
    });
  }, [activeFilter, realtimeNotifications]);

  async function markReadAndNavigate(notification) {
    if (!notification.read) {
      await markAsRead(notification.id).catch(() => {});
      setItems((current) => current.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    }
  }

  async function toggleRead(notification) {
    const action = notification.read ? markAsUnread : markAsRead;
    const updated = await action(notification.id);
    setItems((current) => current.map((item) => item.id === notification.id ? normalizeNotification(updated) : item));
  }

  async function remove(notificationId) {
    await deleteNotification(notificationId);
    setItems((current) => current.filter((item) => item.id !== notificationId));
  }

  async function handleMarkAllRead() {
    await markAllAsRead({ category: filter.category || undefined });
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  }

  const grouped = useMemo(() => groupNotifications(items), [items]);
  const emptyTitle = activeFilter === 'unread'
    ? 'No unread notifications'
    : filter.category
      ? `No ${filter.label.toLowerCase()} notifications yet`
      : 'You are all caught up';

  return (
    <div className="p7c-notifications">
      <PageHeader
        eyebrow="Notification center"
        title="Notifications"
        description="Scan request, community, message, system, and security updates from one compact timeline."
        action={(
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            <CheckCheck size={16} /> Mark all read
          </Button>
        )}
      />

      <Card className="p7c-notif-toolbar">
        <div>
          <Filter size={17} aria-hidden="true" />
          <strong>{unreadCount > 0 ? `${unreadCount} unread` : 'No unread notifications'}</strong>
        </div>
        <div className="p7c-notif-filters" role="tablist" aria-label="Notification filters">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={activeFilter === entry.id}
              className={activeFilter === entry.id ? 'is-active' : ''}
              onClick={() => setActiveFilter(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <Card><Skeleton lines={8} /></Card>
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(0, false)} />
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} message="New activity will appear here as it arrives." />
      ) : (
        <div className="p7c-notif-groups">
          {Object.entries(grouped).map(([label, groupItems]) => (
            <section key={label} className="p7c-notif-group" aria-label={label}>
              <h2>{label}</h2>
              <div className="p7c-notif-list">
                {groupItems.map((notification) => {
                  const Icon = CATEGORY_ICONS[notification.category] || Bell;
                  const href = safeInternalPath(notification.link, '/notifications');
                  return (
                    <Card key={notification.id} className={`p7c-notif-card ${notification.read ? '' : 'is-unread'}`}>
                      <span className="p7c-notif-dot" aria-label={notification.read ? 'Read notification' : 'Unread notification'} />
                      <div className="p7c-notif-icon"><Icon size={18} aria-hidden="true" /></div>
                      <Link className="p7c-notif-body" to={href} onClick={() => markReadAndNavigate(notification)}>
                        <div>
                          <strong>{notification.title || 'Notification'}</strong>
                          {!notification.read && <Badge variant="info">Unread</Badge>}
                          {notification.priority && <Badge variant={notification.priority === 'URGENT' ? 'danger' : 'default'}>{notification.priority}</Badge>}
                        </div>
                        <p>{notification.message}</p>
                        <time>{timeAgo(notification.time)}</time>
                      </Link>
                      <div className="p7c-notif-actions">
                        <Button type="button" variant="secondary" size="sm" onClick={() => toggleRead(notification)}>
                          {notification.read ? 'Mark unread' : 'Mark as read'}
                        </Button>
                        <Button type="button" variant="danger" size="sm" onClick={() => remove(notification.id)}>
                          <Trash2 size={14} /> Delete
                        </Button>
                      </div>
                      <ChevronRight size={17} className="p7c-notif-chevron" aria-hidden="true" />
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
          {hasMore && (
            <Button type="button" variant="secondary" onClick={() => load(page + 1, true)} loading={loadingMore}>
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
