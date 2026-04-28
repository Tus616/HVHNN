import { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

let notifIdCounter = 1;

const INITIAL_NOTIFICATIONS = [];

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [toasts, setToasts] = useState([]);
  const [showPanel, setShowPanel] = useState(false);


  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback((notif) => {
    const newNotif = {
      id: notifIdCounter++,
      time: new Date().toISOString(),
      read: false,
      ...notif,
    };
    setNotifications(prev => [newNotif, ...prev]);
    return newNotif;
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const togglePanel = useCallback(() => {
    setShowPanel(prev => !prev);
  }, []);

  const closePanel = useCallback(() => {
    setShowPanel(false);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((notif) => {
    const id = Date.now();
    const newToast = { id, ...notif };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => removeToast(id), 3000); // Auto-dismiss in 3s (Vercel-style)
  }, [removeToast]);


  // Firebase-style notification triggers
  const notifyRequestCreated = useCallback((request) => {
    addNotification({
      type: 'request',
      title: `🆘 New ${request.urgency || 'MEDIUM'} Request`,
      message: `"${request.title}" was raised${request.address ? ` near ${request.address}` : ''}.`,
      link: `/request/${request.id}`,
    });
  }, [addNotification]);

  const notifyRequestAccepted = useCallback((request, volunteerName) => {
    addNotification({
      type: 'volunteer',
      title: '🤝 Volunteer Accepted!',
      message: `${volunteerName} accepted the request "${request.title}".`,
      link: `/request/${request.id}`,
    });
  }, [addNotification]);

  const notifyRequestCompleted = useCallback((request) => {
    addNotification({
      type: 'success',
      title: '✅ Request Completed',
      message: `The request "${request.title}" has been completed. Thanks for helping!`,
      link: `/request/${request.id}`,
    });
  }, [addNotification]);

  const notifyCommunityJoined = useCallback((communityName) => {
    addNotification({
      type: 'community',
      title: '🏘️ Welcome to the Community!',
      message: `You successfully joined "${communityName}". Say hello!`,
      link: '/communities',
    });
  }, [addNotification]);

  const notifyCommunityCreated = useCallback((communityName, code) => {
    addNotification({
      type: 'community',
      title: '🏗️ Community Created!',
      message: `"${communityName}" is live! Share code "${code}" with members to join.`,
      link: '/communities',
    });
  }, [addNotification]);

  const notifyPoints = useCallback((points, reason) => {
    addNotification({
      type: 'reward',
      title: '⭐ Points Earned!',
      message: `You earned ${points} points for ${reason}.`,
      link: '/profile',
    });
  }, [addNotification]);

  const notifyCommunityBroadcast = useCallback((communityId, message) => {
    addNotification({
      type: 'community',
      title: '📢 Community Broadcast',
      message,
      link: `/community/${communityId}`,
    });
  }, [addNotification]);

  const notifyChatMessage = useCallback((roomId, senderName, content) => {
    addNotification({
      type: 'community',
      title: `💬 New Message from ${senderName}`,
      message: content,
      link: `/chats`,
    });
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      showPanel,
      toasts,
      addNotification,
      markAsRead,
      markAllAsRead,
      clearAll,
      togglePanel,
      closePanel,
      showToast,
      removeToast,
      notifyRequestCreated,
      notifyRequestAccepted,
      notifyRequestCompleted,
      notifyCommunityJoined,
      notifyCommunityCreated,
      notifyPoints,
      notifyCommunityBroadcast,
      notifyChatMessage,
    }}>
      {children}
    </NotificationContext.Provider>

  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside NotificationProvider');
  return ctx;
}
