package com.hvhn.backend.repository;

import com.hvhn.backend.model.NotificationOutboxEvent;
import com.hvhn.backend.model.enums.NotificationOutboxStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationOutboxRepository extends MongoRepository<NotificationOutboxEvent, String> {
    Optional<NotificationOutboxEvent> findByEventId(String eventId);
    List<NotificationOutboxEvent> findTop25ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(NotificationOutboxStatus status, LocalDateTime now);
}
