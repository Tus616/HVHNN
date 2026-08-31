package com.hvhn.backend.repository;

import com.hvhn.backend.model.NotificationDeviceToken;
import com.hvhn.backend.model.enums.NotificationDevicePlatform;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationDeviceTokenRepository extends MongoRepository<NotificationDeviceToken, String> {
    Optional<NotificationDeviceToken> findByTokenHash(String tokenHash);
    Optional<NotificationDeviceToken> findByIdAndUserId(String id, String userId);
    List<NotificationDeviceToken> findByUserIdAndActiveTrue(String userId);
    List<NotificationDeviceToken> findByUserIdAndPlatform(String userId, NotificationDevicePlatform platform);
}
