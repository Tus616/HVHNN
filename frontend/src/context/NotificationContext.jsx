import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';
import apiService from '../services/api';
import { API_BASE_URL } from '../services/apiConfig';
import { requestFirebaseMessagingToken, subscribeForegroundMessages } from '../services/firebase';
import { getStoredToken } from '../utils/sessionStorage';

const NotificationContext = createContext(null);

const CATEGORY_TYPE = {
  REQUEST: 'request',
  COMMUNITY: 'community',
  QNA: 'community',
  CAMPAIGN: 'community',
  CHAT: 'community',
  SYSTEM: 'system',
  SECURITY: 'system',
};

function safeParse(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function socketUrl(token) {
  const configuredUrl = import.meta.env.VITE_NOTIFICATION_WS_URL || import.meta.env.VITE_CHAT_WS_URL;
  if (configuredUrl) {
    return `${configuredUrl}?token=${encodeURIComponent(token)}`;
  }
  return `${API_BASE_URL.replace(/\/api$/i, '')}/ws?token=${encodeURIComponent(token)}`;
}

function normalizeNotification(notification) {
  if (!notification) return null;
  const createdAt = notification.createdAt || notification.time || new Date().toISOString();
  const type = CATEGORY_TYPE[notification.category] || CATEGORY_TYPE[notification.type] || String(notification.type || 'system').toLowerCase();
  return {
    ...notification,
    id: notification.id,
    type,
    rawType: notification.type,
    message: notification.body || notification.message || '',
    link: notification.actionUrl || notification.link || '#',
    time: createdAt,
    createdAt,
    read: Boolean(notification.read),
  };
}

function normalizeList(items) {
  return (items || []).map(normalizeNotification).filter(Boolean);
}

function toastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [pushPermission, setPushPermission] = useState(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ));
  const clientRef = useRef(null);
  const mountedRef = useRef(false);
  const notificationsRef = useRef([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  const refreshUnreadCount = useCallback(async () => {
    if (!getStoredToken()) {
      setUnreadCount(0);
      return 0;
    }
    const response = await apiService.getNotificationUnreadCount();
    const count = Number(response.data?.unreadCount ?? 0);
    setUnreadCount(count);
    return count;
  }, []);

  const refreshNotifications = useCallback(async (params = {}) => {
    if (!getStoredToken()) {
      setNotifications([]);
      setUnreadCount(0);
      return [];
    }
    const response = await apiService.getNotifications({ page: 0, limit: 50, ...params });
    const next = normalizeList(response.data?.notifications);
    setNotifications(next);
    await refreshUnreadCount().catch(() => {});
    return next;
  }, [refreshUnreadCount]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((notif) => {
    const id = toastId();
    const toast = {
      id,
      type: notif?.type || 'system',
      title: notif?.title || 'Sahay notification',
      message: notif?.body || notif?.message || '',
      link: notif?.actionUrl || notif?.link,
    };
    setToasts((current) => [...current, toast]);
    window.setTimeout(() => removeToast(id), 3000);
    return toast;
  }, [removeToast]);

  const mergeNotification = useCallback((notification, { toast = true } = {}) => {
    const normalized = normalizeNotification(notification);
    if (!normalized?.id) return;
    const existing = notificationsRef.current.find((entry) => entry.id === normalized.id);
    const shouldIncrement = !normalized.read && (!existing || existing.read);
    setNotifications((current) => {
      const withoutDuplicate = current.filter((entry) => entry.id !== normalized.id);
      return [normalized, ...withoutDuplicate].slice(0, 50);
    });
    if (shouldIncrement) setUnreadCount((count) => count + 1);
    if (toast) showToast(normalized);
  }, [showToast]);

  const markAsRead = useCallback(async (id) => {
    const response = await apiService.markNotificationRead(id);
    const updated = normalizeNotification(response.data);
    setNotifications((current) => current.map((entry) => entry.id === id ? updated : entry));
    await refreshUnreadCount();
    return updated;
  }, [refreshUnreadCount]);

  const markAsUnread = useCallback(async (id) => {
    const response = await apiService.markNotificationUnread(id);
    const updated = normalizeNotification(response.data);
    setNotifications((current) => current.map((entry) => entry.id === id ? updated : entry));
    await refreshUnreadCount();
    return updated;
  }, [refreshUnreadCount]);

  const markAllAsRead = useCallback(async (params = {}) => {
    await apiService.markAllNotificationsRead(params);
    setNotifications((current) => current.map((entry) => ({ ...entry, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAll = useCallback(async () => {
    const ids = notifications.map((entry) => entry.id);
    await Promise.allSettled(ids.map((id) => apiService.deleteNotification(id)));
    setNotifications([]);
    await refreshUnreadCount();
  }, [notifications, refreshUnreadCount]);

  const deleteNotification = useCallback(async (id) => {
    await apiService.deleteNotification(id);
    setNotifications((current) => current.filter((entry) => entry.id !== id));
    await refreshUnreadCount();
  }, [refreshUnreadCount]);

  const togglePanel = useCallback(() => {
    setShowPanel((current) => !current);
    refreshNotifications().catch(() => {});
  }, [refreshNotifications]);

  const closePanel = useCallback(() => {
    setShowPanel(false);
  }, []);

  const enablePushNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined' || !navigator?.serviceWorker) {
      setPushPermission('unsupported');
      return '';
    }
    const permission = await Notification.requestPermission();
    setPushPermission(permission);
    if (permission !== 'granted') return '';

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await requestFirebaseMessagingToken(registration);
    if (!token) return '';
    await apiService.registerNotificationDevice({
      token,
      platform: 'WEB',
      deviceId: navigator.userAgent,
      appVersion: import.meta.env.VITE_APP_VERSION || 'web',
    });
    await apiService.updateNotificationPreferences({ pushEnabled: true });
    return token;
  }, []);

  const disablePushNotifications = useCallback(async () => {
    const devices = await apiService.listNotificationDevices();
    await Promise.allSettled((devices.data || []).map((device) => apiService.deleteNotificationDevice(device.id)));
    await apiService.updateNotificationPreferences({ pushEnabled: false });
  }, []);

  const addNotification = useCallback((notif) => {
    showToast(notif);
    refreshNotifications().catch(() => {});
    return normalizeNotification({ id: toastId(), ...notif });
  }, [refreshNotifications, showToast]);

  const notifyRequestCreated = useCallback((request) => {
    addNotification({
      type: 'request',
      title: `New ${request?.urgency || 'MEDIUM'} Request`,
      message: `"${request?.title || 'Help Request'}" was raised${request?.address ? ` near ${request.address}` : ''}.`,
      link: `/request/${request?.id}`,
    });
  }, [addNotification]);

  const notifyRequestAccepted = useCallback((request, volunteerName) => {
    addNotification({
      type: 'volunteer',
      title: 'Volunteer Accepted',
      message: `${volunteerName} accepted the request "${request?.title || 'Help Request'}".`,
      link: `/request/${request?.id}`,
    });
  }, [addNotification]);

  const notifyRequestCompleted = useCallback((request) => {
    addNotification({
      type: 'success',
      title: 'Request Completed',
      message: `The request "${request?.title || 'Help Request'}" has been completed.`,
      link: `/request/${request?.id}`,
    });
  }, [addNotification]);

  const notifyCommunityJoined = useCallback((communityName) => {
    addNotification({ type: 'community', title: 'Community Joined', message: `You joined "${communityName}".`, link: '/communities' });
  }, [addNotification]);

  const notifyCommunityCreated = useCallback((communityName, code) => {
    addNotification({ type: 'community', title: 'Community Created', message: `"${communityName}" is live. Share code "${code}".`, link: '/communities' });
  }, [addNotification]);

  const notifyPoints = useCallback((points, reason) => {
    addNotification({ type: 'reward', title: 'Points Earned', message: `You earned ${points} points for ${reason}.`, link: '/profile' });
  }, [addNotification]);

  const notifyCommunityBroadcast = useCallback((communityId, message) => {
    addNotification({ type: 'community', title: 'Community Broadcast', message, link: `/community/${communityId}` });
  }, [addNotification]);

  const notifyChatMessage = useCallback((_roomId, senderName, content) => {
    addNotification({ type: 'community', title: `New Message from ${senderName || 'Sahay'}`, message: content, link: '/chats' });
  }, [addNotification]);

  useEffect(() => {
    mountedRef.current = true;
    const token = getStoredToken();
    refreshNotifications().catch(() => {});
    if (!token) return () => { mountedRef.current = false; };

    const client = new Client({
      reconnectDelay: 5000,
      webSocketFactory: () => new SockJS(socketUrl(token)),
      debug: () => {},
    });

    client.onConnect = () => {
      client.subscribe('/user/queue/notifications', (frame) => {
        const notification = safeParse(frame.body);
        mergeNotification(notification);
      });
      client.subscribe('/user/queue/notification-count', (frame) => {
        const body = safeParse(frame.body);
        setUnreadCount(Number(body?.unreadCount ?? body?.count ?? 0));
      });
    };
    clientRef.current = client;
    client.activate();

    let unsubscribeForeground = () => {};
    subscribeForegroundMessages((payload) => {
      const data = payload?.data || {};
      showToast({
        title: payload?.notification?.title || 'Sahay notification',
        message: payload?.notification?.body || '',
        link: data.actionUrl,
      });
      refreshNotifications().catch(() => {});
    }).then((unsubscribe) => {
      unsubscribeForeground = unsubscribe;
    }).catch(() => {});

    const onAuthExpired = () => {
      setNotifications([]);
      setUnreadCount(0);
      client.deactivate();
    };
    window.addEventListener('hvhn:auth-expired', onAuthExpired);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('hvhn:auth-expired', onAuthExpired);
      unsubscribeForeground();
      client.deactivate();
      clientRef.current = null;
    };
  }, [mergeNotification, refreshNotifications, showToast]);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    showPanel,
    toasts,
    pushPermission,
    addNotification,
    refreshNotifications,
    refreshUnreadCount,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    clearAll,
    deleteNotification,
    togglePanel,
    closePanel,
    showToast,
    removeToast,
    enablePushNotifications,
    disablePushNotifications,
    notifyRequestCreated,
    notifyRequestAccepted,
    notifyRequestCompleted,
    notifyCommunityJoined,
    notifyCommunityCreated,
    notifyPoints,
    notifyCommunityBroadcast,
    notifyChatMessage,
  }), [
    notifications, unreadCount, showPanel, toasts, pushPermission, addNotification,
    refreshNotifications, refreshUnreadCount, markAsRead, markAsUnread, markAllAsRead,
    clearAll, deleteNotification, togglePanel, closePanel, showToast, removeToast, enablePushNotifications,
    disablePushNotifications, notifyRequestCreated, notifyRequestAccepted, notifyRequestCompleted,
    notifyCommunityJoined, notifyCommunityCreated, notifyPoints, notifyCommunityBroadcast,
    notifyChatMessage,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider');
  return ctx;
}
