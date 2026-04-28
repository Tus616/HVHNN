// FEATURE: Global Chats (Phase 6 Expansion)
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/api';
import ChatWindow from '../components/chat/ChatWindow';
import OnlineStatus from '../components/chat/OnlineStatus';
import UnreadBadge from '../components/chat/UnreadBadge';
import useChatSocket from '../hooks/useChatSocket';
import { matchesCurrentUser } from '../utils/communityHub';
import messagingImage from '../assets/messages.png';
import searchImage from '../assets/search.png';


function samePerson(left, right) {
  if (!left || !right) return false;
  const leftId = String(left.userId || left.id || '');
  const rightId = String(right.userId || right.id || '');
  return (
    (leftId && rightId && leftId === rightId) ||
    (left.email && right.email && String(left.email).toLowerCase() === String(right.email).toLowerCase())
  );
}

function upsertRoom(existingRooms, nextRoom) {
  const roomIndex = existingRooms.findIndex((room) => room.id === nextRoom.id);
  if (roomIndex === -1) return [nextRoom, ...existingRooms];
  const nextRooms = [...existingRooms];
  nextRooms[roomIndex] = nextRoom;
  return nextRooms;
}

export default function Chats() {
  const { user } = useAuth();
  const [chatRooms, setChatRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  const token = user?.token || window.localStorage.getItem('hvhn_token') || '';
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

  useEffect(() => {
    loadRooms();
  }, [user?.userId]);

  useEffect(() => {
    const nextRoomList = Object.values(roomUpdates || {});
    if (!nextRoomList.length) return;
    setChatRooms((current) => nextRoomList.reduce((rooms, nextRoom) => upsertRoom(rooms, nextRoom), current));
  }, [roomUpdates]);

  const loadRooms = async () => {
    setLoadingRooms(true);
    try {
      const response = await apiService.getChatRooms();
      setChatRooms(response.data || []);
      if ((response.data || []).length > 0 && !activeRoomId) {
        setActiveRoomId(response.data[0].id);
      }
    } catch {
      // Fallback
    } finally {
      setLoadingRooms(false);
    }
  };

  // Sidebar Deduplication: Ensure unique participants in direct chats
  const uniqueRooms = (() => {
    const seen = new Set();
    return chatRooms.filter(room => {
      if (room.type === 'GROUP') return true;
      const other = room.participants?.find(p => !matchesCurrentUser(p, user));
      if (!other) return true; // Keep if no "other" participant found (e.g. self-chat or system)
      const key = other.userId || other.id || other.email;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const activeRoom = chatRooms.find(r => r.id === activeRoomId) || null;
  const activeRoomParticipants = activeRoom?.participants || [];
  const activeDirectParticipant = activeRoom?.type === 'DIRECT'
    ? activeRoomParticipants.find((participant) => !matchesCurrentUser(participant, user)) || null
    : null;

  async function handleMessagesRead(messageId) {
    if (!activeRoomId || !messageId) return;
    try {
      await apiService.markChatMessageRead(messageId);
      setChatRooms((current) => current.map((room) => (
        room.id === activeRoomId ? { ...room, unreadCount: 0 } : room
      )));
    } catch {}
  }

  function handleSendMessage(content, replyToId) {
    return sendMessage(content, 'CHAT', replyToId);
  }

  async function handleUploadAttachment(file) {
    try {
      const response = await apiService.uploadChatAttachment(file);
      const { url, fileName, contentType } = response.data;
      const attachmentMessage = `attachment:${url}|${fileName}|${contentType || ''}`;
      sendMessage(attachmentMessage);
    } catch {}
  }

  const filteredRooms = uniqueRooms.filter(room => {
    if (unreadOnly && (room.unreadCount || 0) === 0) return false;
    if (sidebarSearch.trim()) {
      return room.name?.toLowerCase().includes(sidebarSearch.trim().toLowerCase());
    }
    return true;
  });

  const handleDeleteRoomConfirm = async () => {
    if (!roomToDelete) return;
    try {
      await apiService.deleteChatRoom(roomToDelete);
      setChatRooms(prev => prev.filter(r => r.id !== roomToDelete));
      if (activeRoomId === roomToDelete) setActiveRoomId(null);
    } catch (err) {
      console.error("Failed to delete", err);
    } finally {
      setRoomToDelete(null);
    }
  };

  return (
    <div className="animate-in" style={{ height: 'calc(100vh - 80px)' }}>
      <div className="chat-layout-container">
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
          {/* Sidebar */}
          <div className="chat-room-sidebar">
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px' }}>💬 Chats</h2>
              <div className="search-box" style={{ position: 'relative', marginBottom: '16px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search..." 
                  value={sidebarSearch}
                  onChange={e => setSidebarSearch(e.target.value)}
                  style={{ paddingLeft: '32px', borderRadius: '12px', background: 'var(--bg-secondary)', border: 'none' }}
                />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setUnreadOnly(!unreadOnly)}
                  className={`btn btn-sm ${unreadOnly ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ borderRadius: '20px', fontSize: '0.75rem', padding: '4px 12px' }}
                >
                  Unread {unreadOnly && '✓'}
                </button>
              </div>
            </div>

            <div className="chat-room-list" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {loadingRooms ? (
                <div style={{ padding: '40px', textAlign: 'center' }}><div className="spinner" /></div>
              ) : filteredRooms.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', opacity: 0.6 }}>
                  <img src={searchImage} alt="" style={{ width: '80px', height: '80px', margin: '0 auto 16px', opacity: 0.8 }} />
                  <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>No conversations</p>
                </div>

              ) : (
                filteredRooms.map((room) => {
                  const other = room.participants?.find((p) => !matchesCurrentUser(p, user));
                  const presence = other ? onlineUsers[other.userId || other.id] || other : null;
                  return (
                    <button
                      key={room.id}
                      className={`chat-room-item ${activeRoomId === room.id ? 'active' : ''}`}
                      onClick={() => setActiveRoomId(room.id)}
                      style={{ width: '100%', marginBottom: '2px', textAlign: 'left', borderRadius: '12px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', background: activeRoomId === room.id ? 'var(--accent-primary-alpha)' : 'transparent', border: 'none', transition: 'all 0.2s' }}
                    >
                      <div style={{ position: 'relative' }}>
                        <div className="profile-avatar" style={{ width: '48px', height: '48px', fontSize: '1.2rem', margin: 0 }}>
                          {room.name?.charAt(0)}
                        </div>
                        {presence && <div style={{ position: 'absolute', bottom: '2px', right: '2px' }}><OnlineStatus presence={presence} compact /></div>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{room.name}</strong>
                          {room.unreadCount > 0 && <UnreadBadge count={room.unreadCount} />}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: room.unreadCount > 0 ? 600 : 400 }}>
                          {room.lastMessage || 'No messages'}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="chat-content-area">
            {activeRoomId && activeRoom ? (
              <>
                <div className="chat-main-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="profile-avatar" style={{ width: '42px', height: '42px', margin: 0 }}>
                      {activeRoom.name?.charAt(0)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{activeRoom.name}</h3>
                      <div className="community-chat-meta">
                        {activeDirectParticipant ? (
                          <OnlineStatus presence={onlineUsers[activeDirectParticipant.userId || activeDirectParticipant.id] || activeDirectParticipant} />
                        ) : (
                          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Community Group</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="Search messages..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="form-input"
                        style={{ height: '36px', width: '180px', fontSize: '0.85rem', borderRadius: '18px', paddingLeft: '32px', background: 'var(--bg-secondary)', border: 'none' }}
                      />
                      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: '0.8rem' }}>🔍</span>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <button 
                        className="btn btn-icon" 
                        onClick={() => setShowMenu(!showMenu)}
                        style={{ fontSize: '1.2rem', padding: '4px', background: 'none' }}
                      >
                        ⋮
                      </button>
                      {showMenu && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowMenu(false)} />
                          <div className="card" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 100, width: '180px', padding: '8px', marginTop: '8px', boxShadow: 'var(--shadow-lg)' }}>
                            <button className="btn-menu-item" onClick={() => { /* Mute logic */ setShowMenu(false); }}>🔔 Mute Chat</button>
                            <button className="btn-menu-item danger" onClick={() => { setRoomToDelete(activeRoom.id); setShowMenu(false); }}>🗑️ Delete Chat</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <ChatWindow
                  room={activeRoom}
                  currentUserId={user?.userId || user?.id}
                  liveMessages={liveMessages}
                  typingUsers={typingUsers}
                  isConnected={isConnected}
                  connectionStatus={connectionStatus}
                  onSendMessage={handleSendMessage}
                  onTypingChange={sendTyping}
                  onUploadAttachment={handleUploadAttachment}
                  onMessagesRead={handleMessagesRead}
                  onDeleteMessage={apiService.deleteChatMessage}
                  searchQuery={searchQuery}
                />
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', padding: '40px', textAlign: 'center' }}>
                <img src={messagingImage} alt="" className="chat-welcome-image animate-in fade-in zoom-in slide-in-from-bottom-4 duration-700" />
                <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '12px' }}>Hyperlocal Messaging</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '360px', fontSize: '1.05rem', lineHeight: 1.5 }}>Select a conversation from the sidebar to connect with members of your verified network securely.</p>
              </div>

            )}
          </div>
        </div>
      </div>

      {roomToDelete && (
        <>
          <div className="modal-overlay" onClick={() => setRoomToDelete(null)} />
          <div className="modal-content" style={{ zIndex: 1000, maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🗑️</div>
            <h3>Delete Conversation?</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>This will permanently remove the chat for you. Continue?</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setRoomToDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDeleteRoomConfirm}>Confirm</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
