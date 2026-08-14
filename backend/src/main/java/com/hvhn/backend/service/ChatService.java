package com.hvhn.backend.service;

import com.hvhn.backend.dto.*;
import com.hvhn.backend.model.ChatMessage;
import com.hvhn.backend.model.ChatMessageReceipt;
import com.hvhn.backend.model.ChatRoom;
import com.hvhn.backend.model.ChatRoomState;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.UserPresence;
import com.hvhn.backend.model.enums.ChatMessageType;
import com.hvhn.backend.model.enums.ChatRoomType;
import com.hvhn.backend.model.enums.PresenceStatus;
import com.hvhn.backend.repository.ChatMessageRepository;
import com.hvhn.backend.repository.ChatMessageReceiptRepository;
import com.hvhn.backend.repository.ChatRoomRepository;
import com.hvhn.backend.repository.ChatRoomStateRepository;
import com.hvhn.backend.repository.UserPresenceRepository;
import com.hvhn.backend.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ChatService {

    private static final int MAX_HISTORY_PAGE_SIZE = 100;
    private static final int MAX_PREVIEW_LENGTH = 90;
    private static final DateTimeFormatter TIMESTAMP_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatMessageReceiptRepository chatMessageReceiptRepository;
    private final ChatRoomStateRepository chatRoomStateRepository;
    private final UserPresenceRepository userPresenceRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;
    private final CloudinaryUploadService cloudinaryUploadService;

    public ChatService(
            ChatRoomRepository chatRoomRepository,
            ChatMessageRepository chatMessageRepository,
            ChatMessageReceiptRepository chatMessageReceiptRepository,
            ChatRoomStateRepository chatRoomStateRepository,
            UserPresenceRepository userPresenceRepository,
            UserRepository userRepository,
            MongoTemplate mongoTemplate,
            SimpMessagingTemplate messagingTemplate,
            NotificationService notificationService,
            CloudinaryUploadService cloudinaryUploadService
    ) {
        this.chatRoomRepository = chatRoomRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.chatMessageReceiptRepository = chatMessageReceiptRepository;
        this.chatRoomStateRepository = chatRoomStateRepository;
        this.userPresenceRepository = userPresenceRepository;
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
        this.messagingTemplate = messagingTemplate;
        this.notificationService = notificationService;
        this.cloudinaryUploadService = cloudinaryUploadService;
    }

    public List<ChatRoomView> getRooms(User currentUser) {
        User user = requireCurrentUser(currentUser);
        Map<String, ChatRoomState> roomStateByRoomId = new HashMap<>();
        for (ChatRoomState state : chatRoomStateRepository.findByUserId(user.getId())) {
            roomStateByRoomId.put(state.getRoomId(), state);
        }

        return chatRoomRepository.findByParticipantIdsContainingOrderByLastMessageTimeDesc(user.getId())
                .stream()
                .filter(room -> {
                    ChatRoomState state = roomStateByRoomId.get(room.getId());
                    return state == null || (!state.isHidden() && !state.isDeletedForUser());
                })
                .map(room -> toRoomView(room, user.getId(), roomStateByRoomId.get(room.getId())))
                .toList();
    }

    public ChatRoomView getRoomViewForUser(String roomId, String userId) {
        ChatRoom room = getAccessibleRoom(roomId, userId);
        return toRoomView(room, userId, getOrCreateRoomState(roomId, userId));
    }

    public ChatHistoryResponse getHistory(User currentUser, String roomId, int page, int size) {
        User user = requireCurrentUser(currentUser);
        ChatRoom room = getAccessibleRoom(roomId, user.getId());
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, MAX_HISTORY_PAGE_SIZE));
        ChatRoomState state = getOrCreateRoomState(room.getId(), user.getId());
        Page<ChatMessage> messagePage = chatMessageRepository.findByRoomIdOrderByTimestampDesc(
                room.getId(),
                PageRequest.of(safePage, safeSize)
        );

        List<ChatMessageView> messages = messagePage.getContent().stream()
                .filter(message -> state.getClearedBeforeTimestamp() == null
                        || message.getTimestamp() == null
                        || message.getTimestamp().isAfter(state.getClearedBeforeTimestamp()))
                .sorted(Comparator.comparing(ChatMessage::getTimestamp))
                .map(message -> toMessageView(message, user.getId()))
                .toList();
        markDelivered(room, user.getId(), messagePage.getContent(), LocalDateTime.now());

        ChatHistoryResponse response = new ChatHistoryResponse();
        response.setMessages(messages);
        response.setPage(safePage);
        response.setSize(safeSize);
        response.setHasMore(messagePage.hasNext());
        return response;
    }

    public ChatRoomView createOrGetDirectRoom(User currentUser, DirectChatRoomRequest request) {
        User user = requireCurrentUser(currentUser);
        User participant = resolveParticipant(request.getParticipantId(), request.getParticipantEmail());
        if (user.getId().equals(participant.getId())) {
            throw new IllegalArgumentException("You cannot create a direct room with yourself");
        }

        String participantKey = buildDirectParticipantKey(user.getId(), participant.getId());
        Optional<ChatRoom> existingRoom = chatRoomRepository.findByTypeAndParticipantKey(ChatRoomType.DIRECT, participantKey);
        if (existingRoom.isPresent()) return getRoomViewForUser(existingRoom.get().getId(), user.getId());

        ChatRoom room = new ChatRoom();
        room.setType(ChatRoomType.DIRECT);
        room.setParticipantKey(participantKey);
        room.setParticipantIds(sortedParticipantIds(user.getId(), participant.getId()));
        LocalDateTime now = LocalDateTime.now();
        room.setCreatedAt(now);
        room.setUpdatedAt(now);

        ChatRoom savedRoom;
        try {
            savedRoom = chatRoomRepository.save(room);
        } catch (DuplicateKeyException duplicateKeyException) {
            savedRoom = chatRoomRepository.findByTypeAndParticipantKey(ChatRoomType.DIRECT, participantKey)
                    .orElseThrow(() -> duplicateKeyException);
        }
        ensureRoomStates(savedRoom);
        
        user.setPoints(user.getPoints() + 2); // +2 for starting a conversation
        userRepository.save(user);

        createSystemMessage(savedRoom, user, resolveDisplayName(user) + " started the chat", ChatMessageType.JOIN);
        return getRoomViewForUser(savedRoom.getId(), user.getId());
    }

    public ChatRoomView createGroupRoom(User currentUser, GroupChatRoomRequest request) {
        User user = requireCurrentUser(currentUser);
        String roomName = request.getName() == null ? "" : request.getName().trim();
        if (roomName.isEmpty()) {
            throw new IllegalArgumentException("Group room name is required");
        }

        LinkedHashMap<String, User> participants = new LinkedHashMap<>();
        participants.put(user.getId(), user);
        for (User participant : resolveUsers(request.getParticipantIds())) {
            participants.put(participant.getId(), participant);
        }
        for (User participant : resolveUsersByEmail(request.getParticipantEmails())) {
            participants.put(participant.getId(), participant);
        }

        if (participants.size() < 3) {
            throw new IllegalArgumentException("Add at least two other participants to create a group room");
        }

        ChatRoom room = new ChatRoom();
        room.setName(roomName);
        room.setType(ChatRoomType.GROUP);
        room.setParticipantIds(new ArrayList<>(participants.keySet()));
        LocalDateTime now = LocalDateTime.now();
        room.setCreatedAt(now);
        room.setUpdatedAt(now);

        ChatRoom savedRoom = chatRoomRepository.save(room);
        ensureRoomStates(savedRoom);

        user.setPoints(user.getPoints() + 2); // +2 for starting a group
        userRepository.save(user);

        createSystemMessage(savedRoom, user, resolveDisplayName(user) + " created " + roomName, ChatMessageType.JOIN);
        return getRoomViewForUser(savedRoom.getId(), user.getId());
    }

    public ChatMessageView handleIncomingMessage(String userId, ChatMessagePayload payload) {
        User sender = getRequiredUser(userId);
        ChatRoom room = getAccessibleRoom(payload.getRoomId(), sender.getId());
        String content = payload.getContent() == null ? "" : payload.getContent().trim();
        if (!StringUtils.hasText(content)) {
            throw new IllegalArgumentException("Message content is required");
        }
        String clientMessageId = normalizeClientMessageId(payload.getClientMessageId());
        if (StringUtils.hasText(clientMessageId)) {
            Optional<ChatMessage> existingMessage = chatMessageRepository.findBySenderIdAndClientMessageId(sender.getId(), clientMessageId);
            if (existingMessage.isPresent()) {
                return toMessageView(existingMessage.get(), sender.getId());
            }
        }
        if (StringUtils.hasText(payload.getReplyToMessageId())) {
            ChatMessage replyTo = chatMessageRepository.findById(payload.getReplyToMessageId())
                    .orElseThrow(() -> new NoSuchElementException("Reply target was not found"));
            if (!room.getId().equals(replyTo.getRoomId())) {
                throw new IllegalArgumentException("Reply target must belong to the same conversation");
            }
        }

        LocalDateTime now = LocalDateTime.now();
        ChatMessage message = new ChatMessage();
        message.setSenderId(sender.getId());
        message.setSenderName(resolveDisplayName(sender));
        message.setAvatarInitial(resolveAvatarInitial(sender));
        message.setContent(content);
        message.setClientMessageId(clientMessageId);
        message.setRoomId(room.getId());
        message.setTimestamp(now);
        message.setMessageType(payload.getMessageType() == null ? ChatMessageType.CHAT : payload.getMessageType());
        message.setRead(false);
        message.setReplyToMessageId(payload.getReplyToMessageId());

        ChatMessage savedMessage;
        try {
            savedMessage = chatMessageRepository.save(message);
        } catch (DuplicateKeyException duplicateKeyException) {
            if (StringUtils.hasText(clientMessageId)) {
                return chatMessageRepository.findBySenderIdAndClientMessageId(sender.getId(), clientMessageId)
                        .map(existing -> toMessageView(existing, sender.getId()))
                        .orElseThrow(() -> duplicateKeyException);
            }
            throw duplicateKeyException;
        }
        updateRoomLastMessage(room, savedMessage, now);
        createDeliveryReceipts(room, savedMessage, now);
        createChatNotifications(room, savedMessage);
        updateUnreadCounts(room, sender.getId(), now);
        return toMessageView(savedMessage, sender.getId());
    }

    public boolean hasMessageFromClientId(String userId, String clientMessageId) {
        String normalized = normalizeClientMessageId(clientMessageId);
        return StringUtils.hasText(normalized)
                && chatMessageRepository.findBySenderIdAndClientMessageId(userId, normalized).isPresent();
    }

    public List<ChatReceiptEvent> getReceiptEventsForMessage(String messageId, String type, int unreadCount) {
        if (!StringUtils.hasText(messageId)) return List.of();
        return chatMessageReceiptRepository.findByMessageId(messageId).stream()
                .map(receipt -> toReceiptEvent(receipt, type, unreadCount))
                .toList();
    }

    public TypingEventView buildTypingEvent(String userId, TypingEventPayload payload) {
        User user = getRequiredUser(userId);
        getAccessibleRoom(payload.getRoomId(), userId);

        TypingEventView view = new TypingEventView();
        view.setRoomId(payload.getRoomId());
        view.setUserId(user.getId());
        view.setFullName(resolveDisplayName(user));
        view.setAvatarInitial(resolveAvatarInitial(user));
        view.setAvatarUrl(user.getProfileImage());
        view.setProfileImage(user.getProfileImage());
        view.setTyping(payload.isTyping());
        view.setTimestamp(formatDateTime(LocalDateTime.now()));
        return view;
    }

    public UnreadUpdateResponse markRead(User currentUser, String messageId) {
        User user = requireCurrentUser(currentUser);
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new NoSuchElementException("Message not found"));
        ChatRoom room = getAccessibleRoom(message.getRoomId(), user.getId());
        LocalDateTime now = LocalDateTime.now();

        Query query = new Query(Criteria.where("roomId").is(room.getId()).and("senderId").ne(user.getId()).and("read").is(false));
        mongoTemplate.updateMulti(query, new Update().set("read", true), ChatMessage.class);
        markSeenForUser(room, user.getId(), message.getId(), now);

        ChatRoomState state = getOrCreateRoomState(room.getId(), user.getId());
        state.setUnreadCount(0);
        state.setLastReadAt(now);
        state.setLastReadMessageId(message.getId());
        chatRoomStateRepository.save(state);

        UnreadUpdateResponse response = new UnreadUpdateResponse();
        response.setRoomId(room.getId());
        response.setUnreadCount(0);
        return response;
    }

    public UnreadUpdateResponse markSeen(User currentUser, String roomId, String lastSeenMessageId) {
        User user = requireCurrentUser(currentUser);
        ChatRoom room = getAccessibleRoom(roomId, user.getId());
        LocalDateTime now = LocalDateTime.now();
        markSeenForUser(room, user.getId(), lastSeenMessageId, now);

        ChatRoomState state = getOrCreateRoomState(room.getId(), user.getId());
        state.setUnreadCount(0);
        state.setLastReadAt(now);
        state.setLastReadMessageId(lastSeenMessageId);
        chatRoomStateRepository.save(state);

        UnreadUpdateResponse response = new UnreadUpdateResponse();
        response.setRoomId(room.getId());
        response.setUnreadCount(0);
        return response;
    }

    public FileUploadResponse uploadAttachment(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Choose a file to upload");
        }

        String secureUrl;
        try {
            secureUrl = cloudinaryUploadService.upload(file);
        } catch (CloudinaryUploadService.CloudinaryUploadException ex) {
            throw new IllegalStateException(ex.getMessage(), ex);
        }

        String originalFileName = StringUtils.hasText(file.getOriginalFilename())
                ? file.getOriginalFilename() : "attachment";

        FileUploadResponse response = new FileUploadResponse();
        response.setUrl(secureUrl);
        response.setFileName(originalFileName);
        response.setContentType(file.getContentType());
        response.setSize(file.getSize());
        return response;
    }

    public PresenceView markUserOnline(String userId) {
        return upsertPresence(userId, PresenceStatus.ONLINE, 1);
    }

    public PresenceView markUserOffline(String userId) {
        return upsertPresence(userId, PresenceStatus.OFFLINE, 0);
    }

    public PresenceView updatePresenceSessionCount(String userId, int activeSessionCount) {
        PresenceStatus status = activeSessionCount > 0 ? PresenceStatus.ONLINE : PresenceStatus.OFFLINE;
        return upsertPresence(userId, status, activeSessionCount);
    }

    public PresenceView updatePresence(String userId, PresenceStatus status) {
        if (status == null) {
            throw new IllegalArgumentException("Presence status is required");
        }
        int sessionCount = status == PresenceStatus.OFFLINE ? 0 : 1;
        return upsertPresence(userId, status, sessionCount);
    }

    public List<PresenceView> getOnlineUsers() {
        return userPresenceRepository.findByStatusIn(List.of(PresenceStatus.ONLINE, PresenceStatus.AWAY))
                .stream()
                .map(this::toPresenceView)
                .toList();
    }

    public ChatMessageView toggleReaction(User currentUser, String messageId, String emoji) {
        User user = requireCurrentUser(currentUser);
        if (!StringUtils.hasText(emoji)) {
            throw new IllegalArgumentException("Reaction emoji is required");
        }
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new NoSuchElementException("Message not found"));
        getAccessibleRoom(message.getRoomId(), user.getId());
        
        Map<String, List<String>> reactions = message.getReactions();
        if (reactions == null) reactions = new HashMap<>();
        
        List<String> users = reactions.getOrDefault(emoji, new ArrayList<>());
        if (users.contains(user.getId())) {
            users.remove(user.getId());
        } else {
            users.add(user.getId());
        }
        
        if (users.isEmpty()) {
            reactions.remove(emoji);
        } else {
            reactions.put(emoji, users);
        }
        
        message.setReactions(reactions);
        return toMessageView(chatMessageRepository.save(message), user.getId());
    }

    public void deleteMessage(User currentUser, String messageId) {
        User user = requireCurrentUser(currentUser);
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new NoSuchElementException("Message not found"));
        
        if (!message.getSenderId().equals(user.getId())) {
            throw new IllegalArgumentException("You can only delete your own messages");
        }
        
        message.setDeletedForEveryone(true);
        message.setDeletedAt(LocalDateTime.now());
        message.setContent("Message deleted");
        ChatMessage saved = chatMessageRepository.save(message);
        chatRoomRepository.findById(message.getRoomId())
                .filter(room -> message.getId().equals(room.getLastMessageId()))
                .ifPresent(room -> {
                    updateRoomLastMessage(room, saved, saved.getDeletedAt());
                });
    }
    
    public void deleteRoom(User currentUser, String roomId) {
        User user = requireCurrentUser(currentUser);
        ChatRoom room = getAccessibleRoom(roomId, user.getId());
        
        LocalDateTime now = LocalDateTime.now();
        ChatRoomState state = getOrCreateRoomState(room.getId(), user.getId());
        state.setHidden(true);
        state.setDeletedForUser(true);
        state.setArchived(false);
        state.setUnreadCount(0);
        state.setHiddenAt(now);
        state.setClearedBeforeTimestamp(now);
        state.setLastReadAt(now);
        chatRoomStateRepository.save(state);
    }

    public ChatRoom getAccessibleRoom(String roomId, String userId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new NoSuchElementException("Chat room not found"));
        if (!room.getParticipantIds().contains(userId)) {
            throw new IllegalArgumentException("You are not a participant in this room");
        }
        return room;
    }

    public List<String> getParticipantIds(String roomId) {
        return new ArrayList<>(chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new NoSuchElementException("Chat room not found"))
                .getParticipantIds());
    }

    private PresenceView upsertPresence(String userId, PresenceStatus status, int activeSessionCount) {
        User user = getRequiredUser(userId);
        UserPresence presence = userPresenceRepository.findByUserId(userId).orElseGet(UserPresence::new);
        presence.setUserId(userId);
        presence.setStatus(status);
        presence.setUpdatedAt(LocalDateTime.now());
        presence.setActiveSessionCount(Math.max(0, activeSessionCount));
        if (status == PresenceStatus.OFFLINE || presence.getLastSeen() == null) {
            presence.setLastSeen(LocalDateTime.now());
        }
        return toPresenceView(user, userPresenceRepository.save(presence));
    }

    private void ensureRoomStates(ChatRoom room) {
        for (String participantId : room.getParticipantIds()) {
            getOrCreateRoomState(room.getId(), participantId);
        }
    }

    private void updateUnreadCounts(ChatRoom room, String senderId, LocalDateTime timestamp) {
        for (String participantId : room.getParticipantIds()) {
            ChatRoomState state = getOrCreateRoomState(room.getId(), participantId);
            if (participantId.equals(senderId)) {
                state.setUnreadCount(0);
                state.setLastReadAt(timestamp);
            } else {
                state.setUnreadCount(Math.max(0, state.getUnreadCount()) + 1);
                state.setHidden(false);
                state.setDeletedForUser(false);
                state.setHiddenAt(null);
            }
            chatRoomStateRepository.save(state);
        }
    }

    private void createSystemMessage(ChatRoom room, User actor, String content, ChatMessageType messageType) {
        LocalDateTime now = LocalDateTime.now();
        ChatMessage message = new ChatMessage();
        message.setSenderId(actor.getId());
        message.setSenderName(resolveDisplayName(actor));
        message.setAvatarInitial(resolveAvatarInitial(actor));
        message.setContent(content);
        message.setClientMessageId("system-" + UUID.randomUUID());
        message.setRoomId(room.getId());
        message.setTimestamp(now);
        message.setMessageType(messageType);
        message.setRead(true);
        ChatMessage savedMessage = chatMessageRepository.save(message);
        updateRoomLastMessage(room, savedMessage, now);
    }

    private ChatRoomState getOrCreateRoomState(String roomId, String userId) {
        return chatRoomStateRepository.findByRoomIdAndUserId(roomId, userId).orElseGet(() -> {
            ChatRoomState state = new ChatRoomState();
            state.setRoomId(roomId);
            state.setUserId(userId);
            state.setUnreadCount(0);
            state.setLastReadAt(LocalDateTime.now());
            try {
                return chatRoomStateRepository.save(state);
            } catch (DuplicateKeyException duplicateKeyException) {
                return chatRoomStateRepository.findByRoomIdAndUserId(roomId, userId)
                        .orElseThrow(() -> duplicateKeyException);
            }
        });
    }

    private void createDeliveryReceipts(ChatRoom room, ChatMessage message, LocalDateTime now) {
        for (String participantId : room.getParticipantIds()) {
            if (participantId.equals(message.getSenderId())) continue;
            ChatMessageReceipt receipt = chatMessageReceiptRepository.findByMessageIdAndUserId(message.getId(), participantId)
                    .orElseGet(ChatMessageReceipt::new);
            receipt.setRoomId(room.getId());
            receipt.setMessageId(message.getId());
            receipt.setUserId(participantId);
            if (receipt.getDeliveredAt() == null && isUserOnline(participantId)) receipt.setDeliveredAt(now);
            chatMessageReceiptRepository.save(receipt);
        }
    }

    private void createChatNotifications(ChatRoom room, ChatMessage message) {
        for (String participantId : room.getParticipantIds()) {
            if (participantId.equals(message.getSenderId())) continue;
            notificationService.notifyChatMessage(room, message, participantId, isUserOnline(participantId));
        }
    }

    private void markDelivered(ChatRoom room, String userId, List<ChatMessage> messages, LocalDateTime now) {
        for (ChatMessage message : messages) {
            if (message.getSenderId().equals(userId)) continue;
            ChatMessageReceipt receipt = chatMessageReceiptRepository.findByMessageIdAndUserId(message.getId(), userId)
                    .orElseGet(ChatMessageReceipt::new);
            receipt.setRoomId(room.getId());
            receipt.setMessageId(message.getId());
            receipt.setUserId(userId);
            boolean newlyDelivered = receipt.getDeliveredAt() == null;
            if (newlyDelivered) receipt.setDeliveredAt(now);
            ChatMessageReceipt savedReceipt = chatMessageReceiptRepository.save(receipt);
            if (newlyDelivered) {
                messagingTemplate.convertAndSendToUser(
                        message.getSenderId(),
                        "/queue/chat/receipts",
                        toReceiptEvent(savedReceipt, "DELIVERED", 0)
                );
            }
        }
    }

    private void markSeenForUser(ChatRoom room, String userId, String lastSeenMessageId, LocalDateTime now) {
        LocalDateTime boundary = null;
        if (StringUtils.hasText(lastSeenMessageId)) {
            ChatMessage boundaryMessage = chatMessageRepository.findById(lastSeenMessageId)
                    .orElseThrow(() -> new NoSuchElementException("Seen boundary message was not found"));
            if (!room.getId().equals(boundaryMessage.getRoomId())) {
                throw new IllegalArgumentException("Seen boundary must belong to the same conversation");
            }
            boundary = boundaryMessage.getTimestamp();
        }

        List<ChatMessage> messages = boundary == null
                ? chatMessageRepository.findByRoomIdOrderByTimestampDesc(room.getId(), PageRequest.of(0, MAX_HISTORY_PAGE_SIZE)).getContent()
                : chatMessageRepository.findByRoomIdAndTimestampLessThanEqualOrderByTimestampAsc(room.getId(), boundary);
        for (ChatMessage message : messages) {
            if (message.getSenderId().equals(userId)) continue;
            ChatMessageReceipt receipt = chatMessageReceiptRepository.findByMessageIdAndUserId(message.getId(), userId)
                    .orElseGet(ChatMessageReceipt::new);
            receipt.setRoomId(room.getId());
            receipt.setMessageId(message.getId());
            receipt.setUserId(userId);
            if (receipt.getDeliveredAt() == null) receipt.setDeliveredAt(now);
            receipt.setSeenAt(now);
            chatMessageReceiptRepository.save(receipt);
        }
    }

    private void updateRoomLastMessage(ChatRoom room, ChatMessage message, LocalDateTime timestamp) {
        String preview = buildPreview(message);
        room.setLastMessage(preview);
        room.setLastMessagePreview(preview);
        room.setLastMessageId(message.getId());
        room.setLastMessageSenderId(message.getSenderId());
        room.setLastMessageTime(timestamp);
        room.setUpdatedAt(timestamp);
        chatRoomRepository.save(room);
    }

    private boolean isUserOnline(String userId) {
        return userPresenceRepository.findByUserId(userId)
                .map(presence -> presence.getStatus() == PresenceStatus.ONLINE || presence.getStatus() == PresenceStatus.AWAY)
                .orElse(false);
    }

    private ChatRoomView toRoomView(ChatRoom room, String currentUserId, ChatRoomState roomState) {
        Map<String, User> participantsById = new HashMap<>();
        for (User participant : userRepository.findAllById(room.getParticipantIds())) {
            participantsById.put(participant.getId(), participant);
        }

        List<ChatParticipantView> participantViews = room.getParticipantIds().stream()
                .map(participantsById::get)
                .filter(Objects::nonNull)
                .map(this::toParticipantView)
                .toList();

        ChatRoomView view = new ChatRoomView();
        view.setId(room.getId());
        view.setType(room.getType());
        view.setParticipantIds(new ArrayList<>(room.getParticipantIds()));
        view.setParticipants(participantViews);
        view.setUnreadCount(roomState != null ? roomState.getUnreadCount() : 0);
        view.setHidden(roomState != null && roomState.isHidden());
        view.setArchived(roomState != null && roomState.isArchived());
        view.setMuted(roomState != null && roomState.isMuted());
        view.setCreatedAt(formatDateTime(room.getCreatedAt()));
        view.setName(resolveRoomName(room, currentUserId, participantsById));
        view.setLastMessage(StringUtils.hasText(room.getLastMessagePreview()) ? room.getLastMessagePreview() : room.getLastMessage());
        view.setLastMessageTime(formatDateTime(room.getLastMessageTime()));
        view.setRequestId(room.getRequestId());
        view.setRequestTitle(room.getRequestTitle());
        if (StringUtils.hasText(room.getLastMessageId())) {
            view.setLastMessageId(room.getLastMessageId());
        } else {
            chatMessageRepository.findFirstByRoomIdOrderByTimestampDesc(room.getId()).map(ChatMessage::getId).ifPresent(view::setLastMessageId);
        }
        return view;
    }

    private ChatParticipantView toParticipantView(User user) {
        UserPresence presence = userPresenceRepository.findByUserId(user.getId()).orElse(null);
        ChatParticipantView view = new ChatParticipantView();
        view.setUserId(user.getId());
        view.setFullName(resolveDisplayName(user));
        view.setEmail(user.getEmail());
        view.setAvatarInitial(resolveAvatarInitial(user));
        view.setAvatarUrl(user.getProfileImage());
        view.setProfileImage(user.getProfileImage());
        view.setStatus(presence != null ? presence.getStatus() : PresenceStatus.OFFLINE);
        view.setLastSeen(presence != null ? formatDateTime(presence.getLastSeen()) : null);
        return view;
    }

    private PresenceView toPresenceView(UserPresence presence) {
        return toPresenceView(getRequiredUser(presence.getUserId()), presence);
    }

    private PresenceView toPresenceView(User user, UserPresence presence) {
        PresenceView view = new PresenceView();
        view.setUserId(user.getId());
        view.setFullName(resolveDisplayName(user));
        view.setAvatarInitial(resolveAvatarInitial(user));
        view.setAvatarUrl(user.getProfileImage());
        view.setProfileImage(user.getProfileImage());
        view.setStatus(presence.getStatus());
        view.setLastSeen(formatDateTime(presence.getLastSeen()));
        return view;
    }

    private ChatMessageView toMessageView(ChatMessage message) {
        return toMessageView(message, null);
    }

    private ChatMessageView toMessageView(ChatMessage message, String currentUserId) {
        ChatMessageView view = new ChatMessageView();
        view.setId(message.getId());
        view.setSenderId(message.getSenderId());
        view.setSenderName(message.getSenderName());
        view.setAvatarInitial(message.getAvatarInitial());
        userRepository.findById(message.getSenderId()).ifPresent(sender -> {
            view.setAvatarUrl(sender.getProfileImage());
            view.setProfileImage(sender.getProfileImage());
        });
        view.setContent(message.getContent());
        view.setClientMessageId(message.getClientMessageId());
        view.setRoomId(message.getRoomId());
        view.setTimestamp(formatDateTime(message.getTimestamp()));
        view.setMessageType(message.getMessageType());
        view.setRead(message.isRead());
        view.setDeletedForEveryone(message.isDeletedForEveryone());
        view.setReplyToMessageId(message.getReplyToMessageId());
        view.setReactions(message.getReactions());
        if (StringUtils.hasText(currentUserId)) {
            chatMessageReceiptRepository.findByMessageIdAndUserId(message.getId(), currentUserId).ifPresent(receipt -> {
                view.setDeliveredAt(formatDateTime(receipt.getDeliveredAt()));
                view.setSeenAt(formatDateTime(receipt.getSeenAt()));
            });
        }
        return view;
    }

    private String resolveRoomName(ChatRoom room, String currentUserId, Map<String, User> participantsById) {
        if (room.getType() == ChatRoomType.GROUP && StringUtils.hasText(room.getName())) {
            return room.getName();
        }
        if (room.getType() == ChatRoomType.DIRECT) {
            return room.getParticipantIds().stream()
                    .filter(participantId -> !participantId.equals(currentUserId))
                    .map(participantsById::get)
                    .filter(Objects::nonNull)
                    .map(this::resolveDisplayName)
                    .findFirst()
                    .orElse("Direct chat");
        }
        return StringUtils.hasText(room.getName()) ? room.getName() : "Group chat";
    }

    private User resolveParticipant(String participantId, String participantEmail) {
        if (StringUtils.hasText(participantId)) {
            return userRepository.findById(participantId.trim())
                    .orElseThrow(() -> new NoSuchElementException("Chat participant was not found"));
        }
        if (StringUtils.hasText(participantEmail)) {
            return userRepository.findByEmail(participantEmail.trim().toLowerCase(Locale.ROOT))
                    .orElseThrow(() -> new NoSuchElementException("Chat participant was not found"));
        }
        throw new IllegalArgumentException("Choose a participant to start a direct room");
    }

    private List<User> resolveUsers(Collection<String> participantIds) {
        if (participantIds == null) return List.of();
        List<User> users = new ArrayList<>();
        for (String participantId : participantIds) {
            if (!StringUtils.hasText(participantId)) continue;
            users.add(userRepository.findById(participantId.trim())
                    .orElseThrow(() -> new NoSuchElementException("One or more group participants were not found")));
        }
        return users;
    }

    private List<User> resolveUsersByEmail(Collection<String> participantEmails) {
        if (participantEmails == null) return List.of();
        List<User> users = new ArrayList<>();
        for (String participantEmail : participantEmails) {
            if (!StringUtils.hasText(participantEmail)) continue;
            users.add(userRepository.findByEmail(participantEmail.trim().toLowerCase(Locale.ROOT))
                    .orElseThrow(() -> new NoSuchElementException("One or more group participants were not found")));
        }
        return users;
    }

    private User requireCurrentUser(User currentUser) {
        if (currentUser == null) {
            throw new IllegalArgumentException("Authentication is required");
        }
        return currentUser;
    }

    private User getRequiredUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new NoSuchElementException("User was not found"));
    }

    private String resolveDisplayName(User user) {
        if (StringUtils.hasText(user.getFullName())) return user.getFullName().trim();
        if (StringUtils.hasText(user.getEmail())) return user.getEmail().trim();
        return "Sahay Member";
    }

    private String resolveAvatarInitial(User user) {
        return resolveDisplayName(user).substring(0, 1).toUpperCase(Locale.ROOT);
    }

    private String buildPreview(ChatMessage message) {
        if (message.isDeletedForEveryone()) {
            return "Message deleted";
        }
        String content = message.getContent() == null ? "" : message.getContent().trim();
        if (message.getMessageType() == ChatMessageType.TYPING) {
            return message.getSenderName() + " is typing...";
        }
        if (content.length() <= MAX_PREVIEW_LENGTH) {
            return content;
        }
        return content.substring(0, MAX_PREVIEW_LENGTH - 1) + "...";
    }

    private String buildDirectParticipantKey(String firstUserId, String secondUserId) {
        return String.join(":", sortedParticipantIds(firstUserId, secondUserId));
    }

    private List<String> sortedParticipantIds(String firstUserId, String secondUserId) {
        List<String> ids = new ArrayList<>(List.of(firstUserId, secondUserId));
        ids.sort(String::compareTo);
        return ids;
    }

    private String normalizeClientMessageId(String clientMessageId) {
        if (!StringUtils.hasText(clientMessageId)) return null;
        String normalized = clientMessageId.trim();
        if (normalized.length() > 120) {
            throw new IllegalArgumentException("Client message ID is too long");
        }
        return normalized;
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? null : TIMESTAMP_FORMATTER.format(value);
    }

    private ChatReceiptEvent toReceiptEvent(ChatMessageReceipt receipt, String type, int unreadCount) {
        ChatReceiptEvent event = new ChatReceiptEvent();
        event.setRoomId(receipt.getRoomId());
        event.setUnreadCount(unreadCount);
        event.setMessageId(receipt.getMessageId());
        event.setUserId(receipt.getUserId());
        event.setType(type);
        event.setDeliveredAt(formatDateTime(receipt.getDeliveredAt()));
        event.setSeenAt(formatDateTime(receipt.getSeenAt()));
        return event;
    }
}
