package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.NotificationDevicePlatform;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "notification_device_tokens")
@CompoundIndexes({
        @CompoundIndex(name = "idx_device_user_active", def = "{'userId': 1, 'active': 1}"),
        @CompoundIndex(name = "idx_device_user_platform", def = "{'userId': 1, 'platform': 1}"),
        @CompoundIndex(name = "idx_device_updated", def = "{'updatedAt': -1}")
})
public class NotificationDeviceToken {
    @Id
    private String id;
    private String userId;
    @Indexed(unique = true)
    private String tokenHash;
    private String token;
    private NotificationDevicePlatform platform = NotificationDevicePlatform.UNKNOWN;
    private String deviceId;
    private String appVersion;
    private boolean active = true;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private LocalDateTime lastUsedAt;
    private LocalDateTime lastSuccessAt;
    private int failureCount;
    private LocalDateTime invalidatedAt;
    private String invalidReason;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public NotificationDevicePlatform getPlatform() { return platform; }
    public void setPlatform(NotificationDevicePlatform platform) { this.platform = platform; }
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public String getAppVersion() { return appVersion; }
    public void setAppVersion(String appVersion) { this.appVersion = appVersion; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(LocalDateTime lastUsedAt) { this.lastUsedAt = lastUsedAt; }
    public LocalDateTime getLastSuccessAt() { return lastSuccessAt; }
    public void setLastSuccessAt(LocalDateTime lastSuccessAt) { this.lastSuccessAt = lastSuccessAt; }
    public int getFailureCount() { return failureCount; }
    public void setFailureCount(int failureCount) { this.failureCount = failureCount; }
    public LocalDateTime getInvalidatedAt() { return invalidatedAt; }
    public void setInvalidatedAt(LocalDateTime invalidatedAt) { this.invalidatedAt = invalidatedAt; }
    public String getInvalidReason() { return invalidReason; }
    public void setInvalidReason(String invalidReason) { this.invalidReason = invalidReason; }
}
