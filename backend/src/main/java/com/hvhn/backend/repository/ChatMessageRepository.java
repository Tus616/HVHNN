package com.hvhn.backend.repository;

import com.hvhn.backend.model.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
    Page<ChatMessage> findByRoomIdOrderByTimestampDesc(String roomId, Pageable pageable);
    List<ChatMessage> findByRoomIdAndTimestampLessThanEqualOrderByTimestampAsc(String roomId, LocalDateTime timestamp);
    Optional<ChatMessage> findFirstByRoomIdOrderByTimestampDesc(String roomId);
    Optional<ChatMessage> findBySenderIdAndClientMessageId(String senderId, String clientMessageId);
}
