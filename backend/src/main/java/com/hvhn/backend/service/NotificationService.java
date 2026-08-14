package com.hvhn.backend.service;

import com.hvhn.backend.dto.NotificationDtos.*;
import com.hvhn.backend.model.*;
import com.hvhn.backend.model.enums.*;
import com.hvhn.backend.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final DateTimeFormatter TS = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
    private static final int MAX_ATTEMPTS = 3;

    private final AppNotificationRepository notificationRepository;
    private final NotificationPreferencesRepository preferencesRepository;
    private final NotificationDeviceTokenRepository deviceTokenRepository;
    private final NotificationDeliveryAttemptRepository attemptRepository;
    private final NotificationOutboxRepository outboxRepository;
    private final UserRepository userRepository;
    private final FirebaseService firebaseService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String fromAddress;

    public NotificationService(
            AppNotificationRepository notificationRepository,
            NotificationPreferencesRepository preferencesRepository,
            NotificationDeviceTokenRepository deviceTokenRepository,
            NotificationDeliveryAttemptRepository attemptRepository,
            NotificationOutboxRepository outboxRepository,
            UserRepository userRepository,
            FirebaseService firebaseService,
            SimpMessagingTemplate messagingTemplate,
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.from:${spring.mail.username:}}") String fromAddress
    ) {
        this.notificationRepository = notificationRepository;
        this.preferencesRepository = preferencesRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.attemptRepository = attemptRepository;
        this.outboxRepository = outboxRepository;
        this.userRepository = userRepository;
        this.firebaseService = firebaseService;
        this.messagingTemplate = messagingTemplate;
        this.mailSenderProvider = mailSenderProvider;
        this.fromAddress = fromAddress;
    }

    public AppNotification notifyUser(NotificationCommand command) {
        if (command == null || !StringUtils.hasText(command.recipientUserId())) {
            throw new IllegalArgumentException("Notification recipient is required");
        }
        if (Objects.equals(command.recipientUserId(), command.actorUserId())) {
            return null;
        }
        NotificationPreferences preferences = getOrCreatePreferences(command.recipientUserId());
        if (!shouldPersist(preferences, command.type(), command.category())) {
            recordSkipped(null, command.recipientUserId(), NotificationDeliveryChannel.IN_APP, "PREFERENCE_DISABLED", false);
            return null;
        }

        LocalDateTime now = LocalDateTime.now().withNano(0);
        AppNotification notification = new AppNotification();
        notification.setRecipientUserId(command.recipientUserId());
        notification.setActorUserId(command.actorUserId());
        notification.setType(command.type());
        notification.setCategory(command.category());
        notification.setPriority(command.priority() == null ? NotificationPriority.NORMAL : command.priority());
        notification.setTitle(safeText(command.title(), 120));
        notification.setBody(safeText(command.body(), 240));
        notification.setEntityType(command.entityType());
        notification.setEntityId(command.entityId());
        notification.setParentEntityType(command.parentEntityType());
        notification.setParentEntityId(command.parentEntityId());
        notification.setActionUrl(safeActionUrl(command.actionUrl()));
        notification.setDeduplicationKey(command.deduplicationKey());
        notification.setSourceEventId(command.sourceEventId());
        notification.setMetadata(safeMetadata(command.metadata()));
        notification.setCreatedAt(now);
        notification.setUpdatedAt(now);

        AppNotification saved;
        try {
            saved = notificationRepository.save(notification);
        } catch (DuplicateKeyException duplicate) {
            saved = notificationRepository.findByRecipientUserIdAndDeduplicationKey(command.recipientUserId(), command.deduplicationKey())
                    .orElseThrow(() -> duplicate);
        }

        recordAttempt(saved.getId(), saved.getRecipientUserId(), NotificationDeliveryChannel.IN_APP, null, NotificationDeliveryStatus.DELIVERED, null, false);
        deliverRealtime(saved);
        deliverPush(saved, preferences);
        deliverEmail(saved, preferences);
        return saved;
    }

    public void sendNotification(String userId, String type, String message) {
        NotificationType notificationType = parseType(type, NotificationType.SYSTEM_ALERT);
        notifyUser(NotificationCommand.builder()
                .recipientUserId(userId)
                .type(notificationType)
                .category(categoryFor(notificationType))
                .title(titleFor(notificationType))
                .body(message)
                .deduplicationKey(notificationType + ":" + userId + ":" + Integer.toHexString(String.valueOf(message).hashCode()))
                .build());
    }

    public void notifyRequestEvent(NotificationType type, HelpRequest request, User actor, String recipientUserId) {
        if (request == null || !StringUtils.hasText(recipientUserId)) return;
        notifyUser(NotificationCommand.builder()
                .recipientUserId(recipientUserId)
                .actorUserId(actor == null ? null : actor.getId())
                .type(type)
                .category(NotificationCategory.REQUEST)
                .priority(priorityForRequest(type, request))
                .title(titleFor(type))
                .body(bodyForRequest(type, actor))
                .entityType("HELP_REQUEST")
                .entityId(request.getId())
                .actionUrl("/request/" + request.getId())
                .deduplicationKey(type + ":" + request.getId() + ":" + recipientUserId)
                .sourceEventId(type + ":" + request.getId())
                .build());
    }

    public void notifyCommunityAnnouncement(Announcement announcement, Community community, Collection<String> recipients) {
        if (announcement == null || community == null || recipients == null) return;
        for (String recipientId : recipients) {
            notifyUser(NotificationCommand.builder()
                    .recipientUserId(recipientId)
                    .actorUserId(announcement.getAuthorId())
                    .type(NotificationType.COMMUNITY_ANNOUNCEMENT_CREATED)
                    .category(NotificationCategory.COMMUNITY)
                    .priority(NotificationPriority.NORMAL)
                    .title("Community announcement")
                    .body("A community posted a new announcement.")
                    .entityType("ANNOUNCEMENT")
                    .entityId(announcement.getId())
                    .parentEntityType("COMMUNITY")
                    .parentEntityId(community.getId())
                    .actionUrl("/community/" + community.getId())
                    .deduplicationKey("COMMUNITY_ANNOUNCEMENT_CREATED:" + announcement.getId() + ":" + recipientId)
                    .build());
        }
    }

    public void notifyChatMessage(ChatRoom room, ChatMessage message, String recipientUserId, boolean activeConversation) {
        if (room == null || message == null || activeConversation || Objects.equals(message.getSenderId(), recipientUserId)) return;
        notifyUser(NotificationCommand.builder()
                .recipientUserId(recipientUserId)
                .actorUserId(message.getSenderId())
                .type(NotificationType.CHAT_MESSAGE_RECEIVED)
                .category(NotificationCategory.CHAT)
                .priority(NotificationPriority.NORMAL)
                .title("New chat message")
                .body("You have a new private message.")
                .entityType("CHAT_ROOM")
                .entityId(room.getId())
                .actionUrl("/chats")
                .deduplicationKey("CHAT_MESSAGE_RECEIVED:" + message.getId() + ":" + recipientUserId)
                .build());
    }

    public Page<NotificationView> list(User user, int page, int limit, Boolean unreadOnly, NotificationCategory category, NotificationType type) {
        User currentUser = requireUser(user);
        PageRequest pageable = PageRequest.of(Math.max(0, page), Math.max(1, Math.min(limit, 100)));
        Page<AppNotification> notifications;
        if (type != null) {
            notifications = notificationRepository.findByRecipientUserIdAndDeletedForUserFalseAndTypeOrderByCreatedAtDesc(currentUser.getId(), type, pageable);
        } else if (category != null) {
            notifications = notificationRepository.findByRecipientUserIdAndDeletedForUserFalseAndCategoryOrderByCreatedAtDesc(currentUser.getId(), category, pageable);
        } else if (Boolean.TRUE.equals(unreadOnly)) {
            notifications = notificationRepository.findByRecipientUserIdAndDeletedForUserFalseAndReadOrderByCreatedAtDesc(currentUser.getId(), false, pageable);
        } else {
            notifications = notificationRepository.findByRecipientUserIdAndDeletedForUserFalseOrderByCreatedAtDesc(currentUser.getId(), pageable);
        }
        return notifications.map(this::toView);
    }

    public long unreadCount(User user) {
        return notificationRepository.countByRecipientUserIdAndReadFalseAndDeletedForUserFalse(requireUser(user).getId());
    }

    public NotificationView markRead(User user, String notificationId) {
        AppNotification notification = ownedNotification(user, notificationId);
        if (!notification.isRead()) {
            notification.setRead(true);
            notification.setReadAt(LocalDateTime.now().withNano(0));
            notification.setUpdatedAt(notification.getReadAt());
            notification = notificationRepository.save(notification);
            sendCount(notification.getRecipientUserId());
        }
        return toView(notification);
    }

    public NotificationView markUnread(User user, String notificationId) {
        AppNotification notification = ownedNotification(user, notificationId);
        if (notification.isRead()) {
            notification.setRead(false);
            notification.setReadAt(null);
            notification.setUpdatedAt(LocalDateTime.now().withNano(0));
            notification = notificationRepository.save(notification);
            sendCount(notification.getRecipientUserId());
        }
        return toView(notification);
    }

    public MarkAllReadResponse markAllRead(User user, NotificationCategory category) {
        User currentUser = requireUser(user);
        List<AppNotification> unread = notificationRepository.findByRecipientUserIdAndReadFalseAndDeletedForUserFalse(currentUser.getId())
                .stream()
                .filter(notification -> category == null || notification.getCategory() == category)
                .toList();
        LocalDateTime now = LocalDateTime.now().withNano(0);
        unread.forEach(notification -> {
            notification.setRead(true);
            notification.setReadAt(now);
            notification.setUpdatedAt(now);
        });
        notificationRepository.saveAll(unread);
        sendCount(currentUser.getId());
        return new MarkAllReadResponse(unread.size(), unreadCount(currentUser));
    }

    public void delete(User user, String notificationId) {
        AppNotification notification = ownedNotification(user, notificationId);
        attemptRepository.deleteByNotificationId(notification.getId());
        notificationRepository.delete(notification);
        sendCount(notification.getRecipientUserId());
    }

    public void deleteRequestOwnedRecords(String requestId) {
        if (!StringUtils.hasText(requestId)) return;
        List<AppNotification> related = notificationRepository.findAll().stream()
                .filter(notification -> "HELP_REQUEST".equalsIgnoreCase(notification.getEntityType())
                        && requestId.equals(notification.getEntityId()))
                .toList();
        related.forEach(notification -> attemptRepository.deleteByNotificationId(notification.getId()));
        notificationRepository.deleteAll(related);
        outboxRepository.deleteAll(outboxRepository.findAll().stream()
                .filter(event -> String.valueOf(event.getEventId()).contains(requestId)
                        || String.valueOf(event.getCorrelationId()).contains(requestId)
                        || String.valueOf(event.getPayload()).contains(requestId))
                .toList());
    }

    public NotificationPreferences getOrCreatePreferences(String userId) {
        return preferencesRepository.findByUserId(userId).orElseGet(() -> {
            LocalDateTime now = LocalDateTime.now().withNano(0);
            NotificationPreferences preferences = new NotificationPreferences();
            preferences.setUserId(userId);
            preferences.setCreatedAt(now);
            preferences.setUpdatedAt(now);
            return preferencesRepository.save(preferences);
        });
    }

    public NotificationPreferences updatePreferences(User user, PreferencesUpdateRequest request) {
        User currentUser = requireUser(user);
        NotificationPreferences preferences = getOrCreatePreferences(currentUser.getId());
        if (request.inAppEnabled() != null) preferences.setInAppEnabled(request.inAppEnabled());
        if (request.pushEnabled() != null) preferences.setPushEnabled(request.pushEnabled());
        if (request.emailEnabled() != null) preferences.setEmailEnabled(request.emailEnabled());
        if (request.requestNotifications() != null) preferences.setRequestNotifications(request.requestNotifications());
        if (request.communityNotifications() != null) preferences.setCommunityNotifications(request.communityNotifications());
        if (request.qnaNotifications() != null) preferences.setQnaNotifications(request.qnaNotifications());
        if (request.campaignNotifications() != null) preferences.setCampaignNotifications(request.campaignNotifications());
        if (request.chatNotifications() != null) preferences.setChatNotifications(request.chatNotifications());
        if (request.systemNotifications() != null) preferences.setSystemNotifications(true);
        if (request.nearbyRequestNotifications() != null) preferences.setNearbyRequestNotifications(request.nearbyRequestNotifications());
        if (request.nearbyRadiusKm() != null) {
            if (request.nearbyRadiusKm() < 1 || request.nearbyRadiusKm() > 100) throw new IllegalArgumentException("Nearby radius must be 1 to 100 km");
            preferences.setNearbyRadiusKm(request.nearbyRadiusKm());
        }
        if (request.quietHoursEnabled() != null) preferences.setQuietHoursEnabled(request.quietHoursEnabled());
        if (StringUtils.hasText(request.quietHoursStart())) preferences.setQuietHoursStart(validateTime(request.quietHoursStart()));
        if (StringUtils.hasText(request.quietHoursEnd())) preferences.setQuietHoursEnd(validateTime(request.quietHoursEnd()));
        if (StringUtils.hasText(request.timezone())) {
            ZoneId.of(request.timezone());
            preferences.setTimezone(request.timezone());
        }
        preferences.setUpdatedAt(LocalDateTime.now().withNano(0));
        return preferencesRepository.save(preferences);
    }

    public DeviceTokenView registerDevice(User user, DeviceRegistrationRequest request) {
        User currentUser = requireUser(user);
        String token = request == null ? null : request.token();
        if (!StringUtils.hasText(token) || token.length() < 20 || token.length() > 4096) {
            throw new IllegalArgumentException("A valid notification token is required");
        }
        String tokenHash = hashToken(token);
        LocalDateTime now = LocalDateTime.now().withNano(0);
        NotificationDeviceToken device = deviceTokenRepository.findByTokenHash(tokenHash).orElseGet(NotificationDeviceToken::new);
        if (StringUtils.hasText(device.getUserId()) && !currentUser.getId().equals(device.getUserId())) {
            device.setActive(false);
            device.setInvalidatedAt(now);
            device.setInvalidReason("ROTATED_TO_ANOTHER_USER");
        }
        device.setUserId(currentUser.getId());
        device.setTokenHash(tokenHash);
        device.setToken(token);
        device.setPlatform(request.platform() == null ? NotificationDevicePlatform.UNKNOWN : request.platform());
        device.setDeviceId(safeText(request.deviceId(), 120));
        device.setAppVersion(safeText(request.appVersion(), 80));
        device.setActive(true);
        if (device.getCreatedAt() == null) device.setCreatedAt(now);
        device.setUpdatedAt(now);
        device.setLastUsedAt(now);
        return toDeviceView(deviceTokenRepository.save(device));
    }

    public List<DeviceTokenView> listDevices(User user) {
        return deviceTokenRepository.findByUserIdAndActiveTrue(requireUser(user).getId()).stream().map(this::toDeviceView).toList();
    }

    public void deactivateDevice(User user, String deviceId) {
        User currentUser = requireUser(user);
        NotificationDeviceToken device = deviceTokenRepository.findByIdAndUserId(deviceId, currentUser.getId())
                .orElseThrow(() -> new NoSuchElementException("Device token not found"));
        device.setActive(false);
        device.setInvalidatedAt(LocalDateTime.now().withNano(0));
        device.setInvalidReason("USER_REMOVED");
        deviceTokenRepository.save(device);
    }

    public NotificationOutboxEvent enqueueOutbox(String eventId, String eventType, Map<String, Object> payload, String correlationId) {
        return outboxRepository.findByEventId(eventId).orElseGet(() -> {
            NotificationOutboxEvent event = new NotificationOutboxEvent();
            event.setEventId(eventId);
            event.setEventType(eventType);
            event.setPayload(safeMetadata(payload));
            event.setStatus(NotificationOutboxStatus.PENDING);
            event.setNextAttemptAt(LocalDateTime.now().withNano(0));
            event.setCreatedAt(LocalDateTime.now().withNano(0));
            event.setCorrelationId(correlationId);
            return outboxRepository.save(event);
        });
    }

    public int processOutboxNow() {
        List<NotificationOutboxEvent> events = outboxRepository.findTop25ByStatusAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
                NotificationOutboxStatus.PENDING,
                LocalDateTime.now().withNano(0)
        );
        for (NotificationOutboxEvent event : events) {
            event.setStatus(NotificationOutboxStatus.PROCESSED);
            event.setProcessedAt(LocalDateTime.now().withNano(0));
            event.setAttempts(event.getAttempts() + 1);
            outboxRepository.save(event);
        }
        return events.size();
    }

    public MigrationReport migrateLegacy(boolean dryRun) {
        int usersScanned = 0;
        int tokensFound = 0;
        int tokensMigrated = 0;
        int preferencesCreated = 0;
        for (User user : userRepository.findAll()) {
            usersScanned++;
            if (preferencesRepository.findByUserId(user.getId()).isEmpty()) {
                preferencesCreated++;
                if (!dryRun) getOrCreatePreferences(user.getId());
            }
            if (StringUtils.hasText(user.getNotificationToken())) {
                tokensFound++;
                if (!dryRun) {
                    registerDevice(user, new DeviceRegistrationRequest(user.getNotificationToken(), NotificationDevicePlatform.UNKNOWN, "legacy", "legacy"));
                }
                tokensMigrated++;
            }
        }
        return new MigrationReport(usersScanned, tokensFound, tokensMigrated, preferencesCreated, 0, 0, 0, 0);
    }

    public void alertEmergencyContacts(User user, HelpRequest request) {
        if (user.getEmergencyContacts() == null || user.getEmergencyContacts().isEmpty()) {
            log.info("No emergency contacts registered for user: {}", user.getEmail());
            return;
        }
        for (EmergencyContact contact : user.getEmergencyContacts()) {
            sendEmergencyEmail(contact, user, request);
        }
    }

    private void deliverRealtime(AppNotification notification) {
        try {
            messagingTemplate.convertAndSendToUser(notification.getRecipientUserId(), "/queue/notifications", toView(notification));
            sendCount(notification.getRecipientUserId());
            recordAttempt(notification.getId(), notification.getRecipientUserId(), NotificationDeliveryChannel.WEBSOCKET, null, NotificationDeliveryStatus.SENT, null, false);
        } catch (RuntimeException exception) {
            recordAttempt(notification.getId(), notification.getRecipientUserId(), NotificationDeliveryChannel.WEBSOCKET, null, NotificationDeliveryStatus.FAILED, "SOCKET_SEND_FAILED", true);
        }
    }

    private void deliverPush(AppNotification notification, NotificationPreferences preferences) {
        if (!preferences.isPushEnabled() || inQuietHours(preferences) || !externalCategoryEnabled(preferences, notification.getCategory())) {
            recordSkipped(notification.getId(), notification.getRecipientUserId(), NotificationDeliveryChannel.PUSH, "PREFERENCE_OR_QUIET_HOURS", false);
            return;
        }
        for (NotificationDeviceToken device : deviceTokenRepository.findByUserIdAndActiveTrue(notification.getRecipientUserId())) {
            try {
                String providerId = firebaseService.sendNotification(device.getToken(), notification.getTitle(), notification.getBody(), Map.of(
                        "notificationId", notification.getId(),
                        "type", notification.getType().name(),
                        "entityType", nullToEmpty(notification.getEntityType()),
                        "entityId", nullToEmpty(notification.getEntityId()),
                        "actionUrl", nullToEmpty(notification.getActionUrl())
                ));
                device.setFailureCount(0);
                device.setLastSuccessAt(LocalDateTime.now().withNano(0));
                device.setUpdatedAt(device.getLastSuccessAt());
                deviceTokenRepository.save(device);
                recordAttempt(notification.getId(), notification.getRecipientUserId(), NotificationDeliveryChannel.PUSH, device.getId(), NotificationDeliveryStatus.SENT, providerId, false);
            } catch (RuntimeException exception) {
                boolean invalid = exception.getMessage() != null && exception.getMessage().toLowerCase(Locale.ROOT).contains("invalid");
                device.setFailureCount(device.getFailureCount() + 1);
                if (invalid) {
                    device.setActive(false);
                    device.setInvalidatedAt(LocalDateTime.now().withNano(0));
                    device.setInvalidReason("PROVIDER_INVALID");
                }
                device.setUpdatedAt(LocalDateTime.now().withNano(0));
                deviceTokenRepository.save(device);
                recordAttempt(notification.getId(), notification.getRecipientUserId(), NotificationDeliveryChannel.PUSH, device.getId(), invalid ? NotificationDeliveryStatus.DEAD : NotificationDeliveryStatus.FAILED, invalid ? "INVALID_TOKEN" : "PROVIDER_FAILURE", !invalid);
            }
        }
    }

    private void deliverEmail(AppNotification notification, NotificationPreferences preferences) {
        if (!preferences.isEmailEnabled() || inQuietHours(preferences) || !emailEligible(notification.getType())) {
            recordSkipped(notification.getId(), notification.getRecipientUserId(), NotificationDeliveryChannel.EMAIL, "NOT_ELIGIBLE", false);
            return;
        }
        User recipient = userRepository.findById(notification.getRecipientUserId()).orElse(null);
        if (recipient == null || !recipient.isEmailVerified() || !StringUtils.hasText(recipient.getEmail())) {
            recordSkipped(notification.getId(), notification.getRecipientUserId(), NotificationDeliveryChannel.EMAIL, "EMAIL_UNAVAILABLE", false);
            return;
        }
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null || !StringUtils.hasText(fromAddress)) {
            recordAttempt(notification.getId(), notification.getRecipientUserId(), NotificationDeliveryChannel.EMAIL, null, NotificationDeliveryStatus.FAILED, "SMTP_UNAVAILABLE", true);
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(recipient.getEmail());
            message.setSubject(notification.getTitle());
            message.setText(notification.getBody());
            sender.send(message);
            recordAttempt(notification.getId(), notification.getRecipientUserId(), NotificationDeliveryChannel.EMAIL, null, NotificationDeliveryStatus.SENT, null, false);
        } catch (MailException exception) {
            recordAttempt(notification.getId(), notification.getRecipientUserId(), NotificationDeliveryChannel.EMAIL, null, NotificationDeliveryStatus.FAILED, "SMTP_FAILURE", true);
        }
    }

    private void sendCount(String userId) {
        messagingTemplate.convertAndSendToUser(userId, "/queue/notification-count", new UnreadCountResponse(
                notificationRepository.countByRecipientUserIdAndReadFalseAndDeletedForUserFalse(userId)
        ));
    }

    private NotificationDeliveryAttempt recordAttempt(String notificationId, String userId, NotificationDeliveryChannel channel, String deviceTokenId, NotificationDeliveryStatus status, String code, boolean retryable) {
        NotificationDeliveryAttempt attempt = new NotificationDeliveryAttempt();
        LocalDateTime now = LocalDateTime.now().withNano(0);
        attempt.setNotificationId(notificationId);
        attempt.setUserId(userId);
        attempt.setChannel(channel);
        attempt.setDeviceTokenId(deviceTokenId);
        attempt.setStatus(status);
        attempt.setAttemptNumber(1);
        attempt.setAttemptedAt(now);
        attempt.setCreatedAt(now);
        attempt.setUpdatedAt(now);
        attempt.setErrorCode(code);
        attempt.setRetryable(retryable);
        if (retryable) attempt.setNextAttemptAt(now.plusMinutes(5));
        if (status == NotificationDeliveryStatus.SENT || status == NotificationDeliveryStatus.DELIVERED) attempt.setDeliveredAt(now);
        if (status == NotificationDeliveryStatus.FAILED || status == NotificationDeliveryStatus.DEAD) attempt.setFailedAt(now);
        return attemptRepository.save(attempt);
    }

    private void recordSkipped(String notificationId, String userId, NotificationDeliveryChannel channel, String code, boolean retryable) {
        recordAttempt(notificationId, userId, channel, null, NotificationDeliveryStatus.SKIPPED, code, retryable);
    }

    private AppNotification ownedNotification(User user, String id) {
        return notificationRepository.findByIdAndRecipientUserIdAndDeletedForUserFalse(id, requireUser(user).getId())
                .orElseThrow(() -> new NoSuchElementException("Notification not found"));
    }

    private User requireUser(User user) {
        if (user == null || !StringUtils.hasText(user.getId())) throw new IllegalArgumentException("Authentication is required");
        return user;
    }

    private boolean shouldPersist(NotificationPreferences preferences, NotificationType type, NotificationCategory category) {
        if (type == NotificationType.SYSTEM_ALERT || type == NotificationType.SECURITY_ALERT) return true;
        if (!preferences.isInAppEnabled()) return false;
        return externalCategoryEnabled(preferences, category);
    }

    private boolean externalCategoryEnabled(NotificationPreferences preferences, NotificationCategory category) {
        return switch (category) {
            case REQUEST -> preferences.isRequestNotifications();
            case COMMUNITY -> preferences.isCommunityNotifications();
            case QNA -> preferences.isQnaNotifications();
            case CAMPAIGN -> preferences.isCampaignNotifications();
            case CHAT -> preferences.isChatNotifications();
            case SYSTEM -> preferences.isSystemNotifications();
            case SECURITY -> true;
        };
    }

    private boolean emailEligible(NotificationType type) {
        return Set.of(
                NotificationType.REQUEST_ACCEPTED,
                NotificationType.REQUEST_COMPLETION_REQUESTED,
                NotificationType.COMMUNITY_JOIN_APPROVED,
                NotificationType.COMMUNITY_JOIN_REJECTED,
                NotificationType.SECURITY_ALERT,
                NotificationType.SYSTEM_ALERT
        ).contains(type);
    }

    private boolean inQuietHours(NotificationPreferences preferences) {
        if (!preferences.isQuietHoursEnabled()) return false;
        LocalTime now = LocalTime.now(ZoneId.of(preferences.getTimezone()));
        LocalTime start = LocalTime.parse(preferences.getQuietHoursStart());
        LocalTime end = LocalTime.parse(preferences.getQuietHoursEnd());
        return start.isBefore(end) ? !now.isBefore(start) && now.isBefore(end) : !now.isBefore(start) || now.isBefore(end);
    }

    private NotificationPriority priorityForRequest(NotificationType type, HelpRequest request) {
        if (type == NotificationType.REQUEST_COMPLETION_REQUESTED) return NotificationPriority.HIGH;
        return "CRITICAL".equalsIgnoreCase(request.getUrgency()) ? NotificationPriority.URGENT : NotificationPriority.NORMAL;
    }

    private NotificationCategory categoryFor(NotificationType type) {
        return switch (type) {
            case CHAT_MESSAGE_RECEIVED, CHAT_REACTION_ADDED -> NotificationCategory.CHAT;
            case COMMUNITY_JOIN_APPROVED, COMMUNITY_JOIN_REJECTED, COMMUNITY_ROLE_CHANGED, COMMUNITY_MEMBER_REMOVED, COMMUNITY_ANNOUNCEMENT_CREATED -> NotificationCategory.COMMUNITY;
            case QUESTION_ANSWERED, QUESTION_ANSWER_ACCEPTED, QUESTION_UPVOTED, ANSWER_UPVOTED -> NotificationCategory.QNA;
            case CAMPAIGN_CREATED, CAMPAIGN_CONTRIBUTION_ADDED, CAMPAIGN_STATUS_CHANGED -> NotificationCategory.CAMPAIGN;
            case SECURITY_ALERT -> NotificationCategory.SECURITY;
            case SYSTEM_ALERT -> NotificationCategory.SYSTEM;
            default -> NotificationCategory.REQUEST;
        };
    }

    private String titleFor(NotificationType type) {
        return switch (type) {
            case REQUEST_ACCEPTED -> "Request accepted";
            case REQUEST_PROGRESS_UPDATED -> "Request update";
            case REQUEST_COMPLETION_REQUESTED -> "Completion requested";
            case REQUEST_COMPLETION_CONFIRMED -> "Completion confirmed";
            case REQUEST_COMPLETION_REJECTED -> "Completion rejected";
            case REQUEST_CANCELLED -> "Request cancelled";
            case REQUEST_COMMENT_ADDED -> "New request comment";
            case CHAT_MESSAGE_RECEIVED -> "New chat message";
            case SECURITY_ALERT -> "Security alert";
            default -> "Sahay notification";
        };
    }

    private String bodyForRequest(NotificationType type, User actor) {
        String actorName = actor == null || !StringUtils.hasText(actor.getFullName()) ? "Someone" : actor.getFullName();
        return switch (type) {
            case REQUEST_ACCEPTED -> actorName + " accepted your help request.";
            case REQUEST_PROGRESS_UPDATED -> actorName + " updated your help request.";
            case REQUEST_COMPLETION_REQUESTED -> actorName + " requested completion confirmation.";
            case REQUEST_COMPLETION_CONFIRMED -> "Your completed help was confirmed.";
            case REQUEST_COMPLETION_REJECTED -> "Completion was rejected; the request is active again.";
            case REQUEST_CANCELLED -> "A help request was cancelled.";
            case REQUEST_COMMENT_ADDED -> "A new comment was added to a help request.";
            default -> "A help request has an update.";
        };
    }

    private NotificationType parseType(String value, NotificationType fallback) {
        try {
            return NotificationType.valueOf(String.valueOf(value).trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException exception) {
            return fallback;
        }
    }

    private NotificationView toView(AppNotification notification) {
        return new NotificationView(
                notification.getId(),
                notification.getType(),
                notification.getCategory(),
                notification.getTitle(),
                notification.getBody(),
                notification.getActorUserId(),
                notification.getEntityType(),
                notification.getEntityId(),
                notification.getParentEntityType(),
                notification.getParentEntityId(),
                notification.getActionUrl(),
                notification.getPriority(),
                notification.isRead(),
                format(notification.getReadAt()),
                format(notification.getCreatedAt()),
                notification.getDeliverySummary()
        );
    }

    private DeviceTokenView toDeviceView(NotificationDeviceToken device) {
        return new DeviceTokenView(device.getId(), device.getPlatform(), device.getDeviceId(), device.getAppVersion(), device.isActive(),
                format(device.getCreatedAt()), format(device.getUpdatedAt()), format(device.getLastSuccessAt()), device.getFailureCount());
    }

    private void sendEmergencyEmail(EmergencyContact contact, User user, HelpRequest request) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("Emergency email delivery is not configured because JavaMailSender is unavailable.");
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(contact.getEmail());
        message.setSubject("URGENT: Emergency SOS Alert from " + user.getFullName());
        message.setText("Sahay emergency alert. Open Sahay for protected details.");
        try {
            mailSender.send(message);
        } catch (MailException exception) {
            log.error("Failed to send emergency email to {}", contact.getEmail(), exception);
        }
    }

    private String hashToken(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : digest) builder.append(String.format("%02x", b));
            return builder.toString();
        } catch (Exception exception) {
            throw new IllegalStateException("Could not hash token", exception);
        }
    }

    private Map<String, Object> safeMetadata(Map<String, Object> metadata) {
        if (metadata == null) return Map.of();
        Map<String, Object> safe = new LinkedHashMap<>();
        metadata.forEach((key, value) -> {
            String normalizedKey = String.valueOf(key).toLowerCase(Locale.ROOT);
            if (!normalizedKey.contains("token") && !normalizedKey.contains("password") && !normalizedKey.contains("otp")) {
                safe.put(String.valueOf(key), value);
            }
        });
        return safe;
    }

    private String safeText(String value, int max) {
        if (!StringUtils.hasText(value)) return "";
        String safe = value.replaceAll("[\\r\\n\\t]+", " ").trim();
        return safe.length() <= max ? safe : safe.substring(0, max - 1);
    }

    private String safeActionUrl(String value) {
        if (!StringUtils.hasText(value)) return null;
        String trimmed = value.trim();
        if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.toLowerCase(Locale.ROOT).startsWith("javascript:")) {
            return null;
        }
        return trimmed.length() > 240 ? trimmed.substring(0, 239) : trimmed;
    }

    private String validateTime(String value) {
        LocalTime.parse(value);
        return value;
    }

    private String format(LocalDateTime value) {
        return value == null ? null : TS.format(value);
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    public record NotificationCommand(
            String recipientUserId,
            String actorUserId,
            NotificationType type,
            NotificationCategory category,
            NotificationPriority priority,
            String title,
            String body,
            String entityType,
            String entityId,
            String parentEntityType,
            String parentEntityId,
            String actionUrl,
            String deduplicationKey,
            String sourceEventId,
            Map<String, Object> metadata
    ) {
        public static Builder builder() { return new Builder(); }
        public static class Builder {
            private String recipientUserId;
            private String actorUserId;
            private NotificationType type = NotificationType.SYSTEM_ALERT;
            private NotificationCategory category = NotificationCategory.SYSTEM;
            private NotificationPriority priority = NotificationPriority.NORMAL;
            private String title = "Sahay notification";
            private String body = "You have a new update.";
            private String entityType;
            private String entityId;
            private String parentEntityType;
            private String parentEntityId;
            private String actionUrl;
            private String deduplicationKey;
            private String sourceEventId = UUID.randomUUID().toString();
            private Map<String, Object> metadata = Map.of();
            public Builder recipientUserId(String v) { recipientUserId = v; return this; }
            public Builder actorUserId(String v) { actorUserId = v; return this; }
            public Builder type(NotificationType v) { type = v; return this; }
            public Builder category(NotificationCategory v) { category = v; return this; }
            public Builder priority(NotificationPriority v) { priority = v; return this; }
            public Builder title(String v) { title = v; return this; }
            public Builder body(String v) { body = v; return this; }
            public Builder entityType(String v) { entityType = v; return this; }
            public Builder entityId(String v) { entityId = v; return this; }
            public Builder parentEntityType(String v) { parentEntityType = v; return this; }
            public Builder parentEntityId(String v) { parentEntityId = v; return this; }
            public Builder actionUrl(String v) { actionUrl = v; return this; }
            public Builder deduplicationKey(String v) { deduplicationKey = v; return this; }
            public Builder sourceEventId(String v) { sourceEventId = v; return this; }
            public Builder metadata(Map<String, Object> v) { metadata = v; return this; }
            public NotificationCommand build() {
                String key = StringUtils.hasText(deduplicationKey)
                        ? deduplicationKey
                        : type + ":" + recipientUserId + ":" + nullToEmptyStatic(entityId) + ":" + sourceEventId;
                return new NotificationCommand(recipientUserId, actorUserId, type, category, priority, title, body,
                        entityType, entityId, parentEntityType, parentEntityId, actionUrl, key, sourceEventId, metadata);
            }
            private static String nullToEmptyStatic(String value) { return value == null ? "" : value; }
        }
    }

    public record MigrationReport(int usersScanned, int legacyTokensFound, int deviceTokensMigrated,
                                  int defaultPreferencesCreated, int notificationsNormalized,
                                  int unsupportedRecords, int invalidTokens, int skipped) {}
}
