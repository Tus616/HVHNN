package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.ChatMessageType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Document(collection = "chat_messages")
@CompoundIndex(name = "uk_chat_sender_client_message", def = "{'senderId': 1, 'clientMessageId': 1}", unique = true, sparse = true)
public class ChatMessage {
    @Id
    private String id;

    @Indexed
    private String senderId;

    private String senderName;
    private String avatarInitial;
    private String content;
    @Field(write = Field.Write.NON_NULL)
    private String clientMessageId;

    @Indexed
    private String roomId;

    @Indexed
    private LocalDateTime timestamp;

    private ChatMessageType messageType = ChatMessageType.CHAT;
    private boolean read;
    private boolean deletedForEveryone;
    private LocalDateTime deletedAt;
    
    // Advanced features
    private String replyToMessageId;
    private Map<String, List<String>> reactions = new HashMap<>(); // emoji -> list of userIds

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getAvatarInitial() { return avatarInitial; }
    public void setAvatarInitial(String avatarInitial) { this.avatarInitial = avatarInitial; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getClientMessageId() { return clientMessageId; }
    public void setClientMessageId(String clientMessageId) { this.clientMessageId = clientMessageId; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public ChatMessageType getMessageType() { return messageType; }
    public void setMessageType(ChatMessageType messageType) { this.messageType = messageType; }

    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }

    public boolean isDeletedForEveryone() { return deletedForEveryone; }
    public void setDeletedForEveryone(boolean deletedForEveryone) { this.deletedForEveryone = deletedForEveryone; }

    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }

    public String getReplyToMessageId() { return replyToMessageId; }
    public void setReplyToMessageId(String replyToMessageId) { this.replyToMessageId = replyToMessageId; }

    public Map<String, List<String>> getReactions() { return reactions; }
    public void setReactions(Map<String, List<String>> reactions) { this.reactions = reactions; }
}
