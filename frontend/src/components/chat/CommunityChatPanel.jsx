import { useEffect, useState } from 'react';
import { MessageSquarePlus, Users } from 'lucide-react';
import apiService from '../../services/api';
import useChatSocket from '../../hooks/useChatSocket';
import { getMemberQuickReplies, matchesCurrentUser } from '../../utils/communityHub';
import { getStoredToken } from '../../utils/sessionStorage';
import ChatWindow from './ChatWindow';
import OnlineStatus from './OnlineStatus';
import UnreadBadge from './UnreadBadge';

function samePerson(left, right) {
  if (!left || !right) return false;

  const leftId = String(left.userId || left.id || '');
  const rightId = String(right.userId || right.id || '');

  return (
    (leftId && rightId && leftId === rightId)
    || (
      left.email
      && right.email
      && String(left.email).toLowerCase() === String(right.email).toLowerCase()
    )
    || (
      left.fullName
      && right.fullName
      && left.fullName.trim().toLowerCase() === right.fullName.trim().toLowerCase()
    )
  );
}

function upsertRoom(existingRooms, nextRoom) {
  const roomIndex = existingRooms.findIndex((room) => room.id === nextRoom.id);
  if (roomIndex === -1) {
    return [nextRoom, ...existingRooms];
  }

  const nextRooms = [...existingRooms];
  nextRooms[roomIndex] = nextRoom;
  return nextRooms;
}

