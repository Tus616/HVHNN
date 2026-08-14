package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.NotificationCategory;
import com.hvhn.backend.model.enums.NotificationPriority;
import com.hvhn.backend.model.enums.NotificationType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Document(collection = "notifications")
@CompoundIndexes({
        @CompoundIndex(name = "idx_notification_recipient_created", def = "{'recipientUserId': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_notification_recipient_read_created", def = "{'recipientUserId': 1, 'read': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "idx_notification_recipient_category_created", def = "{'recipientUserId': 1, 'category': 1, 'createdAt': -1}"),
        @CompoundIndex(name = "uk_notification_dedupe", def = "{'recipientUserId': 1, 'deduplicationKey': 1}", unique = true)
})
public class AppNotification {
    @Id
    private String id;
    @Indexed
    private String recipientUserId;
    private String actorUserId;
    private NotificationType type;
    private NotificationCategory category;
    private String title;
    private String body;
    private String entityType;
    private String entityId;
    private String parentEntityType;
    private String parentEntityId;
    private String actionUrl;
    private NotificationPriority priority = NotificationPriority.NORMAL;
    private boolean read;
    private LocalDateTime readAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    @Indexed(expireAfterSeconds = 0)
    private LocalDateTime expiresAt;
    private String deduplicationKey;
    private String sourceEventId;
    private Map<String, Object> metadata = new HashMap<>();
    private Map<String, Object> deliverySummary = new HashMap<>();
    private boolean deletedForUser;
    private long version = 1;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRecipientUserId() { return recipientUserId; }
    public void setRecipientUserId(String recipientUserId) { this.recipientUserId = recipientUserId; }
    public String getActorUserId() { return actorUserId; }
    public void setActorUserId(String actorUserId) { this.actorUserId = actorUserId; }
    public NotificationType getType() { return type; }
    public void setType(NotificationType type) { this.type = type; }
    public NotificationCategory getCategory() { return category; }
    public void setCategory(NotificationCategory category) { this.category = category; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public String getEntityType() { return entityType; }
    public void setEntityType(String entityType) { this.entityType = entityType; }
    public String getEntityId() { return entityId; }
    public void setEntityId(String entityId) { this.entityId = entityId; }
    public String getParentEntityType() { return parentEntityType; }
    public void setParentEntityType(String parentEntityType) { this.parentEntityType = parentEntityType; }
    public String getParentEntityId() { return parentEntityId; }
    public void setParentEntityId(String parentEntityId) { this.parentEntityId = parentEntityId; }
    public String getActionUrl() { return actionUrl; }
    public void setActionUrl(String actionUrl) { this.actionUrl = actionUrl; }
    public NotificationPriority getPriority() { return priority; }
    public void setPriority(NotificationPriority priority) { this.priority = priority; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    public LocalDateTime getReadAt() { return readAt; }
    public void setReadAt(LocalDateTime readAt) { this.readAt = readAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public String getDeduplicationKey() { return deduplicationKey; }
    public void setDeduplicationKey(String deduplicationKey) { this.deduplicationKey = deduplicationKey; }
    public String getSourceEventId() { return sourceEventId; }
    public void setSourceEventId(String sourceEventId) { this.sourceEventId = sourceEventId; }
    public Map<String, Object> getMetadata() { return metadata; }
    public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata == null ? new HashMap<>() : metadata; }
    public Map<String, Object> getDeliverySummary() { return deliverySummary; }
    public void setDeliverySummary(Map<String, Object> deliverySummary) { this.deliverySummary = deliverySummary == null ? new HashMap<>() : deliverySummary; }
    public boolean isDeletedForUser() { return deletedForUser; }
    public void setDeletedForUser(boolean deletedForUser) { this.deletedForUser = deletedForUser; }
    public long getVersion() { return version; }
    public void setVersion(long version) { this.version = version; }
}
