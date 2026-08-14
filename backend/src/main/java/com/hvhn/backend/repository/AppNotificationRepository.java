package com.hvhn.backend.repository;

import com.hvhn.backend.model.AppNotification;
import com.hvhn.backend.model.enums.NotificationCategory;
import com.hvhn.backend.model.enums.NotificationType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AppNotificationRepository extends MongoRepository<AppNotification, String> {
    Page<AppNotification> findByRecipientUserIdAndDeletedForUserFalseOrderByCreatedAtDesc(String recipientUserId, Pageable pageable);
    Page<AppNotification> findByRecipientUserIdAndDeletedForUserFalseAndReadOrderByCreatedAtDesc(String recipientUserId, boolean read, Pageable pageable);
    Page<AppNotification> findByRecipientUserIdAndDeletedForUserFalseAndCategoryOrderByCreatedAtDesc(String recipientUserId, NotificationCategory category, Pageable pageable);
    Page<AppNotification> findByRecipientUserIdAndDeletedForUserFalseAndTypeOrderByCreatedAtDesc(String recipientUserId, NotificationType type, Pageable pageable);
    Optional<AppNotification> findByRecipientUserIdAndDeduplicationKey(String recipientUserId, String deduplicationKey);
    Optional<AppNotification> findByIdAndRecipientUserIdAndDeletedForUserFalse(String id, String recipientUserId);
    long countByRecipientUserIdAndReadFalseAndDeletedForUserFalse(String recipientUserId);
    List<AppNotification> findByRecipientUserIdAndReadFalseAndDeletedForUserFalse(String recipientUserId);
    List<AppNotification> findByRecipientUserIdAndCreatedAtAfter(String recipientUserId, LocalDateTime createdAt);
}
