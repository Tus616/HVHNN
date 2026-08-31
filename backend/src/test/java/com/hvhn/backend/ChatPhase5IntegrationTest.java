package com.hvhn.backend;

import com.hvhn.backend.dto.ChatMessagePayload;
import com.hvhn.backend.dto.ChatMessageView;
import com.hvhn.backend.dto.ChatRoomView;
import com.hvhn.backend.dto.DirectChatRoomRequest;
import com.hvhn.backend.dto.MessagingMigrationReport;
import com.hvhn.backend.model.ChatMessage;
import com.hvhn.backend.model.ChatMessageReceipt;
import com.hvhn.backend.model.ChatRoom;
import com.hvhn.backend.model.ChatRoomState;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.UserPresence;
import com.hvhn.backend.model.enums.ChatMessageType;
import com.hvhn.backend.model.enums.ChatRoomType;
import com.hvhn.backend.model.enums.PresenceStatus;
import com.hvhn.backend.repository.ChatMessageReceiptRepository;
import com.hvhn.backend.repository.ChatMessageRepository;
import com.hvhn.backend.repository.ChatRoomRepository;
import com.hvhn.backend.repository.ChatRoomStateRepository;
import com.hvhn.backend.repository.UserPresenceRepository;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.service.ChatMessagingMigrationService;
import com.hvhn.backend.service.ChatService;
import com.hvhn.backend.service.ChatSessionRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class ChatPhase5IntegrationTest {

    @Autowired ChatService chatService;
    @Autowired ChatMessagingMigrationService migrationService;
    @Autowired ChatSessionRegistry chatSessionRegistry;
    @Autowired UserRepository userRepository;
    @Autowired ChatRoomRepository chatRoomRepository;
    @Autowired ChatMessageRepository chatMessageRepository;
    @Autowired ChatMessageReceiptRepository receiptRepository;
    @Autowired ChatRoomStateRepository roomStateRepository;
    @Autowired UserPresenceRepository presenceRepository;
    @Autowired MongoTemplate mongoTemplate;

    private User userA;
    private User userB;
    private User outsider;

    @BeforeEach
    void resetData() {
        assertSafeTestDatabase();
        receiptRepository.deleteAll();
        chatMessageRepository.deleteAll();
        roomStateRepository.deleteAll();
        chatRoomRepository.deleteAll();
        presenceRepository.deleteAll();
        userRepository.deleteAll();
        userA = saveUser("phase5-a");
        userB = saveUser("phase5-b");
        outsider = saveUser("phase5-outsider");
    }

    @Test
    void concurrentDirectRoomCreationProducesExactlyOneRoomAndReversedParticipantsReturnSameRoom() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(6);
        List<Callable<ChatRoomView>> tasks = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            User requester = i % 2 == 0 ? userA : userB;
            User participant = i % 2 == 0 ? userB : userA;
            tasks.add(() -> chatService.createOrGetDirectRoom(requester, directRequest(participant.getId())));
        }

        List<String> roomIds = executor.invokeAll(tasks).stream().map(future -> {
            try {
                return future.get().getId();
            } catch (Exception exception) {
                throw new AssertionError(exception);
            }
        }).toList();
        executor.shutdownNow();

        assertThat(roomIds).containsOnly(roomIds.get(0));
        assertThat(chatRoomRepository.findAll()).hasSize(1);
        assertThat(chatRoomRepository.findAll().get(0).getParticipantIds()).containsExactlyInAnyOrder(userA.getId(), userB.getId());
        assertThat(chatService.createOrGetDirectRoom(userB, directRequest(userA.getId())).getId()).isEqualTo(roomIds.get(0));
    }

    @Test
    void clientMessageIdRetryCreatesOneMessageAndUnreadIncrementsOnce() {
        ChatRoomView room = directRoom();
        ChatMessagePayload payload = messagePayload(room.getId(), "client-1");

        ChatMessageView first = chatService.handleIncomingMessage(userA.getId(), payload);
        ChatMessageView retry = chatService.handleIncomingMessage(userA.getId(), payload);

        assertThat(retry.getId()).isEqualTo(first.getId());
        assertThat(chatMessageRepository.findByRoomIdOrderByTimestampDesc(room.getId(), PageRequest.of(0, 20)).getContent())
                .filteredOn(message -> message.getMessageType() == ChatMessageType.CHAT)
                .hasSize(1);
        assertThat(roomStateRepository.findByRoomIdAndUserId(room.getId(), userB.getId()).orElseThrow().getUnreadCount()).isEqualTo(1);
    }

    @Test
    void nonParticipantCannotReadSendReactOrGuessIds() {
        ChatRoomView room = directRoom();
        ChatMessageView message = chatService.handleIncomingMessage(userA.getId(), messagePayload(room.getId(), "auth-1"));

        assertThatThrownBy(() -> chatService.getHistory(outsider, room.getId(), 0, 10)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> chatService.handleIncomingMessage(outsider.getId(), messagePayload(room.getId(), "auth-2"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> chatService.toggleReaction(outsider, message.getId(), "+1")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> chatService.getHistory(userA, "guessed-message-or-room-id", 0, 10)).isInstanceOf(RuntimeException.class);
    }

    @Test
    void onlineRecipientGetsDeliveredReceiptOfflineRecipientSyncsDeliveredFromHistoryAndSeenResetsUnread() {
        ChatRoomView room = directRoom();
        chatService.markUserOnline(userB.getId());
        ChatMessageView onlineMessage = chatService.handleIncomingMessage(userA.getId(), messagePayload(room.getId(), "delivered-1"));
        ChatMessageReceipt onlineReceipt = receiptRepository.findByMessageIdAndUserId(onlineMessage.getId(), userB.getId()).orElseThrow();
        assertThat(onlineReceipt.getDeliveredAt()).isNotNull();

        chatService.markSeen(userB, room.getId(), onlineMessage.getId());
        ChatMessageReceipt seenReceipt = receiptRepository.findByMessageIdAndUserId(onlineMessage.getId(), userB.getId()).orElseThrow();
        assertThat(seenReceipt.getSeenAt()).isNotNull();
        assertThat(roomStateRepository.findByRoomIdAndUserId(room.getId(), userB.getId()).orElseThrow().getUnreadCount()).isZero();

        chatService.markUserOffline(userB.getId());
        ChatMessageView offlineMessage = chatService.handleIncomingMessage(userA.getId(), messagePayload(room.getId(), "offline-1"));
        ChatMessageReceipt offlineReceipt = receiptRepository.findByMessageIdAndUserId(offlineMessage.getId(), userB.getId()).orElseThrow();
        assertThat(offlineReceipt.getDeliveredAt()).isNull();

        chatService.getHistory(userB, room.getId(), 0, 50);
        assertThat(receiptRepository.findByMessageIdAndUserId(offlineMessage.getId(), userB.getId()).orElseThrow().getDeliveredAt()).isNotNull();
        chatService.markSeen(userB, room.getId(), offlineMessage.getId());
        assertThat(receiptRepository.findByMessageIdAndUserId(offlineMessage.getId(), userB.getId()).orElseThrow().getSeenAt()).isNotNull();
    }

    @Test
    void hideDoesNotRemoveParticipantsNewMessageRestoresConversationAndSoftDeletePreservesHistory() {
        ChatRoomView room = directRoom();
        ChatMessageView beforeHide = chatService.handleIncomingMessage(userA.getId(), messagePayload(room.getId(), "hide-1"));

        chatService.deleteRoom(userB, room.getId());
        ChatRoom hiddenRoom = chatRoomRepository.findById(room.getId()).orElseThrow();
        assertThat(hiddenRoom.getParticipantIds()).containsExactlyInAnyOrder(userA.getId(), userB.getId());
        assertThat(chatService.getRooms(userB)).isEmpty();

        ChatMessageView restoredMessage = chatService.handleIncomingMessage(userA.getId(), messagePayload(room.getId(), "hide-2"));
        assertThat(chatService.getRooms(userB)).extracting(ChatRoomView::getId).contains(room.getId());
        assertThat(roomStateRepository.findByRoomIdAndUserId(room.getId(), userB.getId()).orElseThrow().isHidden()).isFalse();

        chatService.deleteMessage(userA, restoredMessage.getId());
        assertThat(chatService.getHistory(userB, room.getId(), 0, 20).getMessages()).extracting(ChatMessageView::getId)
                .contains(restoredMessage.getId())
                .doesNotContain(beforeHide.getId());
        assertThat(chatMessageRepository.findById(restoredMessage.getId()).orElseThrow().isDeletedForEveryone()).isTrue();
    }

    @Test
    void reactionsPersistAndRequireMembership() {
        ChatRoomView room = directRoom();
        ChatMessageView message = chatService.handleIncomingMessage(userA.getId(), messagePayload(room.getId(), "react-1"));

        chatService.toggleReaction(userB, message.getId(), "OK");
        assertThat(chatMessageRepository.findById(message.getId()).orElseThrow().getReactions()).containsKey("OK");
        chatService.toggleReaction(userB, message.getId(), "OK");
        assertThat(chatMessageRepository.findById(message.getId()).orElseThrow().getReactions()).doesNotContainKey("OK");
        assertThatThrownBy(() -> chatService.toggleReaction(outsider, message.getId(), "OK")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void multipleSocketSessionsPreservePresenceUntilFinalDisconnect() {
        assertThat(chatSessionRegistry.registerSession("s1", userA.getId())).isTrue();
        chatService.updatePresenceSessionCount(userA.getId(), chatSessionRegistry.getActiveSessionCount(userA.getId()));
        assertThat(chatSessionRegistry.registerSession("s2", userA.getId())).isFalse();
        chatService.updatePresenceSessionCount(userA.getId(), chatSessionRegistry.getActiveSessionCount(userA.getId()));

        UserPresence online = presenceRepository.findByUserId(userA.getId()).orElseThrow();
        assertThat(online.getStatus()).isEqualTo(PresenceStatus.ONLINE);
        assertThat(online.getActiveSessionCount()).isEqualTo(2);

        chatSessionRegistry.unregisterSession("s1");
        chatService.updatePresenceSessionCount(userA.getId(), chatSessionRegistry.getActiveSessionCount(userA.getId()));
        assertThat(presenceRepository.findByUserId(userA.getId()).orElseThrow().getStatus()).isEqualTo(PresenceStatus.ONLINE);
        assertThat(presenceRepository.findByUserId(userA.getId()).orElseThrow().getActiveSessionCount()).isEqualTo(1);

        chatSessionRegistry.unregisterSession("s2");
        chatService.updatePresenceSessionCount(userA.getId(), chatSessionRegistry.getActiveSessionCount(userA.getId()));
        UserPresence offline = presenceRepository.findByUserId(userA.getId()).orElseThrow();
        assertThat(offline.getStatus()).isEqualTo(PresenceStatus.OFFLINE);
        assertThat(offline.getActiveSessionCount()).isZero();
        assertThat(offline.getLastSeen()).isNotNull();
    }

    @Test
    void migrationDryRunDoesNotMutateAndExecutionIsIdempotent() {
        ChatRoom direct = new ChatRoom();
        direct.setType(ChatRoomType.DIRECT);
        direct.setParticipantIds(List.of(userA.getId(), userB.getId()));
        chatRoomRepository.save(direct);

        ChatRoom ambiguous = new ChatRoom();
        ambiguous.setType(ChatRoomType.DIRECT);
        ambiguous.setParticipantIds(List.of(userA.getId(), userB.getId(), outsider.getId()));
        chatRoomRepository.save(ambiguous);

        UserPresence stale = new UserPresence();
        stale.setUserId(userA.getId());
        stale.setStatus(PresenceStatus.ONLINE);
        stale.setActiveSessionCount(0);
        stale.setUpdatedAt(LocalDateTime.now().minusHours(3));
        presenceRepository.save(stale);

        MessagingMigrationReport dryRun = migrationService.migrate(true);
        assertThat(dryRun.getParticipantKeysGenerated()).isEqualTo(1);
        assertThat(dryRun.getAmbiguousRoomsReported()).isEqualTo(1);
        assertThat(chatRoomRepository.findById(direct.getId()).orElseThrow().getParticipantKey()).isNull();

        MessagingMigrationReport firstExecution = migrationService.migrate(false);
        assertThat(firstExecution.getParticipantKeysGenerated()).isEqualTo(1);
        assertThat(firstExecution.getRoomStatesCreated()).isEqualTo(5);
        assertThat(firstExecution.getStalePresenceRepaired()).isEqualTo(1);

        MessagingMigrationReport secondExecution = migrationService.migrate(false);
        assertThat(secondExecution.getParticipantKeysGenerated()).isZero();
        assertThat(secondExecution.getRoomStatesCreated()).isZero();
        assertThat(secondExecution.getStalePresenceRepaired()).isZero();
    }

    private ChatRoomView directRoom() {
        return chatService.createOrGetDirectRoom(userA, directRequest(userB.getId()));
    }

    private DirectChatRoomRequest directRequest(String participantId) {
        DirectChatRoomRequest request = new DirectChatRoomRequest();
        request.setParticipantId(participantId);
        return request;
    }

    private ChatMessagePayload messagePayload(String roomId, String clientMessageId) {
        ChatMessagePayload payload = new ChatMessagePayload();
        payload.setRoomId(roomId);
        payload.setContent("phase5 test message " + clientMessageId);
        payload.setMessageType(ChatMessageType.CHAT);
        payload.setClientMessageId(clientMessageId);
        return payload;
    }

    private User saveUser(String prefix) {
        User user = new User(prefix + "-" + UUID.randomUUID() + "@hvhn.test", "pass", prefix + " User");
        user.setEmailVerified(true);
        return userRepository.save(user);
    }

    private void assertSafeTestDatabase() {
        assertThat(mongoTemplate.getDb().getName().toLowerCase()).contains("test");
    }
}
