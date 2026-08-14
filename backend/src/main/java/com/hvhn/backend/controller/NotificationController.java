package com.hvhn.backend.controller;

import com.hvhn.backend.dto.NotificationDtos.*;
import com.hvhn.backend.model.NotificationPreferences;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.enums.NotificationCategory;
import com.hvhn.backend.model.enums.NotificationType;
import com.hvhn.backend.service.NotificationService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public ResponseEntity<NotificationListResponse> list(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) Boolean unreadOnly,
            @RequestParam(required = false) NotificationCategory category,
            @RequestParam(required = false) NotificationType type
    ) {
        Page<NotificationView> result = notificationService.list(currentUser, page, limit, unreadOnly, category, type);
        return ResponseEntity.ok(new NotificationListResponse(result.getContent(), page, limit, result.hasNext()));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<UnreadCountResponse> unreadCount(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(new UnreadCountResponse(notificationService.unreadCount(currentUser)));
    }

    @PostMapping("/{notificationId}/read")
    public ResponseEntity<NotificationView> markRead(@AuthenticationPrincipal User currentUser, @PathVariable String notificationId) {
        return ResponseEntity.ok(notificationService.markRead(currentUser, notificationId));
    }

    @PostMapping("/{notificationId}/unread")
    public ResponseEntity<NotificationView> markUnread(@AuthenticationPrincipal User currentUser, @PathVariable String notificationId) {
        return ResponseEntity.ok(notificationService.markUnread(currentUser, notificationId));
    }

    @PostMapping("/read-all")
    public ResponseEntity<MarkAllReadResponse> markAllRead(
            @AuthenticationPrincipal User currentUser,
            @RequestParam(required = false) NotificationCategory category
    ) {
        return ResponseEntity.ok(notificationService.markAllRead(currentUser, category));
    }

    @DeleteMapping("/{notificationId}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User currentUser, @PathVariable String notificationId) {
        notificationService.delete(currentUser, notificationId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/preferences")
    public ResponseEntity<NotificationPreferences> getPreferences(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(notificationService.getOrCreatePreferences(currentUser.getId()));
    }

    @PutMapping("/preferences")
    public ResponseEntity<NotificationPreferences> updatePreferences(
            @AuthenticationPrincipal User currentUser,
            @RequestBody PreferencesUpdateRequest request
    ) {
        return ResponseEntity.ok(notificationService.updatePreferences(currentUser, request));
    }

    @PostMapping("/devices")
    public ResponseEntity<DeviceTokenView> registerDevice(
            @AuthenticationPrincipal User currentUser,
            @RequestBody DeviceRegistrationRequest request
    ) {
        return ResponseEntity.ok(notificationService.registerDevice(currentUser, request));
    }

    @GetMapping("/devices")
    public ResponseEntity<List<DeviceTokenView>> listDevices(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(notificationService.listDevices(currentUser));
    }

    @DeleteMapping("/devices/{deviceId}")
    public ResponseEntity<Void> deleteDevice(@AuthenticationPrincipal User currentUser, @PathVariable String deviceId) {
        notificationService.deactivateDevice(currentUser, deviceId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/migration")
    public ResponseEntity<NotificationService.MigrationReport> migrate(@RequestParam(defaultValue = "true") boolean dryRun) {
        return ResponseEntity.ok(notificationService.migrateLegacy(dryRun));
    }

    @PostMapping("/outbox/process")
    public ResponseEntity<java.util.Map<String, Integer>> processOutbox() {
        return ResponseEntity.ok(java.util.Map.of("processed", notificationService.processOutboxNow()));
    }
}
