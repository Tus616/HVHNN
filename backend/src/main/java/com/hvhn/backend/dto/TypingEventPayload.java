package com.hvhn.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class TypingEventPayload {
    @NotBlank(message = "Room ID is required")
    private String roomId;

    private boolean typing;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public boolean isTyping() { return typing; }
    public void setTyping(boolean typing) { this.typing = typing; }
}
