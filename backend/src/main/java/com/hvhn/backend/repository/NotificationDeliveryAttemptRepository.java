package com.hvhn.backend.repository;

import com.hvhn.backend.model.NotificationDeliveryAttempt;
import com.hvhn.backend.model.enums.NotificationDeliveryStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface NotificationDeliveryAttemptRepository extends MongoRepository<NotificationDeliveryAttempt, String> {
    List<NotificationDeliveryAttempt> findByNotificationId(String notificationId);
    List<NotificationDeliveryAttempt> findByStatusAndNextAttemptAtLessThanEqual(NotificationDeliveryStatus status, LocalDateTime now);
    void deleteByNotificationId(String notificationId);
}
