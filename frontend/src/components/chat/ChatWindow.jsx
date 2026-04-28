import { useEffect, useRef, useState } from 'react';
import apiService from '../../services/api';
import ChatInput from './ChatInput';
import ConnectionBanner from './ConnectionBanner';
import TypingIndicator from './TypingIndicator';

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (left, right) =>
    left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
  });
}

function getAttachment(content = '') {
  if (!content.startsWith('attachment:')) return null;

  const encoded = content.slice('attachment:'.length);
  const [url = '', fileName = 'Attachment', contentType = ''] = encoded.split('|');

  if (!url) return null;

  const lowerUrl = url.toLowerCase();
  const isImage =
    String(contentType).startsWith('image/')
    || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].some((suffix) => lowerUrl.endsWith(suffix));

  return {
    url,
    fileName,
    contentType,
    isImage,
  };
}

function resolveAttachmentUrl(url) {
  if (!url?.startsWith('/')) return url;

  const configuredBaseUrl = import.meta.env.VITE_BACKEND_URL;
  if (configuredBaseUrl) {
    return `${configuredBaseUrl}${url}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const host = window.location.hostname || 'localhost';
  return `${protocol}//${host}:8080${url}`;
}

function mergeMessages(existingMessages, nextMessages, mode = 'append') {
  const safeExisting = Array.isArray(existingMessages) ? existingMessages : [];
  const safeNext = Array.isArray(nextMessages) ? nextMessages : [];
  
  const ordered = mode === 'prepend'
    ? [...safeNext, ...safeExisting]
    : [...safeExisting, ...safeNext];

  const seen = new Set();
  return ordered.filter((message) => {
    if (!message?.id || seen.has(message.id)) return false;
    seen.add(message.id);
    return true;
  });
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
  onUploadAttachment,
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
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showReactionPickerId, setShowReactionPickerId] = useState(null);

  const scrollerRef = useRef(null);
  const pendingScrollAdjustmentRef = useRef(null);
  const shouldStickToBottomRef = useRef(true);
  const lastReadMessageIdRef = useRef('');

  async function loadHistory(nextPage, mode = 'replace') {
    if (!room?.id) return;

    if (mode === 'replace') {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

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

      setMessages((current) => {
        if (mode === 'replace') return nextMessages;
        return mergeMessages(current, nextMessages, 'prepend');
      });

      setPage(nextPage);
      setHasMore(Boolean(response.data?.hasMore));
    } catch (loadError) {
      setError(loadError.message || 'We could not load this chat history.');
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
    lastReadMessageIdRef.current = '';
    shouldStickToBottomRef.current = true;

    if (room?.id) {
      loadHistory(0, 'replace');
    }
  }, [room?.id]);

  useEffect(() => {
    if (!Array.isArray(liveMessages) || !liveMessages.length) return;
    setMessages((current) => mergeMessages(current, liveMessages));
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
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages]);

  useEffect(() => {
    if (!room?.id || !messages.length) return;

    const latestMessage = messages[messages.length - 1];
    if (!latestMessage?.id || latestMessage.senderId === currentUserId) return;
    if (lastReadMessageIdRef.current === latestMessage.id) return;

    lastReadMessageIdRef.current = latestMessage.id;
    onMessagesRead(latestMessage.id);
  }, [currentUserId, messages, onMessagesRead, room?.id]);

  function handleScroll(event) {
    const element = event.currentTarget;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 80;

    if (element.scrollTop <= 40 && hasMore && !loadingMore) {
      loadHistory(page + 1, 'prepend');
    }
  }

  async function toggleReaction(messageId, emoji) {
    // This would normally call an API. Since we added it to backend, 
    // we'll optimisticly update and call service if implemented.
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const nextReactions = { ...(m.reactions || {}) };
      const users = [...(nextReactions[emoji] || [])];
      const index = users.indexOf(currentUserId);
      if (index > -1) users.splice(index, 1);
      else users.push(currentUserId);
      
      if (users.length === 0) delete nextReactions[emoji];
      else nextReactions[emoji] = users;
      
      return { ...m, reactions: nextReactions };
    }));
  }

  function renderMessage(message, previousMessage, nextMessage) {
    const isSelf = message.senderId === currentUserId;
    const attachment = getAttachment(message.content || '');
    const isSystemMessage = message.messageType && message.messageType !== 'CHAT';
    const dayLabel = formatDayLabel(message.timestamp);
    const previousDayLabel = previousMessage ? formatDayLabel(previousMessage.timestamp) : '';
    const showDayDivider = dayLabel !== previousDayLabel;

    // Unread divider logic
    const isFirstUnread = !isSelf && !message.read && (previousMessage?.read || !previousMessage);

    // Reply context
    const quotedMessage = message.replyToMessageId 
      ? messages.find(m => m.id === message.replyToMessageId) 
      : null;

    // Search highlighting
    const isHighlighted = searchQuery && message.content?.toLowerCase().includes(searchQuery.toLowerCase());

    return (
      <div key={message.id} style={{ opacity: isHighlighted === false && searchQuery ? 0.4 : 1, transition: 'opacity 0.2s' }}>
        {showDayDivider && <div className="chat-date-separator" style={{ margin: '24px 0 16px', fontSize: '0.75rem', fontWeight: 700, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '1px' }}>{dayLabel}</div>}
        
        {isFirstUnread && <div className="chat-unread-divider">Unread Messages</div>}

        {isSystemMessage ? (
          <div className="chat-system-message" style={{ margin: '12px 0', fontSize: '0.8rem', opacity: 0.6 }}>{message.content}</div>
        ) : (
          <div className={`chat-message-row ${isSelf ? 'chat-message-row-self' : ''}`} style={{ marginBottom: '4px' }}>
            {!isSelf && (
              <div className="chat-message-avatar" style={{ alignSelf: 'flex-end', width: '32px', height: '32px', fontSize: '0.8rem', marginBottom: '4px' }}>
                {message.avatarInitial || 'U'}
              </div>
            )}

            <div 
              className={`chat-bubble ${isSelf ? 'chat-bubble-self' : 'chat-bubble-member'}`}
              style={{ border: isHighlighted ? '2px solid var(--accent-primary)' : 'none' }}
            >
              {quotedMessage && (
                <div className="chat-reply-preview" style={{ cursor: 'pointer' }} onClick={() => {
                  const el = document.getElementById(`msg-${quotedMessage.id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el?.classList.add('highlight-animation');
                  setTimeout(() => el?.classList.remove('highlight-animation'), 2000);
                }}>
                  <strong style={{ fontSize: '0.75rem' }}>{quotedMessage.senderName}</strong>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{quotedMessage.content}</div>
                </div>
              )}

              <div className="chat-bubble-content-wrapper" style={{ paddingRight: '20px' }}>
                <div id={`msg-${message.id}`} style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>
                  {attachment ? (
                    <div className="chat-attachment" style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '4px' }}>
                      {attachment.isImage ? (
                        <a href={resolveAttachmentUrl(attachment.url)} target="_blank" rel="noreferrer">
                          <img
                            src={resolveAttachmentUrl(attachment.url)}
                            alt={attachment.fileName}
                            style={{ maxWidth: '100%', maxHeight: '300px', display: 'block' }}
                          />
                        </a>
                      ) : (
                        <a href={resolveAttachmentUrl(attachment.url)} target="_blank" rel="noreferrer" className="chat-attachment-link">
                          📄 {attachment.fileName}
                        </a>
                      )}
                    </div>
                  ) : (
                    message.content
                  )}
                </div>

                <div className="chat-message-info">
                  <span>{formatTime(message.timestamp)}</span>
                  {isSelf && (
                    <span style={{ color: message.read ? '#3b82f6' : 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                      {message.read ? '✓✓' : '✓✓'}
                    </span>
                  )}
                </div>
              </div>

              {/* Reactions UI */}
              {message.reactions && Object.keys(message.reactions).length > 0 && (
                <div className="chat-reactions-row">
                  {Object.entries(message.reactions).map(([emoji, users]) => (
                    <div 
                      key={emoji} 
                      className="chat-reaction-chip"
                      onClick={() => toggleReaction(message.id, emoji)}
                      style={{ background: users.includes(currentUserId) ? 'var(--accent-primary-alpha)' : 'var(--bg-card)' }}
                    >
                      {emoji} <span>{users.length}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Message Actions Dropdown */}
              <div className="message-actions-container">
                <button 
                  className="btn btn-icon btn-sm" 
                  onClick={() => setOpenDropdownId(openDropdownId === message.id ? null : message.id)}
                  style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}
                >
                  ⋮
                </button>
                
                {openDropdownId === message.id && (
                  <>
                    <div className="dropdown-backdrop" onClick={() => setOpenDropdownId(null)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
                    <div className="message-actions-dropdown">
                      <button className="dropdown-item" onClick={() => { setReplyTarget(message); setOpenDropdownId(null); }}>
                        ↩️ Reply
                      </button>
                      <button className="dropdown-item" onClick={() => { setShowReactionPickerId(message.id); setOpenDropdownId(null); }}>
                        😀 React
                      </button>
                      {isSelf && (
                        <button className="dropdown-item danger" onClick={() => { setMessageToDelete(message.id); setOpenDropdownId(null); }}>
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Mini Reaction Picker */}
              {showReactionPickerId === message.id && (
                <>
                  <div className="dropdown-backdrop" onClick={() => setShowReactionPickerId(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000 }} />
                  <div className="reaction-picker-mini">
                    {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                      <button 
                        key={emoji} 
                        className="reaction-btn-mini" 
                        onClick={() => { toggleReaction(message.id, emoji); setShowReactionPickerId(null); }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleDeleteConfirm = async () => {
    if (!messageToDelete) return;
    try {
      if (onDeleteMessage) await onDeleteMessage(messageToDelete);
      setMessages(prev => (Array.isArray(prev) ? prev : []).filter(m => m.id !== messageToDelete));
    } catch (err) {
      console.error("Failed to delete", err);
    } finally {
      setMessageToDelete(null);
    }
  };

  if (!room) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Select a conversation.</div>;

  return (
    <div className="chat-window" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ConnectionBanner status={connectionStatus} />

      {room.requestId && (
        <div style={{ padding: '8px 16px', background: 'var(--accent-primary-alpha)', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ opacity: 0.6 }}>🔗 Thread context:</span>
          <strong>{room.requestTitle || `Request #${room.requestId?.slice(-4)}`}</strong>
          <a href={`/volunteer/request/${room.requestId}`} style={{ marginLeft: 'auto', textDecoration: 'none', color: 'var(--accent-primary)', fontWeight: 600 }}>View Details →</a>
        </div>
      )}

      <div ref={scrollerRef} className="chat-messages-container" onScroll={handleScroll}>
        {loadingMore && <div className="chat-loading-more">Loading history...</div>}
        {messages.map((message, index) => renderMessage(message, messages[index - 1], messages[index + 1]))}
        <div style={{ minHeight: '1px' }} />
      </div>

      <div style={{ padding: '0 24px' }}>
        <TypingIndicator users={(Array.isArray(typingUsers) ? typingUsers : []).filter((user) => user.userId !== currentUserId)} />
      </div>

      {replyTarget && (
        <div style={{ margin: '0 24px', padding: '12px', background: 'var(--bg-secondary)', borderLeft: '4px solid var(--accent-primary)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'message-in 0.2s ease-out' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)' }}>Replying to {replyTarget.senderName}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyTarget.content}</div>
          </div>
          <button className="btn btn-icon" onClick={() => setReplyTarget(null)}>✕</button>
        </div>
      )}

      <div className="chat-input-area">
        <ChatInput
          disabled={!isConnected}
          onSend={(content) => {
            const success = onSendMessage(content, replyTarget?.id);
            if (success) setReplyTarget(null);
          }}
          onTypingChange={onTypingChange}
          onUpload={onUploadAttachment}
          prefillText={prefillText}
        />
      </div>

      {messageToDelete && (
        <>
          <div className="modal-overlay" onClick={() => setMessageToDelete(null)} />
          <div className="modal-content" style={{ zIndex: 1000, maxWidth: '400px', textAlign: 'center' }}>
            <h3>Delete this message?</h3>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setMessageToDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteConfirm}>Delete</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
