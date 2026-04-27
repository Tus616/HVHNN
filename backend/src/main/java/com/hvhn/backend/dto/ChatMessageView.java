package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.ChatMessageType;

public class ChatMessageView {
    private String id;
    private String senderId;
    private String senderName;
    private String avatarInitial;
    private String content;
    private String roomId;
    private String timestamp;
    private ChatMessageType messageType;
    private boolean read;
    private String replyToMessageId;
    private java.util.Map<String, java.util.List<String>> reactions;

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

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    public ChatMessageType getMessageType() { return messageType; }
    public void setMessageType(ChatMessageType messageType) { this.messageType = messageType; }

    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }

    public String getReplyToMessageId() { return replyToMessageId; }
    public void setReplyToMessageId(String replyToMessageId) { this.replyToMessageId = replyToMessageId; }

    public java.util.Map<String, java.util.List<String>> getReactions() { return reactions; }
    public void setReactions(java.util.Map<String, java.util.List<String>> reactions) { this.reactions = reactions; }
}
