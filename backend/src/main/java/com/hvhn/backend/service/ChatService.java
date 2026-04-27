package com.hvhn.backend.service;

import com.hvhn.backend.dto.*;
import com.hvhn.backend.model.ChatMessage;
import com.hvhn.backend.model.ChatRoom;
import com.hvhn.backend.model.ChatRoomState;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.UserPresence;
import com.hvhn.backend.model.enums.ChatMessageType;
import com.hvhn.backend.model.enums.ChatRoomType;
import com.hvhn.backend.model.enums.PresenceStatus;
import com.hvhn.backend.repository.ChatMessageRepository;
import com.hvhn.backend.repository.ChatRoomRepository;
import com.hvhn.backend.repository.ChatRoomStateRepository;
import com.hvhn.backend.repository.UserPresenceRepository;
import com.hvhn.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
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
    private final ChatRoomStateRepository chatRoomStateRepository;
    private final UserPresenceRepository userPresenceRepository;
    private final UserRepository userRepository;
    private final MongoTemplate mongoTemplate;
    private final Path uploadRoot;

    public ChatService(
            ChatRoomRepository chatRoomRepository,
            ChatMessageRepository chatMessageRepository,
            ChatRoomStateRepository chatRoomStateRepository,
            UserPresenceRepository userPresenceRepository,
            UserRepository userRepository,
            MongoTemplate mongoTemplate,
            @Value("${app.chat.upload-dir:uploads/chat}") String uploadDir
    ) {
        this.chatRoomRepository = chatRoomRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.chatRoomStateRepository = chatRoomStateRepository;
        this.userPresenceRepository = userPresenceRepository;
        this.userRepository = userRepository;
        this.mongoTemplate = mongoTemplate;
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    public List<ChatRoomView> getRooms(User currentUser) {
        User user = requireCurrentUser(currentUser);
        Map<String, ChatRoomState> roomStateByRoomId = new HashMap<>();
        for (ChatRoomState state : chatRoomStateRepository.findByUserId(user.getId())) {
            roomStateByRoomId.put(state.getRoomId(), state);
        }

        return chatRoomRepository.findByParticipantIdsContainingOrderByLastMessageTimeDesc(user.getId())
                .stream()
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
        Page<ChatMessage> messagePage = chatMessageRepository.findByRoomIdOrderByTimestampDesc(
                room.getId(),
                PageRequest.of(safePage, safeSize)
        );

        List<ChatMessageView> messages = messagePage.getContent().stream()
                .sorted(Comparator.comparing(ChatMessage::getTimestamp))
                .map(this::toMessageView)
                .toList();

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

        Optional<ChatRoom> existingRoom = chatRoomRepository.findByTypeAndParticipantIdsContaining(
                        ChatRoomType.DIRECT,
                        user.getId()
                )
                .stream()
                .filter(room -> room.getParticipantIds().size() == 2)
                .filter(room -> room.getParticipantIds().contains(participant.getId()))
                .findFirst();

        if (existingRoom.isPresent()) {
            return getRoomViewForUser(existingRoom.get().getId(), user.getId());
        }

        ChatRoom room = new ChatRoom();
        room.setType(ChatRoomType.DIRECT);
        room.setParticipantIds(List.of(user.getId(), participant.getId()));
        room.setCreatedAt(LocalDateTime.now());

        ChatRoom savedRoom = chatRoomRepository.save(room);
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
        room.setCreatedAt(LocalDateTime.now());

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

        LocalDateTime now = LocalDateTime.now();
        ChatMessage message = new ChatMessage();
        message.setSenderId(sender.getId());
        message.setSenderName(resolveDisplayName(sender));
        message.setAvatarInitial(resolveAvatarInitial(sender));
        message.setContent(content);
        message.setRoomId(room.getId());
        message.setTimestamp(now);
        message.setMessageType(payload.getMessageType() == null ? ChatMessageType.CHAT : payload.getMessageType());
        message.setRead(false);
        message.setReplyToMessageId(payload.getReplyToMessageId());

        ChatMessage savedMessage = chatMessageRepository.save(message);
        room.setLastMessage(buildPreview(savedMessage));
        room.setLastMessageTime(now);
        chatRoomRepository.save(room);
        updateUnreadCounts(room, sender.getId(), now);
        return toMessageView(savedMessage);
    }

    public TypingEventView buildTypingEvent(String userId, TypingEventPayload payload) {
        User user = getRequiredUser(userId);
        getAccessibleRoom(payload.getRoomId(), userId);

        TypingEventView view = new TypingEventView();
        view.setRoomId(payload.getRoomId());
        view.setUserId(user.getId());
        view.setFullName(resolveDisplayName(user));
        view.setAvatarInitial(resolveAvatarInitial(user));
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

        ChatRoomState state = getOrCreateRoomState(room.getId(), user.getId());
        state.setUnreadCount(0);
        state.setLastReadAt(now);
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

        String originalFileName = StringUtils.hasText(file.getOriginalFilename()) ? file.getOriginalFilename() : "attachment";
        String storedFileName = UUID.randomUUID() + "-" + sanitizeFileName(originalFileName);
        Path destination = uploadRoot.resolve(storedFileName).normalize();

        try {
            Files.createDirectories(uploadRoot);
            Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException exception) {
            throw new IllegalStateException("We could not store the uploaded file right now");
        }

        FileUploadResponse response = new FileUploadResponse();
        response.setUrl("/uploads/chat/" + storedFileName);
        response.setFileName(originalFileName);
        response.setContentType(file.getContentType());
        response.setSize(file.getSize());
        return response;
    }

    public PresenceView markUserOnline(String userId) {
        return upsertPresence(userId, PresenceStatus.ONLINE);
    }

    public PresenceView markUserOffline(String userId) {
        return upsertPresence(userId, PresenceStatus.OFFLINE);
    }

    public PresenceView updatePresence(String userId, PresenceStatus status) {
        if (status == null) {
            throw new IllegalArgumentException("Presence status is required");
        }
        return upsertPresence(userId, status);
    }

    public List<PresenceView> getOnlineUsers() {
        return userPresenceRepository.findByStatusIn(List.of(PresenceStatus.ONLINE, PresenceStatus.AWAY))
                .stream()
                .map(this::toPresenceView)
                .toList();
    }

    public ChatMessageView toggleReaction(User currentUser, String messageId, String emoji) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new NoSuchElementException("Message not found"));
        
        Map<String, List<String>> reactions = message.getReactions();
        if (reactions == null) reactions = new HashMap<>();
        
        List<String> users = reactions.getOrDefault(emoji, new ArrayList<>());
        if (users.contains(currentUser.getId())) {
            users.remove(currentUser.getId());
        } else {
            users.add(currentUser.getId());
        }
        
        if (users.isEmpty()) {
            reactions.remove(emoji);
        } else {
            reactions.put(emoji, users);
        }
        
        message.setReactions(reactions);
        return toMessageView(chatMessageRepository.save(message));
    }

    public void deleteMessage(User currentUser, String messageId) {
        User user = requireCurrentUser(currentUser);
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new NoSuchElementException("Message not found"));
        
        if (!message.getSenderId().equals(user.getId())) {
            throw new IllegalArgumentException("You can only delete your own messages");
        }
        
        chatMessageRepository.delete(message);
    }
    
    public void deleteRoom(User currentUser, String roomId) {
        User user = requireCurrentUser(currentUser);
        ChatRoom room = getAccessibleRoom(roomId, user.getId());
        
        // Remove current user from participants
        List<String> participants = new ArrayList<>(room.getParticipantIds());
        participants.remove(user.getId());
        
        if (participants.isEmpty()) {
            chatRoomRepository.delete(room);
            // Delete all messages in the room
            chatMessageRepository.deleteAll(chatMessageRepository.findByRoomIdOrderByTimestampDesc(roomId, PageRequest.of(0, 1000)).getContent());
        } else {
            room.setParticipantIds(participants);
            chatRoomRepository.save(room);
        }
        
        // Clean up the user's view state
        chatRoomStateRepository.findByRoomIdAndUserId(roomId, user.getId())
                .ifPresent(chatRoomStateRepository::delete);
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

    private PresenceView upsertPresence(String userId, PresenceStatus status) {
        User user = getRequiredUser(userId);
        UserPresence presence = userPresenceRepository.findByUserId(userId).orElseGet(UserPresence::new);
        presence.setUserId(userId);
        presence.setStatus(status);
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
        message.setRoomId(room.getId());
        message.setTimestamp(now);
        message.setMessageType(messageType);
        message.setRead(true);
        chatMessageRepository.save(message);
        room.setLastMessage(buildPreview(message));
        room.setLastMessageTime(now);
        chatRoomRepository.save(room);
    }

    private ChatRoomState getOrCreateRoomState(String roomId, String userId) {
        return chatRoomStateRepository.findByRoomIdAndUserId(roomId, userId).orElseGet(() -> {
            ChatRoomState state = new ChatRoomState();
            state.setRoomId(roomId);
            state.setUserId(userId);
            state.setUnreadCount(0);
            state.setLastReadAt(LocalDateTime.now());
            return chatRoomStateRepository.save(state);
        });
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
        view.setCreatedAt(formatDateTime(room.getCreatedAt()));
        view.setName(resolveRoomName(room, currentUserId, participantsById));
        view.setLastMessage(room.getLastMessage());
        view.setLastMessageTime(formatDateTime(room.getLastMessageTime()));
        view.setRequestId(room.getRequestId());
        view.setRequestTitle(room.getRequestTitle());
        chatMessageRepository.findFirstByRoomIdOrderByTimestampDesc(room.getId()).map(ChatMessage::getId).ifPresent(view::setLastMessageId);
        return view;
    }

    private ChatParticipantView toParticipantView(User user) {
        UserPresence presence = userPresenceRepository.findByUserId(user.getId()).orElse(null);
        ChatParticipantView view = new ChatParticipantView();
        view.setUserId(user.getId());
        view.setFullName(resolveDisplayName(user));
        view.setEmail(user.getEmail());
        view.setAvatarInitial(resolveAvatarInitial(user));
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
        view.setStatus(presence.getStatus());
        view.setLastSeen(formatDateTime(presence.getLastSeen()));
        return view;
    }

    private ChatMessageView toMessageView(ChatMessage message) {
        ChatMessageView view = new ChatMessageView();
        view.setId(message.getId());
        view.setSenderId(message.getSenderId());
        view.setSenderName(message.getSenderName());
        view.setAvatarInitial(message.getAvatarInitial());
        view.setContent(message.getContent());
        view.setRoomId(message.getRoomId());
        view.setTimestamp(formatDateTime(message.getTimestamp()));
        view.setMessageType(message.getMessageType());
        view.setRead(message.isRead());
        view.setReplyToMessageId(message.getReplyToMessageId());
        view.setReactions(message.getReactions());
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
        return "HVHN Member";
    }

    private String resolveAvatarInitial(User user) {
        return resolveDisplayName(user).substring(0, 1).toUpperCase(Locale.ROOT);
    }

    private String buildPreview(ChatMessage message) {
        String content = message.getContent() == null ? "" : message.getContent().trim();
        if (message.getMessageType() == ChatMessageType.TYPING) {
            return message.getSenderName() + " is typing...";
        }
        if (content.length() <= MAX_PREVIEW_LENGTH) {
            return content;
        }
        return content.substring(0, MAX_PREVIEW_LENGTH - 1) + "...";
    }

    private String sanitizeFileName(String fileName) {
        String normalized = fileName.replace("\\", "-").replace("/", "-").trim();
        String sanitized = normalized.replaceAll("[^A-Za-z0-9._-]", "-");
        return sanitized.isBlank() ? "attachment" : sanitized;
    }

    private String formatDateTime(LocalDateTime value) {
        return value == null ? null : TIMESTAMP_FORMATTER.format(value);
    }
}
