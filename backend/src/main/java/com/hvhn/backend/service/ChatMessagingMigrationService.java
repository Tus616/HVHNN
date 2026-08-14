package com.hvhn.backend.service;

import com.hvhn.backend.dto.MessagingMigrationReport;
import com.hvhn.backend.model.ChatRoom;
import com.hvhn.backend.model.ChatRoomState;
import com.hvhn.backend.model.UserPresence;
import com.hvhn.backend.model.enums.ChatRoomType;
import com.hvhn.backend.model.enums.PresenceStatus;
import com.hvhn.backend.repository.ChatRoomRepository;
import com.hvhn.backend.repository.ChatRoomStateRepository;
import com.hvhn.backend.repository.UserPresenceRepository;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class ChatMessagingMigrationService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomStateRepository chatRoomStateRepository;
    private final UserPresenceRepository userPresenceRepository;
    private final MongoTemplate mongoTemplate;

    public ChatMessagingMigrationService(
            ChatRoomRepository chatRoomRepository,
            ChatRoomStateRepository chatRoomStateRepository,
            UserPresenceRepository userPresenceRepository,
            MongoTemplate mongoTemplate
    ) {
        this.chatRoomRepository = chatRoomRepository;
        this.chatRoomStateRepository = chatRoomStateRepository;
        this.userPresenceRepository = userPresenceRepository;
        this.mongoTemplate = mongoTemplate;
    }

    public MessagingMigrationReport migrate(boolean dryRun) {
        assertSafeDatabase();
        MessagingMigrationReport report = new MessagingMigrationReport();
        report.setDryRun(dryRun);

        Map<String, List<ChatRoom>> directRoomsByKey = new HashMap<>();
        List<ChatRoom> rooms = chatRoomRepository.findAll();
        for (ChatRoom room : rooms) {
            report.incrementRoomsScanned();
            if (room.getType() == ChatRoomType.DIRECT) {
                migrateDirectRoomKey(room, directRoomsByKey, dryRun, report);
            }
            migrateRoomStates(room, dryRun, report);
        }
        directRoomsByKey.values().stream()
                .filter(matches -> matches.size() > 1)
                .forEach(matches -> report.incrementDuplicateRoomsReported());
        repairStalePresence(dryRun, report);
        return report;
    }

    private void migrateDirectRoomKey(ChatRoom room, Map<String, List<ChatRoom>> roomsByKey, boolean dryRun, MessagingMigrationReport report) {
        if (room.getParticipantIds() == null || room.getParticipantIds().size() != 2) {
            report.incrementAmbiguousRoomsReported();
            return;
        }
        String key = buildParticipantKey(room.getParticipantIds());
        roomsByKey.computeIfAbsent(key, ignored -> new ArrayList<>()).add(room);
        if (!StringUtils.hasText(room.getParticipantKey())) {
            report.incrementParticipantKeysGenerated();
            if (!dryRun) {
                room.setParticipantKey(key);
                chatRoomRepository.save(room);
            }
        }
    }

    private void migrateRoomStates(ChatRoom room, boolean dryRun, MessagingMigrationReport report) {
        if (room.getParticipantIds() == null) return;
        for (String participantId : room.getParticipantIds()) {
            if (!StringUtils.hasText(participantId)) continue;
            if (chatRoomStateRepository.findByRoomIdAndUserId(room.getId(), participantId).isPresent()) continue;
            report.incrementRoomStatesCreated();
            if (!dryRun) {
                ChatRoomState state = new ChatRoomState();
                state.setRoomId(room.getId());
                state.setUserId(participantId);
                state.setUnreadCount(0);
                state.setLastReadAt(LocalDateTime.now());
                chatRoomStateRepository.save(state);
            }
        }
    }

    private void repairStalePresence(boolean dryRun, MessagingMigrationReport report) {
        LocalDateTime staleBefore = LocalDateTime.now().minusHours(2);
        for (UserPresence presence : userPresenceRepository.findAll()) {
            boolean staleOnline = presence.getStatus() != PresenceStatus.OFFLINE
                    && presence.getActiveSessionCount() <= 0
                    && (presence.getUpdatedAt() == null || presence.getUpdatedAt().isBefore(staleBefore));
            if (!staleOnline) continue;
            report.incrementStalePresenceRepaired();
            if (!dryRun) {
                presence.setStatus(PresenceStatus.OFFLINE);
                presence.setLastSeen(LocalDateTime.now());
                presence.setUpdatedAt(LocalDateTime.now());
                userPresenceRepository.save(presence);
            }
        }
    }

    private String buildParticipantKey(List<String> participantIds) {
        List<String> ids = new ArrayList<>(participantIds);
        ids.sort(String::compareTo);
        return String.join(":", ids);
    }

    private void assertSafeDatabase() {
        String databaseName = mongoTemplate.getDb().getName();
        if (databaseName == null || !databaseName.toLowerCase().contains("test")) {
            throw new IllegalStateException("Messaging migration requires a test database for verification runs");
        }
    }
}
