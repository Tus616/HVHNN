package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.NotificationDeliveryChannel;
import com.hvhn.backend.model.enums.NotificationDeliveryStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "notification_delivery_attempts")
@CompoundIndexes({
        @CompoundIndex(name = "idx_attempt_notification_channel", def = "{'notificationId': 1, 'channel': 1}"),
        @CompoundIndex(name = "idx_attempt_status_next", def = "{'status': 1, 'nextAttemptAt': 1}"),
        @CompoundIndex(name = "idx_attempt_device_status", def = "{'deviceTokenId': 1, 'status': 1}")
})
public class NotificationDeliveryAttempt {
    @Id
    private String id;
    private String notificationId;
    private String userId;
    private NotificationDeliveryChannel channel;
    private String deviceTokenId;
    private NotificationDeliveryStatus status = NotificationDeliveryStatus.PENDING;
    private String providerMessageId;
    private int attemptNumber;
    private LocalDateTime attemptedAt;
    private LocalDateTime nextAttemptAt;
    private LocalDateTime deliveredAt;
    private LocalDateTime failedAt;
    private String errorCode;
    private boolean retryable;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getNotificationId() { return notificationId; }
    public void setNotificationId(String notificationId) { this.notificationId = notificationId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public NotificationDeliveryChannel getChannel() { return channel; }
    public void setChannel(NotificationDeliveryChannel channel) { this.channel = channel; }
    public String getDeviceTokenId() { return deviceTokenId; }
    public void setDeviceTokenId(String deviceTokenId) { this.deviceTokenId = deviceTokenId; }
    public NotificationDeliveryStatus getStatus() { return status; }
    public void setStatus(NotificationDeliveryStatus status) { this.status = status; }
    public String getProviderMessageId() { return providerMessageId; }
    public void setProviderMessageId(String providerMessageId) { this.providerMessageId = providerMessageId; }
    public int getAttemptNumber() { return attemptNumber; }
    public void setAttemptNumber(int attemptNumber) { this.attemptNumber = attemptNumber; }
    public LocalDateTime getAttemptedAt() { return attemptedAt; }
    public void setAttemptedAt(LocalDateTime attemptedAt) { this.attemptedAt = attemptedAt; }
    public LocalDateTime getNextAttemptAt() { return nextAttemptAt; }
    public void setNextAttemptAt(LocalDateTime nextAttemptAt) { this.nextAttemptAt = nextAttemptAt; }
    public LocalDateTime getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(LocalDateTime deliveredAt) { this.deliveredAt = deliveredAt; }
    public LocalDateTime getFailedAt() { return failedAt; }
    public void setFailedAt(LocalDateTime failedAt) { this.failedAt = failedAt; }
    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String errorCode) { this.errorCode = errorCode; }
    public boolean isRetryable() { return retryable; }
    public void setRetryable(boolean retryable) { this.retryable = retryable; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
