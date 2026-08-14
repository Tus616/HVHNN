package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.ChatMessageType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class ChatMessagePayload {
    @NotBlank(message = "Room ID is required")
    private String roomId;

    @NotBlank(message = "Message content is required")
    private String content;

    @NotNull(message = "Message type is required")
    private ChatMessageType messageType = ChatMessageType.CHAT;

    private String clientMessageId;
    private String replyToMessageId;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public ChatMessageType getMessageType() { return messageType; }
    public void setMessageType(ChatMessageType messageType) { this.messageType = messageType; }

    public String getClientMessageId() { return clientMessageId; }
    public void setClientMessageId(String clientMessageId) { this.clientMessageId = clientMessageId; }

    public String getReplyToMessageId() { return replyToMessageId; }
    public void setReplyToMessageId(String replyToMessageId) { this.replyToMessageId = replyToMessageId; }
}
