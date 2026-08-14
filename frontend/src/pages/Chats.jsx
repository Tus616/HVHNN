import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BellOff, EyeOff, MessageSquare, MoreHorizontal, RefreshCcw, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import ChatWindow from '../components/chat/ChatWindow';
import OnlineStatus from '../components/chat/OnlineStatus';
import UnreadBadge from '../components/chat/UnreadBadge';
import useChatSocket from '../hooks/useChatSocket';
import { Avatar, Badge, Button, ConfirmationDialog, DropdownMenu, EmptyState, IconButton, Input, PageHeader, Skeleton } from '../components/ui';
import { matchesCurrentUser } from '../utils/communityHub';
import { getStoredToken } from '../utils/sessionStorage';
import { timeAgo } from '../utils/timeUtils';

function upsertRoom(existingRooms, nextRoom) {
  const roomIndex = existingRooms.findIndex((room) => room.id === nextRoom.id);
  if (roomIndex === -1) return [nextRoom, ...existingRooms];
  const nextRooms = [...existingRooms];
  nextRooms[roomIndex] = { ...nextRooms[roomIndex], ...nextRoom };
  return nextRooms.sort((left, right) => new Date(right.lastActivityAt || right.updatedAt || 0) - new Date(left.lastActivityAt || left.updatedAt || 0));
}

function getRoomPeer(room, user) {
  if (room?.type !== 'DIRECT') return null;
  return (room.participants || []).find((participant) => !matchesCurrentUser(participant, user)) || null;
}

function getRoomTitle(room, user) {
  const peer = getRoomPeer(room, user);
  return peer?.fullName || peer?.name || room?.name || 'Conversation';
}

function getLastMessage(room) {
  return room?.lastMessage?.content || room?.lastMessageText || room?.lastMessage || 'No messages yet';
}

