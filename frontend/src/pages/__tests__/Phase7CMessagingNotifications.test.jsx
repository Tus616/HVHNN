import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Chats from '../Chats';
import Notifications from '../Notifications';
import Settings from '../Settings';

const api = vi.hoisted(() => ({
  getChatRooms: vi.fn(),
  getChatHistory: vi.fn(),
  markChatMessageRead: vi.fn(),
  hideChatConversation: vi.fn(),
  deleteChatMessage: vi.fn(),
  toggleChatReaction: vi.fn(),
  getNotifications: vi.fn(),
  getNotificationUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markNotificationUnread: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
  listNotificationDevices: vi.fn(),
  deleteNotificationDevice: vi.fn(),
}));

const sendMessage = vi.fn();
const sendTyping = vi.fn();
const markAsRead = vi.fn();
const markAsUnread = vi.fn();
const markAllAsRead = vi.fn();
const deleteNotification = vi.fn();
const enablePushNotifications = vi.fn();
const disablePushNotifications = vi.fn();
const showToast = vi.fn();
const realtimeNotifications = vi.hoisted(() => [{
  id: 'n-live',
  category: 'CHAT',
  title: 'Live message',
  message: 'New chat arrived',
  link: '/chats',
  time: '2026-08-11T01:00:00Z',
  read: false,
}]);

vi.mock('../../services/api', () => ({ default: api }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', userId: 'u1', fullName: 'Current User', email: 'current@example.com', token: 'token' },
    logout: vi.fn(),
  }),
}));
vi.mock('../../hooks/useChatSocket', () => ({
  default: () => ({
    messages: [],
    sendMessage,
    sendTyping,
    typingUsers: [{ userId: 'u2', roomId: 'room-1', fullName: 'Rahul' }],
    onlineUsers: { u2: { userId: 'u2', status: 'ONLINE' } },
    roomUpdates: {},
    isConnected: true,
    connectionStatus: 'idle',
  }),
}));
vi.mock('../../context/AccessibilityContext', () => ({
  useAccessibility: () => ({
    isDyslexic: false,
    toggleDyslexia: vi.fn(),
    isHighContrast: false,
    toggleHighContrast: vi.fn(),
    isLargeText: false,
    toggleLargeText: vi.fn(),
  }),
}));
vi.mock('../../context/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: realtimeNotifications,
    unreadCount: 2,
    refreshUnreadCount: vi.fn().mockResolvedValue(2),
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    enablePushNotifications,
    disablePushNotifications,
    pushPermission: 'granted',
    showToast,
  }),
}));

function roomFixture(overrides = {}) {
  return {
    id: 'room-1',
    type: 'DIRECT',
    name: 'Rahul Sharma',
    unreadCount: 2,
    lastMessage: 'Can you help today?',
    lastActivityAt: '2026-08-11T01:00:00Z',
    participants: [
      { userId: 'u1', fullName: 'Current User' },
      { userId: 'u2', fullName: 'Rahul Sharma', status: 'ONLINE' },
    ],
    ...overrides,
  };
}

function notificationFixture(overrides = {}) {
  return {
    id: 'n1',
    category: 'REQUEST',
    title: 'Request accepted',
    body: 'A volunteer accepted your request.',
    actionUrl: '/request/r1',
    read: false,
    createdAt: '2026-08-11T01:00:00Z',
    ...overrides,
  };
}

describe('Phase 7C messaging redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getChatRooms.mockResolvedValue({ data: [roomFixture()] });
    api.getChatHistory.mockResolvedValue({
      data: {
        messages: [
          { id: 'm1', senderId: 'u2', senderName: 'Rahul Sharma', content: 'Can you help today?', timestamp: '2026-08-11T01:00:00Z', reactions: { '👍': ['u1'] } },
          { id: 'm2', senderId: 'u1', senderName: 'Current User', content: 'Yes, I can.', timestamp: '2026-08-11T01:01:00Z', delivered: true },
        ],
        hasMore: false,
      },
    });
    sendMessage.mockReturnValue('client-id');
  });

  it('renders conversation list unread state, presence, typing, reactions, delivery, and send composer', async () => {
    render(<MemoryRouter><Chats /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Conversations' })).toBeInTheDocument();
    expect(screen.getAllByText('Rahul is typing...').length).toBeGreaterThan(0);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(await screen.findByText('Yes, I can.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Delivery status: Delivered/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Remove 👍 reaction/i)).toBeInTheDocument();

    expect(screen.getByLabelText('Message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('uses confirmation before hiding a conversation', async () => {
    api.hideChatConversation.mockResolvedValue({ data: {} });
    render(<MemoryRouter><Chats /></MemoryRouter>);
    await screen.findAllByText('Rahul Sharma');

    fireEvent.click(screen.getAllByLabelText('Open menu')[0]);
    fireEvent.click(screen.getByText('Hide conversation'));
    expect(screen.getByText(/It will not delete messages for the other person/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide for me' }));
    await waitFor(() => expect(api.hideChatConversation).toHaveBeenCalledWith('room-1'));
  });
});

describe('Phase 7C notification redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getNotifications.mockResolvedValue({ data: { notifications: [notificationFixture()], hasMore: false } });
    api.getNotificationUnreadCount.mockResolvedValue({ data: { unreadCount: 2 } });
    markAsRead.mockResolvedValue({ ...notificationFixture(), read: true });
    markAsUnread.mockResolvedValue({ ...notificationFixture(), read: false });
    markAllAsRead.mockResolvedValue({});
    deleteNotification.mockResolvedValue({});
    api.getNotificationPreferences.mockResolvedValue({ data: { pushEnabled: true, quietHoursEnabled: true } });
    api.updateNotificationPreferences.mockResolvedValue({ data: { pushEnabled: true, quietHoursEnabled: true } });
    api.listNotificationDevices.mockResolvedValue({
      data: [{ id: 'd1', platform: 'WEB', appVersion: 'web', lastUsedAt: '2026-08-11T01:00:00Z', active: true }],
    });
    api.deleteNotificationDevice.mockResolvedValue({});
  });

  it('renders notification filters, read action menu, and safe notification cards', async () => {
    render(<MemoryRouter><Notifications /></MemoryRouter>);

    expect(await screen.findByText('Request accepted')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Messages' }));
    expect(api.getNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'CHAT' }));
    await screen.findByText('Request accepted');
    fireEvent.click(screen.getAllByLabelText('Open menu')[0]);
    fireEvent.click(screen.getByText('Mark read'));
    await waitFor(() => expect(markAsRead).toHaveBeenCalledWith('n1'));
  });

  it('renders push permission, quiet hours, and hides raw device tokens in settings', async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: 'Devices' }));

    expect(await screen.findByText('Browser notifications enabled')).toBeInTheDocument();
    expect(screen.getByText(/Tokens and provider IDs are hidden/i)).toBeInTheDocument();
    expect(screen.queryByText(/token/i, { selector: 'code' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Notifications' }));
    expect(await screen.findByText('Quiet hours')).toBeInTheDocument();
    expect(screen.getByLabelText('Alert radius')).toBeInTheDocument();
  });
});
