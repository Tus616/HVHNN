package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.ChatRoomType;

import java.util.ArrayList;
import java.util.List;

public class ChatRoomView {
    private String id;
    private String name;
    private ChatRoomType type;
    private List<String> participantIds = new ArrayList<>();
    private List<ChatParticipantView> participants = new ArrayList<>();
    private int unreadCount;
    private boolean hidden;
    private boolean archived;
    private boolean muted;
    private String createdAt;
    private String lastMessageId;
    private String lastMessage;
    private String lastMessageTime;
    private String requestId;
    private String requestTitle;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public ChatRoomType getType() { return type; }
    public void setType(ChatRoomType type) { this.type = type; }

    public List<String> getParticipantIds() { return participantIds; }
    public void setParticipantIds(List<String> participantIds) { this.participantIds = participantIds; }

    public List<ChatParticipantView> getParticipants() { return participants; }
    public void setParticipants(List<ChatParticipantView> participants) { this.participants = participants; }

    public int getUnreadCount() { return unreadCount; }
    public void setUnreadCount(int unreadCount) { this.unreadCount = unreadCount; }

    public boolean isHidden() { return hidden; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }

    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }

    public boolean isMuted() { return muted; }
    public void setMuted(boolean muted) { this.muted = muted; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public String getLastMessageId() { return lastMessageId; }
    public void setLastMessageId(String lastMessageId) { this.lastMessageId = lastMessageId; }

    public String getLastMessage() { return lastMessage; }
    public void setLastMessage(String lastMessage) { this.lastMessage = lastMessage; }

    public String getLastMessageTime() { return lastMessageTime; }
    public void setLastMessageTime(String lastMessageTime) { this.lastMessageTime = lastMessageTime; }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }

    public String getRequestTitle() { return requestTitle; }
    public void setRequestTitle(String requestTitle) { this.requestTitle = requestTitle; }
}
