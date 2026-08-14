import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider, useNotifications } from './NotificationContext';

const { api, clients } = vi.hoisted(() => ({
  api: {
    getNotifications: vi.fn(),
    getNotificationUnreadCount: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    deleteNotification: vi.fn(),
  },
  clients: [],
}));

vi.mock('../services/api', () => ({
  default: api,
}));

vi.mock('../services/apiConfig', () => ({
  API_BASE_URL: 'http://localhost:8080/api',
}));

vi.mock('../services/firebase', () => ({
  requestFirebaseMessagingToken: vi.fn(),
  subscribeForegroundMessages: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock('sockjs-client/dist/sockjs', () => ({
  default: vi.fn(),
}));

vi.mock('@stomp/stompjs', () => ({
  Client: vi.fn().mockImplementation((options) => {
    const subscriptions = {};
    const client = {
      subscriptions,
      activate: vi.fn(() => client.onConnect?.()),
      deactivate: vi.fn(),
      subscribe: vi.fn((destination, handler) => {
        subscriptions[destination] = handler;
        return { unsubscribe: vi.fn() };
      }),
      ...options,
    };
    clients.push(client);
    return client;
  }),
}));

function frame(body) {
  return { body: JSON.stringify(body) };
}

function Probe() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  return (
    <div>
      <div data-testid="count">{unreadCount}</div>
      <div data-testid="items">{notifications.map((entry) => entry.title).join('|')}</div>
      <button onClick={() => markAsRead('n1')}>read</button>
      <button onClick={() => markAllAsRead()}>all</button>
      <button onClick={() => clearAll()}>clear</button>
    </div>
  );
}

describe('NotificationContext Phase 6 persistence and sockets', () => {
  beforeEach(() => {
    window.localStorage.setItem('token', 'jwt-token');
    clients.length = 0;
    api.getNotifications.mockResolvedValue({
      data: {
        notifications: [{
          id: 'n1',
          type: 'REQUEST_ACCEPTED',
          category: 'REQUEST',
          title: 'Request accepted',
          body: 'A volunteer accepted.',
          actionUrl: '/request/r1',
          read: false,
          createdAt: '2026-08-03T01:00:00',
        }],
      },
    });
    api.getNotificationUnreadCount.mockResolvedValueOnce({ data: { unreadCount: 1 } }).mockResolvedValue({ data: { unreadCount: 0 } });
    api.markNotificationRead.mockResolvedValue({
      data: {
        id: 'n1',
        type: 'REQUEST_ACCEPTED',
        category: 'REQUEST',
        title: 'Request accepted',
        body: 'A volunteer accepted.',
        actionUrl: '/request/r1',
        read: true,
        createdAt: '2026-08-03T01:00:00',
      },
    });
    api.markAllNotificationsRead.mockResolvedValue({ data: { updated: 1, unreadCount: 0 } });
    api.deleteNotification.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('loads persistent notifications, consumes user socket events, and updates read state through the API', async () => {
    render(
      <NotificationProvider>
        <Probe />
      </NotificationProvider>
    );

    await waitFor(() => expect(screen.getByTestId('items').textContent).toContain('Request accepted'));
    expect(clients.at(-1).subscribe).toHaveBeenCalledWith('/user/queue/notifications', expect.any(Function));
    expect(clients.at(-1).subscribe).toHaveBeenCalledWith('/user/queue/notification-count', expect.any(Function));

    await act(async () => {
      clients.at(-1).subscriptions['/user/queue/notifications'](frame({
        id: 'n2',
        type: 'CHAT_MESSAGE_RECEIVED',
        category: 'CHAT',
        title: 'New chat message',
        body: 'You have a new private message.',
        actionUrl: '/chats',
        read: false,
        createdAt: '2026-08-03T01:01:00',
      }));
    });
    expect(screen.getByTestId('items').textContent).toContain('New chat message');
    expect(screen.getByTestId('count').textContent).toBe('2');

    await act(async () => {
      clients.at(-1).subscriptions['/user/queue/notification-count'](frame({ unreadCount: 4 }));
    });
    expect(screen.getByTestId('count').textContent).toBe('4');

    await act(async () => {
      screen.getByText('read').click();
    });
    expect(api.markNotificationRead).toHaveBeenCalledWith('n1');
    expect(screen.getByTestId('count').textContent).toBe('0');

    await act(async () => {
      screen.getByText('all').click();
    });
    expect(api.markAllNotificationsRead).toHaveBeenCalled();

    await act(async () => {
      screen.getByText('clear').click();
    });
    expect(api.deleteNotification).toHaveBeenCalled();
  });
});
