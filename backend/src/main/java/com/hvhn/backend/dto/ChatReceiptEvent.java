package com.hvhn.backend.dto;

public class ChatReceiptEvent extends UnreadUpdateResponse {
    private String messageId;
    private String userId;
    private String type;
    private String deliveredAt;
    private String seenAt;

    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getDeliveredAt() { return deliveredAt; }
    public void setDeliveredAt(String deliveredAt) { this.deliveredAt = deliveredAt; }

    public String getSeenAt() { return seenAt; }
    public void setSeenAt(String seenAt) { this.seenAt = seenAt; }
}