export default function Chats() {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState('');
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [roomToHide, setRoomToHide] = useState(null);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const token = user?.token || getStoredToken();
  const {
    messages: liveMessages,
    sendMessage,
    sendTyping,
    typingUsers,
    onlineUsers,
    roomUpdates,
    isConnected,
    connectionStatus,
  } = useChatSocket(activeRoomId, token);

  async function loadRooms({ preserveActive = false } = {}) {
    setLoadingRooms(true);
    setRoomsError('');
    try {
      const response = await apiService.getChatRooms();
      const nextRooms = response.data || [];
      setChatRooms(nextRooms);
      if (!preserveActive && nextRooms.length > 0 && !activeRoomId) {
        setActiveRoomId(nextRooms[0].id);
      }
    } catch {
      setRoomsError('We could not load your conversations.');
    } finally {
      setLoadingRooms(false);
    }
  }

  useEffect(() => {
    loadRooms();
  }, [user?.userId]);

  useEffect(() => {
    const nextRoomList = Object.values(roomUpdates || {});
    if (!nextRoomList.length) return;
    setChatRooms((current) => nextRoomList.reduce((rooms, nextRoom) => upsertRoom(rooms, nextRoom), Array.isArray(current) ? current : []));
  }, [roomUpdates]);

  const uniqueRooms = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(chatRooms) ? chatRooms : []).filter((room) => {
      if (room.type === 'GROUP') return true;
      const peer = getRoomPeer(room, user);
      if (!peer) return true;
      const key = peer.userId || peer.id || peer.email;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [chatRooms, user]);

  const filteredRooms = useMemo(() => {
    const query = sidebarSearch.trim().toLowerCase();
    return uniqueRooms.filter((room) => {
      if (unreadOnly && (room.unreadCount || 0) === 0) return false;
      if (!query) return true;
      return `${getRoomTitle(room, user)} ${getLastMessage(room)}`.toLowerCase().includes(query);
    });
  }, [sidebarSearch, uniqueRooms, unreadOnly, user]);

  const activeRoom = (Array.isArray(chatRooms) ? chatRooms : []).find((room) => room.id === activeRoomId) || null;
  const activePeer = getRoomPeer(activeRoom, user);
  const activePresence = activePeer ? onlineUsers[activePeer.userId || activePeer.id] || activePeer : null;
  const visibleTypingUsers = (typingUsers || []).filter((typingUser) => typingUser.userId !== (user?.userId || user?.id));
  const activeTitle = activeRoom ? getRoomTitle(activeRoom, user) : '';

  async function handleMessagesRead(messageId) {
    if (!activeRoomId || !messageId) return;
    try {
      await apiService.markChatMessageRead(messageId);
      setChatRooms((current) => (Array.isArray(current) ? current : []).map((room) => (
        room.id === activeRoomId ? { ...room, unreadCount: 0 } : room
      )));
    } catch {
      // Keep read receipts best-effort; the server remains authoritative on refresh.
    }
  }

  function handleSendMessage(content, replyToId, clientMessageId) {
    return sendMessage(content, 'CHAT', replyToId, clientMessageId);
  }

  async function handleHideConfirm() {
    if (!roomToHide) return;
    try {
      await apiService.hideChatConversation(roomToHide);
      setChatRooms((current) => (Array.isArray(current) ? current : []).filter((room) => room.id !== roomToHide));
      if (activeRoomId === roomToHide) {
        setActiveRoomId(null);
        setShowMobileChat(false);
      }
    } finally {
      setRoomToHide(null);
    }
  }

  function selectRoom(roomId) {
    setActiveRoomId(roomId);
    setShowMobileChat(true);
  }

  const connectionLabel = !navigator.onLine ? 'Offline' : connectionStatus === 'reconnecting' ? 'Reconnecting' : isConnected ? 'Connected' : 'Connecting';

  return (
    <div className="p7c-messages">
      <PageHeader
        eyebrow="Messaging"
        title="Messages"
        description="Direct and community conversations with live presence, receipts, typing, and reactions."
      />

      <section className={`p7c-chat-shell ${showMobileChat ? 'is-chat-open' : ''}`} aria-label="Messaging workspace">
        <aside className="p7c-conversation-panel" aria-label="Conversation list">
          <div className="p7c-panel-header">
            <div>
              <h2>Conversations</h2>
              <p>{connectionLabel}</p>
            </div>
            {connectionStatus === 'reconnecting' && <Badge variant="warning">Reconnecting</Badge>}
          </div>

          <div className="p7c-search">
            <Search size={17} aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search conversations"
              placeholder="Search conversations"
              value={sidebarSearch}
              onChange={(event) => setSidebarSearch(event.target.value)}
            />
            {sidebarSearch && (
              <IconButton label="Clear conversation search" onClick={() => setSidebarSearch('')}>
                <X size={16} />
              </IconButton>
            )}
          </div>

          <div className="p7c-filter-row" role="group" aria-label="Conversation filters">
            <button type="button" className={!unreadOnly ? 'is-active' : ''} onClick={() => setUnreadOnly(false)}>All</button>
            <button type="button" className={unreadOnly ? 'is-active' : ''} onClick={() => setUnreadOnly(true)}>Unread</button>
          </div>

          <div className="p7c-conversation-list" role="list">
            {loadingRooms ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="p7c-room-skeleton"><Skeleton lines={2} /></div>
              ))
            ) : roomsError ? (
              <div className="p7c-room-error">
                <p>{roomsError}</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => loadRooms({ preserveActive: true })}>
                  <RefreshCcw size={15} /> Retry
                </Button>
              </div>
            ) : filteredRooms.length === 0 ? (
              <EmptyState
                title={sidebarSearch || unreadOnly ? 'No matching conversations' : 'No conversations yet'}
                message={sidebarSearch || unreadOnly ? 'Clear filters to see every conversation.' : 'Open a community member or request thread to start a direct conversation.'}
                actionLabel={sidebarSearch || unreadOnly ? 'Show all' : undefined}
                onAction={() => { setSidebarSearch(''); setUnreadOnly(false); }}
              />
            ) : (
              filteredRooms.map((room) => {
                const peer = getRoomPeer(room, user);
                const title = getRoomTitle(room, user);
                const presence = peer ? onlineUsers[peer.userId || peer.id] || peer : null;
                const roomTyping = visibleTypingUsers.find((typingUser) => typingUser.roomId === room.id);
                const unread = room.unreadCount || 0;
                return (
                  <button
                    key={room.id}
                    type="button"
                    role="listitem"
                    className={`p7c-conversation-row ${activeRoomId === room.id ? 'is-active' : ''} ${unread ? 'is-unread' : ''}`}
                    aria-current={activeRoomId === room.id ? 'true' : undefined}
                    onClick={() => selectRoom(room.id)}
                  >
                    <span className="p7c-room-avatar">
                      <Avatar name={title} src={peer?.avatarUrl || peer?.profileImage} />
                      {presence && <OnlineStatus presence={presence} compact />}
                    </span>
                    <span className="p7c-room-copy">
                      <span className="p7c-room-top">
                        <strong>{title}</strong>
                        <time>{timeAgo(room.lastActivityAt || room.updatedAt || room.lastMessage?.createdAt)}</time>
                      </span>
                      <span className="p7c-room-preview">
                        {roomTyping ? `${roomTyping.fullName || 'Someone'} is typing...` : getLastMessage(room)}
                      </span>
                    </span>
                    <span className="p7c-room-state">
                      <UnreadBadge count={unread} />
                      {room.hidden && <EyeOff size={15} aria-label="Hidden" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="p7c-chat-panel" aria-label={activeRoom ? `${activeTitle} chat` : 'No active conversation'}>
          {activeRoom ? (
            <>
              <header className="p7c-chat-header">
                <IconButton label="Back to conversations" className="p7c-chat-back" onClick={() => setShowMobileChat(false)}>
                  <ArrowLeft size={18} />
                </IconButton>
                <Avatar name={activeTitle} src={activePresence?.avatarUrl || activePresence?.profileImage || getRoomPeer(activeRoom, user)?.avatarUrl || getRoomPeer(activeRoom, user)?.profileImage} />
                <div className="p7c-chat-title">
                  <h2>{activeTitle}</h2>
                  {visibleTypingUsers.length > 0 ? (
                    <p>{visibleTypingUsers[0].fullName || activeTitle} is typing...</p>
                  ) : activePresence ? (
                    <OnlineStatus presence={activePresence} />
                  ) : (
                    <p>{activeRoom.type === 'GROUP' ? 'Group conversation' : 'Conversation'}</p>
                  )}
                </div>
                <DropdownMenu label={<MoreHorizontal size={18} />}>
                  <button type="button" onClick={() => setRoomToHide(activeRoom.id)}>
                    <BellOff size={14} /> Hide conversation
                  </button>
                </DropdownMenu>
              </header>

              <ChatWindow
                room={activeRoom}
                currentUserId={user?.userId || user?.id}
                liveMessages={liveMessages}
                typingUsers={typingUsers}
                isConnected={isConnected}
                connectionStatus={connectionStatus}
                onSendMessage={handleSendMessage}
                onTypingChange={sendTyping}
                onMessagesRead={handleMessagesRead}
                onDeleteMessage={apiService.deleteChatMessage}
              />
            </>
          ) : (
            <div className="p7c-empty-chat">
              <div><MessageSquare size={36} /></div>
              <h2>Select a conversation</h2>
              <p>Choose a thread from the list to read messages, reply, and track receipts without losing your place.</p>
            </div>
          )}
        </main>
      </section>

      <ConfirmationDialog
        open={Boolean(roomToHide)}
        title="Hide this conversation?"
        message="This conversation will be hidden for you. It will not delete messages for the other person."
        confirmLabel="Hide for me"
        destructive
        onCancel={() => setRoomToHide(null)}
        onConfirm={handleHideConfirm}
      />
    </div>
  );
}
