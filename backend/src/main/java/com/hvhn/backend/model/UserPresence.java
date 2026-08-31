package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.PresenceStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "user_presence")
public class UserPresence {
    @Id
    private String id;

    @Indexed(unique = true)
    private String userId;

    private PresenceStatus status = PresenceStatus.OFFLINE;
    private LocalDateTime lastSeen;
    private int activeSessionCount;
    private LocalDateTime updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public PresenceStatus getStatus() { return status; }
    public void setStatus(PresenceStatus status) { this.status = status; }

    public LocalDateTime getLastSeen() { return lastSeen; }
    public void setLastSeen(LocalDateTime lastSeen) { this.lastSeen = lastSeen; }

    public int getActiveSessionCount() { return activeSessionCount; }
    public void setActiveSessionCount(int activeSessionCount) { this.activeSessionCount = activeSessionCount; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
