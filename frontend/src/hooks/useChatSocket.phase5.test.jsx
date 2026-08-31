import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useChatSocket from './useChatSocket';

const notifyChatMessage = vi.fn();
const getOnlineUsers = vi.fn();
const clientInstances = [];

vi.mock('../context/NotificationContext', () => ({
  useNotifications: () => ({ notifyChatMessage }),
}));

vi.mock('../services/api', () => ({
  default: {
    getOnlineUsers: (...args) => getOnlineUsers(...args),
  },
}));

vi.mock('sockjs-client/dist/sockjs', () => ({
  default: vi.fn(),
}));

vi.mock('@stomp/stompjs', () => ({
  Client: vi.fn().mockImplementation((options) => {
    const subscriptions = {};
    const client = {
      connected: false,
      subscriptions,
      published: [],
      activate: vi.fn(() => {
        client.connected = true;
        client.onConnect?.();
      }),
      deactivate: vi.fn(() => {
        client.connected = false;
      }),
      subscribe: vi.fn((destination, handler) => {
        subscriptions[destination] = handler;
        return { unsubscribe: vi.fn() };
      }),
      publish: vi.fn((frame) => {
        client.published.push(frame);
      }),
    };
    clientInstances.push(client);
    return client;
  }),
}));

function frame(body) {
  return { body: JSON.stringify(body) };
}

function currentClient() {
  return clientInstances.at(-1);
}

function handlerFor(client, destination) {
  const call = client.subscribe.mock.calls.find(([subscribedDestination]) => subscribedDestination === destination);
  expect(call, `subscription ${destination}`).toBeTruthy();
  return call[1];
}

describe('useChatSocket Phase 5 behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clientInstances.length = 0;
    notifyChatMessage.mockReset();
    getOnlineUsers.mockResolvedValue({ data: [] });
    window.localStorage.setItem('hvhn_user', JSON.stringify({ id: 'user-a', userId: 'user-a' }));
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('sends generated clientMessageId and supports reply id as second argument', async () => {
    const { result } = renderHook(() => useChatSocket('room-1', 'token'));

    await act(async () => {
      result.current.sendMessage('hello', 'reply-1');
    });

    const body = JSON.parse(currentClient().published.at(-1).body);
    expect(body.roomId).toBe('room-1');
    expect(body.messageType).toBe('CHAT');
    expect(body.replyToMessageId).toBe('reply-1');
    expect(body.clientMessageId).toMatch(/^\d+-/);
  });

  it('ignores duplicate server events and replaces matching client acknowledgements', async () => {
    const { result } = renderHook(() => useChatSocket('room-1', 'token'));
    await act(async () => {});
    const message = { id: 'm1', clientMessageId: 'c1', roomId: 'room-1', content: 'hello' };

    await act(async () => {
      handlerFor(currentClient(), '/topic/chat/room-1')(frame(message));
      handlerFor(currentClient(), '/user/queue/chat/messages')(frame({ ...message, content: 'server ack' }));
      handlerFor(currentClient(), '/user/queue/chat/messages')(frame({ ...message, content: 'server ack' }));
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('server ack');
  });

  it('updates unread from inactive conversation and does not duplicate conversation subscriptions on reconnect', async () => {
    const { result } = renderHook(() => useChatSocket('room-1', 'token'));
    await act(async () => {});
    const firstClient = currentClient();

    await act(async () => {
      handlerFor(firstClient, '/user/queue/chat/conversations')(frame({ id: 'room-2', unreadCount: 1 }));
      handlerFor(firstClient, '/user/queue/chat/receipts')(frame({ roomId: 'room-2', unreadCount: 0 }));
    });

    expect(result.current.roomUpdates['room-2'].unreadCount).toBe(0);
    expect(firstClient.subscribe.mock.calls.filter(([destination]) => destination === '/user/queue/chat/messages')).toHaveLength(1);
  });

  it('typing expiry removes indicator and presence updates online map', async () => {
    const { result } = renderHook(() => useChatSocket('room-1', 'token'));
    await act(async () => {});

    await act(async () => {
      handlerFor(currentClient(), '/topic/presence')(frame({ userId: 'user-b', status: 'ONLINE' }));
      handlerFor(currentClient(), '/topic/typing/room-1')(frame({ userId: 'user-b', roomId: 'room-1', typing: true }));
    });
    expect(result.current.onlineUsers['user-b'].status).toBe('ONLINE');
    expect(result.current.typingUsers).toHaveLength(1);

    await act(async () => {
      vi.advanceTimersByTime(2600);
    });
    expect(result.current.typingUsers).toHaveLength(0);
  });

  it('sends seen only for the active conversation and stops reconnect on unmount/logout', async () => {
    const { result, unmount } = renderHook(() => useChatSocket('room-active', 'token'));

    await act(async () => {
      result.current.markSeen('message-1');
    });
    const seenBody = JSON.parse(currentClient().published.at(-1).body);
    expect(seenBody).toEqual({ roomId: 'room-active', lastSeenMessageId: 'message-1' });

    unmount();
    expect(currentClient().deactivate).toHaveBeenCalled();
  });
});
