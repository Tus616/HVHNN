import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowDown, Check, CheckCheck, Clock3, MoreHorizontal, RefreshCcw, Reply, Smile, Trash2 } from 'lucide-react';
import apiService from '../../services/api';
import { Avatar, Button, ConfirmationDialog, DropdownMenu, IconButton, Skeleton } from '../ui';
import ChatInput from './ChatInput';
import ConnectionBanner from './ConnectionBanner';
import TypingIndicator from './TypingIndicator';

const REACTIONS = ['👍', '❤️', '🙂', '🙏'];

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(value) {
  const date = value ? new Date(value) : new Date();
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (left, right) =>
    left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

function messageKey(message) {
  return message?.clientMessageId || message?.id || `${message?.timestamp || ''}-${message?.content || ''}`;
}

function mergeMessages(existingMessages, nextMessages, mode = 'append') {
  const ordered = mode === 'prepend'
    ? [...(nextMessages || []), ...(existingMessages || [])]
    : [...(existingMessages || []), ...(nextMessages || [])];
  const byKey = new Map();
  ordered.forEach((message) => {
    const key = messageKey(message);
    if (!key) return;
    const existing = byKey.get(key);
    byKey.set(key, existing ? { ...existing, ...message, deliveryState: message.deliveryState || existing.deliveryState } : message);
  });
  return Array.from(byKey.values()).sort((left, right) => new Date(left.timestamp || left.createdAt || 0) - new Date(right.timestamp || right.createdAt || 0));
}

function getDeliveryState(message) {
  const state = String(message.deliveryState || message.status || '').toUpperCase();
  if (state === 'FAILED') return { label: 'Failed', icon: AlertCircle };
  if (state === 'SENDING' || message.pending) return { label: 'Sending', icon: Clock3 };
  if (message.seen || message.read || state === 'SEEN' || state === 'READ') return { label: 'Seen', icon: CheckCheck };
  if (message.delivered || state === 'DELIVERED') return { label: 'Delivered', icon: CheckCheck };
  return { label: 'Sent', icon: Check };
}

function isSameSenderClose(previous, message) {
  if (!previous || previous.senderId !== message.senderId) return false;
  const previousTime = new Date(previous.timestamp || previous.createdAt || 0).getTime();
  const currentTime = new Date(message.timestamp || message.createdAt || 0).getTime();
  return Math.abs(currentTime - previousTime) < 5 * 60 * 1000;
}

function normalizeReactionUsers(users) {
  if (Array.isArray(users)) return users;
  if (typeof users === 'number') return Array.from({ length: users }, (_, index) => `count-${index}`);
  return [];
}

export default function ChatWindow({
  room,
  currentUserId,
  liveMessages,
  typingUsers,
  isConnected,
  connectionStatus,
  onSendMessage,
  onTypingChange,
  onMessagesRead,
  onDeleteMessage,
  prefillText,
  searchQuery = '',
}) {
  const [messages, setMessages] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [reactionPickerId, setReactionPickerId] = useState('');
  const [newMessageCount, setNewMessageCount] = useState(0);

  const scrollerRef = useRef(null);
  const pendingScrollAdjustmentRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const lastReadMessageIdRef = useRef('');

  async function loadHistory(nextPage, mode = 'replace') {
    if (!room?.id) return;
    if (mode === 'replace') setLoading(true);
    else setLoadingMore(true);
    setError('');

    const scroller = scrollerRef.current;
    if (mode === 'prepend' && scroller) {
      pendingScrollAdjustmentRef.current = {
        previousHeight: scroller.scrollHeight,
        previousTop: scroller.scrollTop,
      };
    }

    try {
      const response = await apiService.getChatHistory(room.id, nextPage, 50);
      const nextMessages = response.data?.messages || [];
      setMessages((current) => (mode === 'replace' ? nextMessages : mergeMessages(current, nextMessages, 'prepend')));
      setPage(nextPage);
      setHasMore(Boolean(response.data?.hasMore));
    } catch (loadError) {
      setError(loadError.message || 'We could not load this conversation.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setMessages([]);
    setPage(0);
    setHasMore(false);
    setError('');
    setReplyTarget(null);
    setNewMessageCount(0);
    lastReadMessageIdRef.current = '';
    shouldStickToBottomRef.current = true;
    if (room?.id) loadHistory(0, 'replace');
  }, [room?.id]);

  useEffect(() => {
    if (!Array.isArray(liveMessages) || !liveMessages.length) return;
    setMessages((current) => mergeMessages(current, liveMessages));
    if (!shouldStickToBottomRef.current) {
      setNewMessageCount((current) => current + liveMessages.length);
    }
  }, [liveMessages]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (pendingScrollAdjustmentRef.current) {
      const { previousHeight, previousTop } = pendingScrollAdjustmentRef.current;
      scroller.scrollTop = scroller.scrollHeight - previousHeight + previousTop;
      pendingScrollAdjustmentRef.current = null;
      return;
    }
    if (!shouldStickToBottomRef.current) return;
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    } else {
      scroller.scrollTop = scroller.scrollHeight;
    }
    setNewMessageCount(0);
  }, [messages]);

  useEffect(() => {
    if (!room?.id || !messages.length) return;
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage?.id || latestMessage.senderId === currentUserId) return;
    if (lastReadMessageIdRef.current === latestMessage.id) return;
    lastReadMessageIdRef.current = latestMessage.id;
    onMessagesRead?.(latestMessage.id);
  }, [currentUserId, messages, onMessagesRead, room?.id]);

  function handleScroll(event) {
    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 96;
    if (shouldStickToBottomRef.current) setNewMessageCount(0);
    if (element.scrollTop <= 48 && hasMore && !loadingMore) loadHistory(page + 1, 'prepend');
  }

  function scrollToLatest() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    shouldStickToBottomRef.current = true;
    setNewMessageCount(0);
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    } else {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }

  async function sendWithOptimism(content, replyToId = null, retryingId = null) {
    const clientMessageId = retryingId || `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage = {
      id: clientMessageId,
      clientMessageId,
      roomId: room.id,
      senderId: currentUserId,
      senderName: 'You',
      content,
      replyToMessageId: replyToId,
      timestamp: new Date().toISOString(),
      deliveryState: 'SENDING',
      pending: true,
    };

    setMessages((current) => retryingId
      ? current.map((message) => messageKey(message) === retryingId ? optimisticMessage : message)
      : mergeMessages(current, [optimisticMessage]));

    const sentId = await onSendMessage?.(content, replyToId, clientMessageId);
    if (!sentId) {
      setMessages((current) => current.map((message) => (
        messageKey(message) === clientMessageId
          ? { ...message, pending: false, deliveryState: 'FAILED' }
          : message
      )));
      return false;
    }
    setReplyTarget(null);
    return true;
  }

  async function toggleReaction(messageId, emoji) {
    const previousMessages = messages;
    setMessages((current) => current.map((message) => {
      if (messageKey(message) !== messageId) return message;
      const reactions = { ...(message.reactions || {}) };
      const users = normalizeReactionUsers(reactions[emoji]);
      const currentUserIndex = users.indexOf(currentUserId);
      const nextUsers = currentUserIndex >= 0
        ? users.filter((userId) => userId !== currentUserId)
        : [...users, currentUserId];
      if (nextUsers.length) reactions[emoji] = nextUsers;
      else delete reactions[emoji];
      return { ...message, reactions };
    }));
    try {
      const response = await apiService.toggleChatReaction(messageId, emoji);
      setMessages((current) => current.map((message) => (messageKey(message) === messageId ? response.data : message)));
    } catch {
      setMessages(previousMessages);
    }
  }

  async function handleDeleteConfirm() {
    if (!messageToDelete) return;
    try {
      if (onDeleteMessage) await onDeleteMessage(messageToDelete);
      setMessages((current) => current.filter((message) => messageKey(message) !== messageToDelete));
    } finally {
      setMessageToDelete(null);
    }
  }

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const query = searchQuery.trim().toLowerCase();
    return messages.map((message) => ({
      ...message,
      isDimmedBySearch: !String(message.content || '').toLowerCase().includes(query),
    }));
  }, [messages, searchQuery]);

  if (!room) {
    return <div className="p7c-chat-empty">Select a conversation.</div>;
  }

  return (
    <div className="p7c-chat-window">
      <ConnectionBanner status={connectionStatus} />

      {room.requestId && (
        <div className="p7c-thread-context">
          <span>Thread context</span>
          <strong>{room.requestTitle || `Request ${String(room.requestId).slice(-4)}`}</strong>
          <a href={`/volunteer/request/${room.requestId}`}>View request</a>
        </div>
      )}

      <div ref={scrollerRef} className="p7c-message-scroll" onScroll={handleScroll} aria-label="Message history">
        {loading ? (
          <div className="p7c-message-skeleton"><Skeleton lines={8} /></div>
        ) : error ? (
          <div className="p7c-chat-error">
            <p>{error}</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => loadHistory(0, 'replace')}>
              <RefreshCcw size={16} /> Retry
            </Button>
          </div>
        ) : (
          <>
            {loadingMore && <div className="p7c-loading-more">Loading older messages</div>}
            {filteredMessages.map((message, index) => {
              const previousMessage = filteredMessages[index - 1];
              const key = messageKey(message);
              const isSelf = message.senderId === currentUserId;
              const isSystemMessage = message.messageType && message.messageType !== 'CHAT';
              const showDayDivider = formatDayLabel(message.timestamp || message.createdAt) !== formatDayLabel(previousMessage?.timestamp || previousMessage?.createdAt);
              const grouped = isSameSenderClose(previousMessage, message);
              const quoted = message.replyToMessageId ? messages.find((entry) => messageKey(entry) === message.replyToMessageId) : null;
              const delivery = getDeliveryState(message);
              const DeliveryIcon = delivery.icon;

              return (
                <div key={key} className={message.isDimmedBySearch ? 'p7c-message-dimmed' : ''}>
                  {showDayDivider && <div className="p7c-date-separator"><span>{formatDayLabel(message.timestamp || message.createdAt)}</span></div>}
                  {isSystemMessage ? (
                    <div className="p7c-system-message">{message.content}</div>
                  ) : (
                    <article className={`p7c-message-row ${isSelf ? 'is-self' : 'is-other'} ${grouped ? 'is-grouped' : ''}`} aria-label={`${isSelf ? 'Your' : message.senderName || 'Member'} message`}>
                      {!isSelf && !grouped && <div className="p7c-message-avatar"><Avatar name={message.senderName || 'Member'} src={message.avatarUrl || message.profileImage} size="sm" /></div>}
                      {!isSelf && grouped && <div className="p7c-message-avatar-spacer" />}
                      <div className="p7c-message-stack">
                        {!isSelf && !grouped && <span className="p7c-message-author">{message.senderName || 'Community member'}</span>}
                        <div className="p7c-message-bubble">
                          {quoted && (
                            <button type="button" className="p7c-reply-preview" onClick={() => document.getElementById(`msg-${messageKey(quoted)}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>
                              <strong>{quoted.senderName || 'Message'}</strong>
                              <span>{quoted.content}</span>
                            </button>
                          )}
                          <p id={`msg-${key}`}>{message.content}</p>
                          <div className="p7c-message-meta">
                            <span>{formatTime(message.timestamp || message.createdAt)}</span>
                            {isSelf && (
                              <span className={`p7c-delivery p7c-delivery--${delivery.label.toLowerCase()}`} aria-label={`Delivery status: ${delivery.label}`}>
                                <DeliveryIcon size={13} aria-hidden="true" />
                                {delivery.label}
                              </span>
                            )}
                          </div>
                          {message.deliveryState === 'FAILED' && (
                            <button type="button" className="p7c-retry" onClick={() => sendWithOptimism(message.content, message.replyToMessageId, key)}>
                              <RefreshCcw size={13} /> Retry
                            </button>
                          )}
                        </div>
                        {message.reactions && Object.keys(message.reactions).length > 0 && (
                          <div className="p7c-reactions" aria-label="Message reactions">
                            {Object.entries(message.reactions).map(([emoji, users]) => {
                              const normalizedUsers = normalizeReactionUsers(users);
                              const active = normalizedUsers.includes(currentUserId);
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  className={active ? 'is-active' : ''}
                                  onClick={() => toggleReaction(key, emoji)}
                                  aria-label={`${active ? 'Remove' : 'Add'} ${emoji} reaction, ${normalizedUsers.length} current`}
                                >
                                  <span>{emoji}</span>
                                  <strong>{normalizedUsers.length}</strong>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="p7c-message-actions">
                        <button 
                          type="button" 
                          className="p7c-msg-menu-btn" 
                          onClick={() => setActiveMenuId(activeMenuId === key ? '' : key)}
                          aria-label="Message actions"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                        {activeMenuId === key && (
                          <div className="p7c-msg-menu-popover" role="menu">
                            <button type="button" onClick={() => { setReplyTarget(message); setActiveMenuId(''); }}><Reply size={14} /> Reply</button>
                            <button type="button" onClick={() => { setReactionPickerId(reactionPickerId === key ? '' : key); setActiveMenuId(''); }}><Smile size={14} /> React</button>
                            {isSelf && <button type="button" className="danger" onClick={() => { setMessageToDelete(key); setActiveMenuId(''); }}><Trash2 size={14} /> Delete for me</button>}
                          </div>
                        )}
                        {reactionPickerId === key && (
                          <div className="p7c-reaction-popover" role="menu" aria-label="Choose a reaction">
                            {REACTIONS.map((emoji) => (
                              <button key={emoji} type="button" onClick={() => { toggleReaction(key, emoji); setReactionPickerId(''); }}>{emoji}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {newMessageCount > 0 && (
        <button type="button" className="p7c-new-messages" onClick={scrollToLatest}>
          <ArrowDown size={15} /> {newMessageCount} new message{newMessageCount > 1 ? 's' : ''}
        </button>
      )}

      {replyTarget && (
        <div className="p7c-reply-context">
          <div>
            <strong>Replying to {replyTarget.senderName || 'message'}</strong>
            <span>{replyTarget.content}</span>
          </div>
          <IconButton label="Cancel reply" onClick={() => setReplyTarget(null)}>x</IconButton>
        </div>
      )}

      <div className="p7c-typing-wrap">
        <TypingIndicator users={(Array.isArray(typingUsers) ? typingUsers : []).filter((typingUser) => typingUser.userId !== currentUserId)} />
      </div>

      <div className="p7c-chat-input-area">
        <ChatInput
          disabled={!isConnected}
          onSend={(content) => sendWithOptimism(content, replyTarget?.id)}
          onTypingChange={onTypingChange}
          prefillText={prefillText}
        />
      </div>

      <ConfirmationDialog
        open={Boolean(messageToDelete)}
        title="Delete this message for you?"
        message="This removes the message from your chat view. It does not delete it for other participants."
        confirmLabel="Delete for me"
        destructive
        onCancel={() => setMessageToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
