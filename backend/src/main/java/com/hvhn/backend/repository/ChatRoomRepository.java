package com.hvhn.backend.repository;

import com.hvhn.backend.model.ChatRoom;
import com.hvhn.backend.model.enums.ChatRoomType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomRepository extends MongoRepository<ChatRoom, String> {
    List<ChatRoom> findByParticipantIdsContainingOrderByLastMessageTimeDesc(String participantId);
    List<ChatRoom> findByTypeAndParticipantIdsContaining(ChatRoomType type, String participantId);
    Optional<ChatRoom> findByTypeAndParticipantKey(ChatRoomType type, String participantKey);
}
