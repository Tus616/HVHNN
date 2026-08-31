package com.hvhn.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "chat_room_states")
@CompoundIndex(name = "uk_chat_room_user", def = "{'roomId': 1, 'userId': 1}", unique = true)
public class ChatRoomState {
    @Id
    private String id;

    @Indexed
    private String roomId;

    @Indexed
    private String userId;

    private int unreadCount;
    private LocalDateTime lastReadAt;
    private String lastReadMessageId;
    private boolean hidden;
    private boolean deletedForUser;
    private boolean archived;
    private boolean muted;
    private LocalDateTime hiddenAt;
    private LocalDateTime clearedBeforeTimestamp;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public int getUnreadCount() { return unreadCount; }
    public void setUnreadCount(int unreadCount) { this.unreadCount = unreadCount; }

    public LocalDateTime getLastReadAt() { return lastReadAt; }
    public void setLastReadAt(LocalDateTime lastReadAt) { this.lastReadAt = lastReadAt; }

    public String getLastReadMessageId() { return lastReadMessageId; }
    public void setLastReadMessageId(String lastReadMessageId) { this.lastReadMessageId = lastReadMessageId; }

    public boolean isHidden() { return hidden; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }

    public boolean isDeletedForUser() { return deletedForUser; }
    public void setDeletedForUser(boolean deletedForUser) { this.deletedForUser = deletedForUser; }

    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }

    public boolean isMuted() { return muted; }
    public void setMuted(boolean muted) { this.muted = muted; }

    public LocalDateTime getHiddenAt() { return hiddenAt; }
    public void setHiddenAt(LocalDateTime hiddenAt) { this.hiddenAt = hiddenAt; }

    public LocalDateTime getClearedBeforeTimestamp() { return clearedBeforeTimestamp; }
    public void setClearedBeforeTimestamp(LocalDateTime clearedBeforeTimestamp) { this.clearedBeforeTimestamp = clearedBeforeTimestamp; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
