import { useCallback, useEffect, useRef, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';
import apiService from '../services/api';
import { useNotifications } from '../context/NotificationContext';

function getStoredUserId() {
  try {
    const raw = window.localStorage.getItem('hvhn_user');
    const user = raw ? JSON.parse(raw) : null;
    return user?.userId || user?.id || '';
  } catch {
    return '';
  }
}

function buildSocketUrl(token) {
  const configuredUrl = import.meta.env.VITE_CHAT_WS_URL;
  if (configuredUrl) {
    return `${configuredUrl}?token=${encodeURIComponent(token)}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.hostname || 'localhost';
  return `${protocol}//${host}:8080/ws?token=${encodeURIComponent(token)}`;
}

function safeParse(messageBody) {
  try {
    return JSON.parse(messageBody);
  } catch {
    return null;
  }
}

export default function useChatSocket(roomId, token) {
  const { notifyChatMessage } = useNotifications();
  const currentRoomRef = useRef(roomId);
  const clientRef = useRef(null);
  const roomSubscriptionRef = useRef(null);
  const typingSubscriptionRef = useRef(null);
  const presenceSubscriptionRef = useRef(null);
  const roomUpdatesSubscriptionRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const successBannerTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const mountedRef = useRef(false);
  const manualShutdownRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);
  const typingExpiryRef = useRef({});
  const userIdRef = useRef(getStoredUserId());

  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});
  const [roomUpdates, setRoomUpdates] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('idle');

  currentRoomRef.current = roomId;

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearSuccessBannerTimer = useCallback(() => {
    if (successBannerTimerRef.current) {
      window.clearTimeout(successBannerTimerRef.current);
      successBannerTimerRef.current = null;
    }
  }, []);

  const clearTypingExpiry = useCallback((userId) => {
    const timer = typingExpiryRef.current[userId];
    if (timer) {
      window.clearTimeout(timer);
      delete typingExpiryRef.current[userId];
    }
  }, []);

  const clearAllTypingExpiry = useCallback(() => {
    Object.keys(typingExpiryRef.current).forEach((userId) => clearTypingExpiry(userId));
  }, [clearTypingExpiry]);

  const unsubscribeRoomSubscriptions = useCallback(() => {
    roomSubscriptionRef.current?.unsubscribe();
    typingSubscriptionRef.current?.unsubscribe();
    roomSubscriptionRef.current = null;
    typingSubscriptionRef.current = null;
  }, []);

  const fetchOnlineUsers = useCallback(async () => {
    try {
      const response = await apiService.getOnlineUsers();
      if (!mountedRef.current) return;

      const nextOnlineUsers = {};
      for (const presence of response.data || []) {
        nextOnlineUsers[presence.userId] = presence;
      }
      setOnlineUsers((current) => ({ ...current, ...nextOnlineUsers }));
    } catch {
      // Keep the socket usable even if the presence bootstrap request fails.
    }
  }, []);

  const publishPresence = useCallback((status) => {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: '/app/presence.update',
      body: JSON.stringify({ status }),
    });
  }, []);

  const subscribeToActiveRoom = useCallback(() => {
    unsubscribeRoomSubscriptions();
    clearAllTypingExpiry();
    setTypingUsers([]);

    if (!clientRef.current?.connected || !currentRoomRef.current) {
      return;
    }

    roomSubscriptionRef.current = clientRef.current.subscribe(
      `/topic/chat/${currentRoomRef.current}`,
      (frame) => {
        const message = safeParse(frame.body);
        if (!message || !message.id) return;

        setMessages((current) => {
          if (current.some((entry) => entry.id === message.id)) {
            return current;
          }
          return [...current, message];
        });
      }
    );

    typingSubscriptionRef.current = clientRef.current.subscribe(
      `/topic/typing/${currentRoomRef.current}`,
      (frame) => {
        const event = safeParse(frame.body);
        if (!event || !event.userId || event.roomId !== currentRoomRef.current) return;

        setTypingUsers((current) => {
          const withoutUser = current.filter((entry) => entry.userId !== event.userId);
          if (!event.typing) return withoutUser;
          return [...withoutUser, event];
        });

        clearTypingExpiry(event.userId);
        if (event.typing) {
          typingExpiryRef.current[event.userId] = window.setTimeout(() => {
            setTypingUsers((current) => current.filter((entry) => entry.userId !== event.userId));
            delete typingExpiryRef.current[event.userId];
          }, 2500);
        }
      }
    );
  }, [clearAllTypingExpiry, clearTypingExpiry, unsubscribeRoomSubscriptions]);

  const handleDisconnect = useCallback(() => {
    if (!mountedRef.current || manualShutdownRef.current) return;

    setIsConnected(false);
    clearSuccessBannerTimer();
    setConnectionStatus(hasConnectedOnceRef.current ? 'reconnecting' : 'idle');

    if (reconnectTimerRef.current || !token) return;

    const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 10000);
    reconnectAttemptRef.current += 1;
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      const client = clientRef.current;
      if (mountedRef.current && !manualShutdownRef.current) {
        client?.deactivate();
        connect();
      }
    }, delay);
  }, [clearSuccessBannerTimer, token]);

  const connect = useCallback(() => {
    if (!token || !mountedRef.current) return;

    const client = new Client({
      reconnectDelay: 0,
      webSocketFactory: () => new SockJS(buildSocketUrl(token)),
      debug: () => {},
    });

    client.onConnect = () => {
      clearReconnectTimer();
      reconnectAttemptRef.current = 0;
      setIsConnected(true);
      presenceSubscriptionRef.current?.unsubscribe();
      roomUpdatesSubscriptionRef.current?.unsubscribe();

      presenceSubscriptionRef.current = client.subscribe('/topic/presence', (frame) => {
        const presence = safeParse(frame.body);
        if (!presence?.userId) return;
        setOnlineUsers((current) => ({ ...current, [presence.userId]: presence }));
      });

      const storedUserId = userIdRef.current;
      if (storedUserId) {
        roomUpdatesSubscriptionRef.current = client.subscribe(`/topic/rooms/${storedUserId}`, (frame) => {
          const room = safeParse(frame.body);
          if (!room?.id) return;
          setRoomUpdates((current) => ({ ...current, [room.id]: room }));
        });
        
        client.subscribe(`/user/queue/chat/messages`, (msg) => {
          try {
            const body = JSON.parse(msg.body);
            setMessages((prev) => [...prev, body]);
            
            if (document.hidden || currentRoomRef.current !== body.roomId) {
              notifyChatMessage(body.roomId, body.senderName, body.content);
            }
          } catch {
            // ignore parsing error
          }
        });
      }

      subscribeToActiveRoom();
      fetchOnlineUsers();
      publishPresence('ONLINE');

      const reconnected = hasConnectedOnceRef.current;
      hasConnectedOnceRef.current = true;
      clearSuccessBannerTimer();
      setConnectionStatus(reconnected ? 'connected' : 'idle');
      if (reconnected) {
        successBannerTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current) {
            setConnectionStatus('idle');
          }
        }, 1800);
      }
    };

    client.onWebSocketClose = handleDisconnect;
    client.onStompError = handleDisconnect;
    clientRef.current = client;
    client.activate();
  }, [clearReconnectTimer, clearSuccessBannerTimer, fetchOnlineUsers, handleDisconnect, publishPresence, subscribeToActiveRoom, token, notifyChatMessage]);


  useEffect(() => {
    mountedRef.current = true;
    userIdRef.current = getStoredUserId();
    manualShutdownRef.current = false;

    if (token) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      manualShutdownRef.current = true;
      clearReconnectTimer();
      clearSuccessBannerTimer();
      clearAllTypingExpiry();
      unsubscribeRoomSubscriptions();
      presenceSubscriptionRef.current?.unsubscribe();
      roomUpdatesSubscriptionRef.current?.unsubscribe();
      presenceSubscriptionRef.current = null;
      roomUpdatesSubscriptionRef.current = null;
      setIsConnected(false);
      clientRef.current?.deactivate();
    };
  }, [clearAllTypingExpiry, clearReconnectTimer, clearSuccessBannerTimer, connect, token, unsubscribeRoomSubscriptions]);

  useEffect(() => {
    setMessages([]);
    setTypingUsers([]);
    clearAllTypingExpiry();
    if (clientRef.current?.connected) {
      subscribeToActiveRoom();
    }
  }, [clearAllTypingExpiry, roomId, subscribeToActiveRoom]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      publishPresence(document.hidden ? 'AWAY' : 'ONLINE');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [publishPresence]);

  const sendMessage = useCallback((content, messageType = 'CHAT', replyToMessageId = null) => {
    if (!clientRef.current?.connected || !currentRoomRef.current) return false;
    clientRef.current.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({
        roomId: currentRoomRef.current,
        content,
        messageType,
        replyToMessageId,
      }),
    });
    return true;
  }, []);

  const sendTyping = useCallback((typing) => {
    if (!clientRef.current?.connected || !currentRoomRef.current) return;
    clientRef.current.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({
        roomId: currentRoomRef.current,
        typing,
      }),
    });
  }, []);

  return {
    messages,
    sendMessage,
    sendTyping,
    typingUsers,
    onlineUsers,
    roomUpdates,
    isConnected,
    connectionStatus,
  };
}
