package com.hvhn.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hvhn.backend.model.AppNotification;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.enums.NotificationCategory;
import com.hvhn.backend.model.enums.NotificationPriority;
import com.hvhn.backend.model.enums.NotificationType;
import com.hvhn.backend.repository.*;
import com.hvhn.backend.security.JwtUtil;
import com.hvhn.backend.service.FirebaseService;
import com.hvhn.backend.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class NotificationPhase6Test {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JwtUtil jwtUtil;
    @Autowired MongoTemplate mongoTemplate;
    @Autowired UserRepository userRepository;
    @Autowired AppNotificationRepository notificationRepository;
    @Autowired NotificationPreferencesRepository preferencesRepository;
    @Autowired NotificationDeviceTokenRepository deviceTokenRepository;
    @Autowired NotificationDeliveryAttemptRepository attemptRepository;
    @Autowired NotificationOutboxRepository outboxRepository;
    @Autowired NotificationService notificationService;
    @MockBean FirebaseService firebaseService;

    private User userA;
    private User userB;
    private String tokenA;
    private String tokenB;

    @BeforeEach
    void setup() {
        assertThat(mongoTemplate.getDb().getName()).contains("test");
        attemptRepository.deleteAll();
        outboxRepository.deleteAll();
        notificationRepository.deleteAll();
        preferencesRepository.deleteAll();
        deviceTokenRepository.deleteAll();
        userRepository.deleteAll();
        userA = saveUser("phase6-a");
        userB = saveUser("phase6-b");
        tokenA = jwtUtil.generateToken(userA);
        tokenB = jwtUtil.generateToken(userB);
    }

    @Test
    void notificationApiPersistsListsReadUnreadDeletesAndBlocksIdor() throws Exception {
        AppNotification notification = notificationService.notifyUser(command(userA.getId(), userB.getId(), "api-1").build());

        JsonNode list = getJson("/api/notifications", tokenA);
        assertThat(list.get("notifications")).hasSize(1);
        assertThat(list.get("notifications").get(0).get("body").asText()).doesNotContain("secret", "token");
        assertThat(getJson("/api/notifications/unread-count", tokenA).get("unreadCount").asLong()).isEqualTo(1);

        mvc.perform(post("/api/notifications/{id}/read", notification.getId()).header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk());
        assertThat(getJson("/api/notifications/unread-count", tokenA).get("unreadCount").asLong()).isZero();

        mvc.perform(post("/api/notifications/{id}/unread", notification.getId()).header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk());
        assertThat(getJson("/api/notifications/unread-count", tokenA).get("unreadCount").asLong()).isEqualTo(1);

        mvc.perform(post("/api/notifications/{id}/read", notification.getId()).header("Authorization", "Bearer " + tokenB))
                .andExpect(status().is4xxClientError());

        JsonNode allRead = postJson("/api/notifications/read-all", tokenA, null);
        assertThat(allRead.get("affectedCount").asLong()).isEqualTo(1);
        assertThat(allRead.get("unreadCount").asLong()).isZero();

        mvc.perform(delete("/api/notifications/{id}", notification.getId()).header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isNoContent());
        assertThat(getJson("/api/notifications", tokenA).get("notifications")).isEmpty();
    }

    @Test
    void deduplicationPreferencesDevicesPushFailureAndOutboxAreReliable() throws Exception {
        notificationService.notifyUser(command(userA.getId(), userB.getId(), "dedupe").build());
        notificationService.notifyUser(command(userA.getId(), userB.getId(), "dedupe").build());
        assertThat(notificationRepository.findAll()).hasSize(1);

        ExecutorService executor = Executors.newFixedThreadPool(4);
        for (int i = 0; i < 4; i++) {
            executor.submit(() -> notificationService.notifyUser(command(userA.getId(), userB.getId(), "concurrent").build()));
        }
        executor.shutdown();
        assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        assertThat(notificationRepository.findAll()).filteredOn(n -> n.getDeduplicationKey().contains("concurrent")).hasSize(1);

        JsonNode preferences = getJson("/api/notifications/preferences", tokenA);
        assertThat(preferences.get("inAppEnabled").asBoolean()).isTrue();
        putJson("/api/notifications/preferences", tokenA, Map.of("chatNotifications", false, "systemNotifications", false));
        notificationService.notifyUser(command(userA.getId(), userB.getId(), "pref-off")
                .type(NotificationType.CHAT_MESSAGE_RECEIVED)
                .category(NotificationCategory.CHAT)
                .deduplicationKey("pref-off")
                .build());
        assertThat(notificationRepository.findByRecipientUserIdAndDeduplicationKey(userA.getId(), "pref-off")).isEmpty();

        JsonNode device = postJson("/api/notifications/devices", tokenA, Map.of(
                "token", "fcm-test-token-" + UUID.randomUUID() + "-abcdefghijklmnopqrstuvwxyz",
                "platform", "WEB",
                "deviceId", "browser-1",
                "appVersion", "test"
        ));
        assertThat(device.toString()).doesNotContain("fcm-test-token");
        assertThat(getJson("/api/notifications/devices", tokenA)).hasSize(1);
        mvc.perform(delete("/api/notifications/devices/{id}", device.get("id").asText()).header("Authorization", "Bearer " + tokenB))
                .andExpect(status().is4xxClientError());

        Mockito.when(firebaseService.sendNotification(anyString(), anyString(), anyString(), anyMap()))
                .thenThrow(new IllegalStateException("invalid registration token"));
        putJson("/api/notifications/preferences", tokenA, Map.of("pushEnabled", true, "chatNotifications", true));
        notificationService.notifyUser(command(userA.getId(), userB.getId(), "push-invalid")
                .type(NotificationType.CHAT_MESSAGE_RECEIVED)
                .category(NotificationCategory.CHAT)
                .deduplicationKey("push-invalid")
                .build());
        assertThat(deviceTokenRepository.findByUserIdAndActiveTrue(userA.getId())).isEmpty();
        assertThat(attemptRepository.findAll()).anyMatch(a -> "INVALID_TOKEN".equals(a.getErrorCode()));

        notificationService.enqueueOutbox("event-1", "SYSTEM_ALERT", Map.of("safe", "value", "token", "hidden"), "correlation-1");
        notificationService.enqueueOutbox("event-1", "SYSTEM_ALERT", Map.of("safe", "value"), "correlation-1");
        assertThat(outboxRepository.findAll()).hasSize(1);
        assertThat(notificationService.processOutboxNow()).isEqualTo(1);
    }

    private NotificationService.NotificationCommand.Builder command(String recipientId, String actorId, String key) {
        return NotificationService.NotificationCommand.builder()
                .recipientUserId(recipientId)
                .actorUserId(actorId)
                .type(NotificationType.REQUEST_ACCEPTED)
                .category(NotificationCategory.REQUEST)
                .priority(NotificationPriority.NORMAL)
                .title("Safe title")
                .body("Safe body")
                .entityType("HELP_REQUEST")
                .entityId("request-" + key)
                .actionUrl("/request/request-" + key)
                .deduplicationKey("REQUEST_ACCEPTED:request-" + key + ":" + recipientId);
    }

    private JsonNode getJson(String url, String token) throws Exception {
        return objectMapper.readTree(mvc.perform(get(url).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode postJson(String url, String token, Object body) throws Exception {
        var request = post(url).header("Authorization", "Bearer " + token);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body));
        return objectMapper.readTree(mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode putJson(String url, String token, Object body) throws Exception {
        return objectMapper.readTree(mvc.perform(put(url)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private User saveUser(String prefix) {
        User user = new User(prefix + "-" + UUID.randomUUID() + "@hvhn.test", "pass", prefix + " User");
        user.setVerified(true);
        user.setEmailVerified(true);
        user.setOnboardingCompleted(true);
        return userRepository.save(user);
    }
}
