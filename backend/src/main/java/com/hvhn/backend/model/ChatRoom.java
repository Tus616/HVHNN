package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.ChatRoomType;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "chat_rooms")
public class ChatRoom {
    @Id
    private String id;

    private String name;
    private ChatRoomType type = ChatRoomType.DIRECT;

    @Indexed(unique = true, sparse = true)
    private String participantKey;

    @Indexed
    private List<String> participantIds = new ArrayList<>();

    @CreatedDate
    private LocalDateTime createdAt;

    private String lastMessage;
    private LocalDateTime lastMessageTime;
    private String lastMessageId;
    private String lastMessageSenderId;
    private String lastMessagePreview;
    private String status = "ACTIVE";

    @LastModifiedDate
    private LocalDateTime updatedAt;
    
    private String requestId;
    private String requestTitle;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public ChatRoomType getType() { return type; }
    public void setType(ChatRoomType type) { this.type = type; }

    public String getParticipantKey() { return participantKey; }
    public void setParticipantKey(String participantKey) { this.participantKey = participantKey; }

    public List<String> getParticipantIds() { return participantIds; }
    public void setParticipantIds(List<String> participantIds) { this.participantIds = participantIds; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getLastMessage() { return lastMessage; }
    public void setLastMessage(String lastMessage) { this.lastMessage = lastMessage; }

    public LocalDateTime getLastMessageTime() { return lastMessageTime; }
    public void setLastMessageTime(LocalDateTime lastMessageTime) { this.lastMessageTime = lastMessageTime; }

    public String getLastMessageId() { return lastMessageId; }
    public void setLastMessageId(String lastMessageId) { this.lastMessageId = lastMessageId; }

    public String getLastMessageSenderId() { return lastMessageSenderId; }
    public void setLastMessageSenderId(String lastMessageSenderId) { this.lastMessageSenderId = lastMessageSenderId; }

    public String getLastMessagePreview() { return lastMessagePreview; }
    public void setLastMessagePreview(String lastMessagePreview) { this.lastMessagePreview = lastMessagePreview; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }

    public String getRequestTitle() { return requestTitle; }
    public void setRequestTitle(String requestTitle) { this.requestTitle = requestTitle; }
}
