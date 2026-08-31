package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.NotificationCategory;
import com.hvhn.backend.model.enums.NotificationDevicePlatform;
import com.hvhn.backend.model.enums.NotificationPriority;
import com.hvhn.backend.model.enums.NotificationType;

import java.util.List;
import java.util.Map;

public class NotificationDtos {
    public record NotificationView(
            String id,
            NotificationType type,
            NotificationCategory category,
            String title,
            String body,
            String actorUserId,
            String entityType,
            String entityId,
            String parentEntityType,
            String parentEntityId,
            String actionUrl,
            NotificationPriority priority,
            boolean read,
            String readAt,
            String createdAt,
            Map<String, Object> deliverySummary
    ) {}

    public record NotificationListResponse(List<NotificationView> notifications, int page, int limit, boolean hasMore) {}
    public record UnreadCountResponse(long unreadCount) {}
    public record MarkAllReadResponse(long affectedCount, long unreadCount) {}
    public record DeviceRegistrationRequest(String token, NotificationDevicePlatform platform, String deviceId, String appVersion) {}
    public record DeviceTokenView(String id, NotificationDevicePlatform platform, String deviceId, String appVersion, boolean active, String createdAt, String updatedAt, String lastSuccessAt, int failureCount) {}
    public record PreferencesUpdateRequest(
            Boolean inAppEnabled,
            Boolean pushEnabled,
            Boolean emailEnabled,
            Boolean requestNotifications,
            Boolean communityNotifications,
            Boolean qnaNotifications,
            Boolean campaignNotifications,
            Boolean chatNotifications,
            Boolean systemNotifications,
            Boolean nearbyRequestNotifications,
            Double nearbyRadiusKm,
            Boolean quietHoursEnabled,
            String quietHoursStart,
            String quietHoursEnd,
            String timezone
    ) {}
}
