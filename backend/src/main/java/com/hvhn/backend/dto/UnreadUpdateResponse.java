package com.hvhn.backend.dto;

public class UnreadUpdateResponse {
    private String roomId;
    private int unreadCount;

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public int getUnreadCount() { return unreadCount; }
    public void setUnreadCount(int unreadCount) { this.unreadCount = unreadCount; }
}
