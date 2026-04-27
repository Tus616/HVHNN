package com.hvhn.backend.repository;

import com.hvhn.backend.model.ChatRoomState;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChatRoomStateRepository extends MongoRepository<ChatRoomState, String> {
    Optional<ChatRoomState> findByRoomIdAndUserId(String roomId, String userId);
    List<ChatRoomState> findByRoomId(String roomId);
    List<ChatRoomState> findByUserId(String userId);
}