export default function CommunityChatPanel({
  user,
  community,
  members,
  requestFocus,
  requestedDirectMember,
  requestedPrefillText,
  onRequestHandled,
  onConnectedCountChange,
  onConnectedMembersChange,
  showToast,
}) {
  const [chatRooms, setChatRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [chatError, setChatError] = useState('');
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [composerPrefill, setComposerPrefill] = useState('');
  const [showGroupCreator, setShowGroupCreator] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedGroupEmails, setSelectedGroupEmails] = useState([]);
  const [savingRoom, setSavingRoom] = useState(false);

  const token = user?.token || getStoredToken() || '';
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

  async function loadRooms() {
    setLoadingRooms(true);
    setChatError('');

    try {
      const response = await apiService.getChatRooms();
      setChatRooms(response.data || []);
    } catch (error) {
      setChatError(error.message || 'We could not load your chat rooms.');
    } finally {
      setLoadingRooms(false);
    }
  }

  useEffect(() => {
    loadRooms();
  }, [user?.userId]);

  useEffect(() => {
    const nextRooms = Object.values(roomUpdates || {});
    if (!nextRooms.length) return;

    setChatRooms((current) => nextRooms.reduce((rooms, nextRoom) => upsertRoom(rooms, nextRoom), current));
  }, [roomUpdates]);

  const communityRooms = (Array.isArray(chatRooms) ? chatRooms : []).filter((room) => {
    if (room.type === 'GROUP') {
      return room.participants?.some((participant) => members.some((member) => samePerson(participant, member)));
    }

    const otherParticipant = room.participants?.find((participant) => !matchesCurrentUser(participant, user));
    return members.some((member) => samePerson(member, otherParticipant));
  });

  useEffect(() => {
    onConnectedCountChange?.(communityRooms.length);
  }, [communityRooms.length, onConnectedCountChange]);

  useEffect(() => {
    const connectedMembers = (Array.isArray(members) ? members : []).filter((member) => (
      communityRooms.some((room) => room.participants?.some((participant) => samePerson(participant, member)))
    ));
    onConnectedMembersChange?.(connectedMembers);
  }, [communityRooms, members, onConnectedMembersChange]);

  useEffect(() => {
    if (!communityRooms.length) {
      setActiveRoomId(null);
      return;
    }

    if (!activeRoomId || !communityRooms.some((room) => room.id === activeRoomId)) {
      setActiveRoomId(communityRooms[0].id);
    }
  }, [activeRoomId, communityRooms]);

  useEffect(() => {
    if (!requestedDirectMember) return;

    const openRequestedRoom = async () => {
      try {
        const response = await apiService.createDirectChatRoom({
          participantEmail: requestedDirectMember.email,
        });

        setChatRooms((current) => upsertRoom(current, response.data));
        setActiveRoomId(response.data.id);

        if (requestedPrefillText) {
          setComposerPrefill('');
          window.requestAnimationFrame(() => setComposerPrefill(requestedPrefillText));
        }

        showToast?.(`Opened chat with ${requestedDirectMember.fullName}.`);
      } catch (error) {
        showToast?.(error.message || `We could not open chat with ${requestedDirectMember.fullName}.`, 'error');
      } finally {
        onRequestHandled?.();
      }
    };

    openRequestedRoom();
  }, [onRequestHandled, requestedDirectMember, requestedPrefillText, showToast]);

  const activeRoom = communityRooms.find((room) => room.id === activeRoomId) || null;
  const activeRoomParticipants = activeRoom?.participants || [];
  const activeDirectParticipant = activeRoom?.type === 'DIRECT'
    ? activeRoomParticipants.find((participant) => !matchesCurrentUser(participant, user)) || null
    : null;
  const activeMember = members.find((member) => samePerson(member, activeDirectParticipant)) || null;
  const quickReplies = activeMember ? getMemberQuickReplies(activeMember, requestFocus) : [];

  async function handleCreateGroupRoom(event) {
    event.preventDefault();
    if (!groupName.trim() || selectedGroupEmails.length < 2) {
      showToast?.('Add a group name and at least two other members.', 'error');
      return;
    }

    setSavingRoom(true);
    try {
      const response = await apiService.createGroupChatRoom({
        name: groupName.trim(),
        participantEmails: selectedGroupEmails,
      });
      setChatRooms((current) => upsertRoom(current, response.data));
      setActiveRoomId(response.data.id);
      setGroupName('');
      setSelectedGroupEmails([]);
      setShowGroupCreator(false);
      showToast?.(`Created ${response.data.name}.`);
    } catch (error) {
      showToast?.(error.message || 'We could not create the group chat.', 'error');
    } finally {
      setSavingRoom(false);
    }
  }

  function handleSendMessage(content) {
    const didSend = sendMessage(content);
    if (!didSend) {
      showToast?.('The chat socket is disconnected right now. Please wait for reconnection.', 'error');
    }
    return didSend;
  }

  async function handleMessagesRead(messageId) {
    if (!activeRoomId || !messageId) return;

    try {
      await apiService.markChatMessageRead(messageId);
      setChatRooms((current) => current.map((room) => (
        room.id === activeRoomId ? { ...room, unreadCount: 0 } : room
      )));
    } catch {
      // Keep the room usable even if the unread acknowledgement fails.
    }
  }

  return (
    <div className="card community-chat-panel">
      <div className="community-chat-header">
        <div>
          <div className="community-section-eyebrow">Community inbox</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
            {activeRoom?.name || 'Real-time chat'}
          </h3>
        </div>

        <div className="community-chat-meta">
          {activeDirectParticipant ? (
            <OnlineStatus presence={onlineUsers[activeDirectParticipant.userId] || activeDirectParticipant} />
          ) : (
            <span>{community?.name || 'Group coordination'}</span>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowGroupCreator((current) => !current)}
          >
            <Users size={14} />
            <span>New Group</span>
          </button>
        </div>
      </div>

      {showGroupCreator && (
        <form className="chat-group-creator" onSubmit={handleCreateGroupRoom}>
          <input
            className="form-input"
            placeholder="Group name"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
          />
          <div className="chat-group-member-grid">
            {(Array.isArray(members) ? members : []).filter((member) => member.email).map((member) => {
              const checked = selectedGroupEmails.includes(member.email);
              return (
                <label key={member.email} className={`chat-group-option ${checked ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedGroupEmails((current) => (
                        checked
                          ? (Array.isArray(current) ? current : []).filter((email) => email !== member.email)
                          : [...current, member.email]
                      ));
                    }}
                  />
                  <span>{member.fullName}</span>
                </label>
              );
            })}
          </div>
          <div className="community-chip-row">
            <button className="btn btn-primary" type="submit" disabled={savingRoom}>
              <MessageSquarePlus size={14} />
              <span>{savingRoom ? 'Creating...' : 'Create Group'}</span>
            </button>
          </div>
        </form>
      )}

      {loadingRooms ? (
        <div className="empty-state" style={{ padding: '30px 20px' }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {chatError && <div className="chat-inline-error" style={{ marginBottom: '12px' }}>{chatError}</div>}

          <div className="chat-room-list">
            {communityRooms.length === 0 ? (
              <div className="chat-room-empty">No live rooms yet. Connect with a member to start.</div>
            ) : (
              communityRooms.map((room) => {
                const otherParticipant = room.participants?.find((participant) => !matchesCurrentUser(participant, user));
                const roomPresence = otherParticipant
                  ? onlineUsers[otherParticipant.userId] || otherParticipant
                  : null;

                return (
                  <button
                    key={room.id}
                    type="button"
                    className={`chat-room-item ${activeRoomId === room.id ? 'active' : ''}`}
                    onClick={() => setActiveRoomId(room.id)}
                  >
                    <div className="chat-room-item-main">
                      <div className="chat-room-title-row">
                        <strong>{room.name}</strong>
                        <UnreadBadge count={room.unreadCount} />
                      </div>
                      <div className="chat-room-preview">{room.lastMessage || 'No messages yet'}</div>
                    </div>
                    {roomPresence && <OnlineStatus presence={roomPresence} compact />}
                  </button>
                );
              })
            )}
          </div>

          {quickReplies.length > 0 && (
            <div className="community-chip-row" style={{ margin: '12px 0 10px' }}>
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  className="community-chip community-chip-action"
                  onClick={() => {
                    setComposerPrefill('');
                    window.requestAnimationFrame(() => setComposerPrefill(reply));
                  }}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

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
            prefillText={composerPrefill}
          />
        </>
      )}
    </div>
  );
}
