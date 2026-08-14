package com.hvhn.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "notification_preferences")
public class NotificationPreferences {
    @Id
    private String id;
    @Indexed(unique = true)
    private String userId;
    private boolean inAppEnabled = true;
    private boolean pushEnabled = false;
    private boolean emailEnabled = false;
    private boolean requestNotifications = true;
    private boolean communityNotifications = true;
    private boolean qnaNotifications = true;
    private boolean campaignNotifications = true;
    private boolean chatNotifications = true;
    private boolean systemNotifications = true;
    private boolean nearbyRequestNotifications = true;
    private double nearbyRadiusKm = 10.0;
    private boolean quietHoursEnabled = false;
    private String quietHoursStart = "22:00";
    private String quietHoursEnd = "07:00";
    private String timezone = "Asia/Kolkata";
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public boolean isInAppEnabled() { return inAppEnabled; }
    public void setInAppEnabled(boolean inAppEnabled) { this.inAppEnabled = inAppEnabled; }
    public boolean isPushEnabled() { return pushEnabled; }
    public void setPushEnabled(boolean pushEnabled) { this.pushEnabled = pushEnabled; }
    public boolean isEmailEnabled() { return emailEnabled; }
    public void setEmailEnabled(boolean emailEnabled) { this.emailEnabled = emailEnabled; }
    public boolean isRequestNotifications() { return requestNotifications; }
    public void setRequestNotifications(boolean requestNotifications) { this.requestNotifications = requestNotifications; }
    public boolean isCommunityNotifications() { return communityNotifications; }
    public void setCommunityNotifications(boolean communityNotifications) { this.communityNotifications = communityNotifications; }
    public boolean isQnaNotifications() { return qnaNotifications; }
    public void setQnaNotifications(boolean qnaNotifications) { this.qnaNotifications = qnaNotifications; }
    public boolean isCampaignNotifications() { return campaignNotifications; }
    public void setCampaignNotifications(boolean campaignNotifications) { this.campaignNotifications = campaignNotifications; }
    public boolean isChatNotifications() { return chatNotifications; }
    public void setChatNotifications(boolean chatNotifications) { this.chatNotifications = chatNotifications; }
    public boolean isSystemNotifications() { return systemNotifications; }
    public void setSystemNotifications(boolean systemNotifications) { this.systemNotifications = systemNotifications; }
    public boolean isNearbyRequestNotifications() { return nearbyRequestNotifications; }
    public void setNearbyRequestNotifications(boolean nearbyRequestNotifications) { this.nearbyRequestNotifications = nearbyRequestNotifications; }
    public double getNearbyRadiusKm() { return nearbyRadiusKm; }
    public void setNearbyRadiusKm(double nearbyRadiusKm) { this.nearbyRadiusKm = nearbyRadiusKm; }
    public boolean isQuietHoursEnabled() { return quietHoursEnabled; }
    public void setQuietHoursEnabled(boolean quietHoursEnabled) { this.quietHoursEnabled = quietHoursEnabled; }
    public String getQuietHoursStart() { return quietHoursStart; }
    public void setQuietHoursStart(String quietHoursStart) { this.quietHoursStart = quietHoursStart; }
    public String getQuietHoursEnd() { return quietHoursEnd; }
    public void setQuietHoursEnd(String quietHoursEnd) { this.quietHoursEnd = quietHoursEnd; }
    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
