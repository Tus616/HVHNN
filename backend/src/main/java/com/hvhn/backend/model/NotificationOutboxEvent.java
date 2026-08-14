package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.NotificationOutboxStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Document(collection = "notification_outbox")
@CompoundIndexes({
        @CompoundIndex(name = "idx_outbox_status_next", def = "{'status': 1, 'nextAttemptAt': 1}"),
        @CompoundIndex(name = "idx_outbox_created", def = "{'createdAt': 1}")
})
public class NotificationOutboxEvent {
    @Id
    private String id;
    @Indexed(unique = true)
    private String eventId;
    private String eventType;
    private Map<String, Object> payload = new HashMap<>();
    private NotificationOutboxStatus status = NotificationOutboxStatus.PENDING;
    private int attempts;
    private LocalDateTime nextAttemptAt;
    private LocalDateTime createdAt;
    private LocalDateTime processedAt;
    private String lastErrorCode;
    private String correlationId;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public Map<String, Object> getPayload() { return payload; }
    public void setPayload(Map<String, Object> payload) { this.payload = payload == null ? new HashMap<>() : payload; }
    public NotificationOutboxStatus getStatus() { return status; }
    public void setStatus(NotificationOutboxStatus status) { this.status = status; }
    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }
    public LocalDateTime getNextAttemptAt() { return nextAttemptAt; }
    public void setNextAttemptAt(LocalDateTime nextAttemptAt) { this.nextAttemptAt = nextAttemptAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getProcessedAt() { return processedAt; }
    public void setProcessedAt(LocalDateTime processedAt) { this.processedAt = processedAt; }
    public String getLastErrorCode() { return lastErrorCode; }
    public void setLastErrorCode(String lastErrorCode) { this.lastErrorCode = lastErrorCode; }
    public String getCorrelationId() { return correlationId; }
    public void setCorrelationId(String correlationId) { this.correlationId = correlationId; }
}
