package com.hvhn.backend.repository;

import com.hvhn.backend.model.ChatMessageReceipt;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatMessageReceiptRepository extends MongoRepository<ChatMessageReceipt, String> {
    Optional<ChatMessageReceipt> findByMessageIdAndUserId(String messageId, String userId);
    List<ChatMessageReceipt> findByMessageId(String messageId);
    List<ChatMessageReceipt> findByRoomIdAndUserId(String roomId, String userId);
    List<ChatMessageReceipt> findByMessageIdInAndUserId(List<String> messageIds, String userId);
}
