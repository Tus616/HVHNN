package com.hvhn.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.springframework.web.socket.sockjs.client.SockJsClient;
import org.springframework.web.socket.sockjs.client.Transport;
import org.springframework.web.socket.sockjs.client.WebSocketTransport;

import java.io.IOException;
import java.lang.reflect.Type;
import java.net.ServerSocket;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.function.Predicate;

import static com.mongodb.client.model.Filters.and;
import static com.mongodb.client.model.Filters.eq;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class NotificationExternalStompIntegrationIT {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String TEST_DB = "hvhn_phase6_notifications_stomp_test";
    private static final String MONGO_URI = "mongodb://localhost:27017/" + TEST_DB;
    private static final String PASSWORD = "Phase6-Notifications-Password-1";
    private static final Path JAR = Path.of("target", "backend-phase6-verification.jar");

    @Test
    void verifiesRealAuthenticatedNotificationSocketAndPersistenceAgainstPackagedBackend() throws Exception {
        quietTokenBearingClientTransportLogs();
        assertSafeTestDatabase(TEST_DB);
        assertThat(Files.exists(JAR))
                .as("Build the packaged verification jar first with -Dapp.finalName=backend-phase6-verification")
                .isTrue();

        int port = freePort();
        Path logPath = Path.of("target", "phase6-notification-stomp-backend.log");
        String runId = "phase6-" + UUID.randomUUID();

        try (MongoClient mongoClient = MongoClients.create(MONGO_URI)) {
            MongoDatabase db = mongoClient.getDatabase(TEST_DB);
            cleanup(db);
            seedUsers(db, runId);

            Process backend = startBackend(port, logPath);
            try {
                HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
                String baseUrl = "http://localhost:" + port;
                assertHealthReady(http, baseUrl);

                UserToken requester = login(http, baseUrl, runId + "-requester@hvhn.test");
                UserToken volunteer = login(http, baseUrl, runId + "-volunteer@hvhn.test");

                StompClientSession requesterSocket = connect(baseUrl, requester.token());
                try {
                    assertThatThrownBy(() -> connect(baseUrl, "invalid-" + UUID.randomUUID()))
                            .as("invalid JWT handshake")
                            .isInstanceOf(Exception.class);

                    EventProbe notifications = requesterSocket.subscribe("/user/queue/notifications");
                    EventProbe counts = requesterSocket.subscribe("/user/queue/notification-count");

                    JsonNode request = postJson(http, baseUrl + "/api/requests", requester.token(), requestBody());
                    String requestId = request.get("id").asText();
                    postJson(http, baseUrl + "/api/notifications/read-all", requester.token(), null);
                    postJson(http, baseUrl + "/api/requests/" + requestId + "/accept", volunteer.token(), null);

                    Map<String, Object> accepted = notifications.await(event ->
                            "REQUEST_ACCEPTED".equals(event.get("type"))
                                    && "REQUEST".equals(event.get("category"))
                                    && requestId.equals(event.get("entityId")));
                    String notificationId = stringValue(accepted.get("id"));
                    assertThat(notificationId).isNotBlank();
                    counts.await(event -> numberValue(event.get("unreadCount")) == 1);
                    assertNotificationDocument(db, notificationId, requester.userId(), requestId, false);

                    postJson(http, baseUrl + "/api/notifications/" + notificationId + "/read", requester.token(), null);
                    assertThat(getJson(http, baseUrl + "/api/notifications/unread-count", requester.token())
                            .get("unreadCount").asInt()).isZero();
                    assertNotificationDocument(db, notificationId, requester.userId(), requestId, true);

                    assertStatus(http, "POST", baseUrl + "/api/notifications/" + notificationId + "/read", volunteer.token(), null, 404);
                } finally {
                    requesterSocket.disconnect();
                }

                postJson(http, baseUrl + "/api/requests/" + latestRequestId(db, requester.userId()) + "/progress",
                        volunteer.token(), Map.of("action", "ON_THE_WAY"));
                JsonNode persisted = getJson(http, baseUrl + "/api/notifications", requester.token());
                assertThat(persisted.toString()).contains("REQUEST_PROGRESS_UPDATED");

                assertThat(Files.readString(logPath)).doesNotContain(requester.token(), volunteer.token());
            } finally {
                backend.destroy();
                if (!backend.waitFor(10, java.util.concurrent.TimeUnit.SECONDS)) {
                    backend.destroyForcibly();
                }
                cleanup(db);
            }
        }
    }

    private static Map<String, Object> requestBody() {
        return Map.of(
                "title", "Phase 6 runtime groceries",
                "description", "Need help carrying groceries from the gate to the lobby.",
                "category", "GENERAL",
                "urgency", "MEDIUM",
                "latitude", 28.6139,
                "longitude", 77.2090,
                "address", "Phase 6 Test Address",
                "contactPhone", "+911234567890"
        );
    }

    private static Process startBackend(int port, Path logPath) throws IOException {
        ProcessBuilder builder = new ProcessBuilder(
                javaBinary(),
                "-jar",
                JAR.toAbsolutePath().toString(),
                "--spring.profiles.active=test",
                "--spring.autoconfigure.exclude=de.flapdoodle.embed.mongo.spring.autoconfigure.EmbeddedMongoAutoConfiguration",
                "--spring.data.mongodb.uri=" + MONGO_URI,
                "--spring.data.mongodb.database=" + TEST_DB,
                "--server.port=" + port,
                "--app.cors.allowed-origins=http://localhost:5173",
                "--app.jwt.secret=test-only-secret-with-enough-length-for-hmac-signing",
                "--debug=false",
                "--logging.level.root=INFO",
                "--logging.level.org.springframework=INFO",
                "--logging.level.org.springframework.web.socket=INFO",
                "--app.chat.upload-dir=target/phase6-stomp-uploads"
        );
        builder.redirectErrorStream(true);
        builder.redirectOutput(logPath.toFile());
        return builder.start();
    }

    private static void assertHealthReady(HttpClient http, String baseUrl) throws Exception {
        awaitStatus(http, baseUrl + "/api/health", 200);
        JsonNode readiness = awaitStatus(http, baseUrl + "/api/health/ready", 200);
        assertThat(readiness.get("mongo").asText()).isEqualTo("UP");
    }

    private static JsonNode awaitStatus(HttpClient http, String url, int status) throws Exception {
        Instant deadline = Instant.now().plusSeconds(45);
        AssertionError last = null;
        while (Instant.now().isBefore(deadline)) {
            try {
                HttpResponse<String> response = http.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(3)).GET().build(),
                        HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == status) return JSON.readTree(response.body());
                last = new AssertionError("HTTP " + response.statusCode());
            } catch (Exception exception) {
                last = new AssertionError(exception);
            }
            Thread.sleep(500);
        }
        throw last == null ? new AssertionError("Timed out waiting for " + url) : last;
    }

    private static UserToken login(HttpClient http, String baseUrl, String email) throws Exception {
        JsonNode body = postJson(http, baseUrl + "/api/auth/login", null, Map.of("email", email, "password", PASSWORD));
        return new UserToken(body.get("userId").asText(), body.get("token").asText());
    }

    private static JsonNode getJson(HttpClient http, String url, String token) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(5)).GET();
        if (token != null) builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isBetween(200, 299);
        return JSON.readTree(response.body());
    }

    private static JsonNode postJson(HttpClient http, String url, String token, Object body) throws Exception {
        HttpRequest.BodyPublisher publisher = body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body));
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(5))
                .header(HttpHeaders.CONTENT_TYPE, "application/json")
                .POST(publisher);
        if (token != null) builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isBetween(200, 299);
        return response.body().isBlank() ? JSON.createObjectNode() : JSON.readTree(response.body());
    }

    private static void assertStatus(HttpClient http, String method, String url, String token, Object body, int expected) throws Exception {
        HttpRequest.BodyPublisher publisher = body == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body));
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(5)).method(method, publisher);
        if (token != null) builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        if (body != null) builder.header(HttpHeaders.CONTENT_TYPE, "application/json");
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(expected);
    }

    private static StompClientSession connect(String baseUrl, String token) throws Exception {
        List<Transport> transports = List.of(new WebSocketTransport(new StandardWebSocketClient()));
        WebSocketStompClient stompClient = new WebSocketStompClient(new SockJsClient(transports));
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());
        StompSession session = stompClient.connectAsync(baseUrl + "/ws?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8),
                new StompSessionHandlerAdapter() {}).get();
        assertThat(session.isConnected()).isTrue();
        return new StompClientSession(stompClient, session);
    }

    private static void seedUsers(MongoDatabase db, String runId) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        db.getCollection("users").insertMany(List.of(
                userDoc(runId + "-requester", encoder, false),
                userDoc(runId + "-volunteer", encoder, true)
        ));
    }

    private static Document userDoc(String prefix, BCryptPasswordEncoder encoder, boolean volunteer) {
        String email = prefix + "@hvhn.test";
        return new Document("_id", UUID.randomUUID().toString())
                .append("email", email)
                .append("normalizedEmail", email)
                .append("password", encoder.encode(PASSWORD))
                .append("fullName", prefix)
                .append("role", "USER")
                .append("authProvider", "PASSWORD")
                .append("accountStatus", "ACTIVE")
                .append("emailVerified", true)
                .append("verified", true)
                .append("verificationLevel", "BASIC")
                .append("onboardingCompleted", true)
                .append("isVolunteer", volunteer)
                .append("volunteer", volunteer)
                .append("volunteerStatus", "ONLINE")
                .append("volunteerCategories", List.of("GENERAL"))
                .append("latitude", 28.6139)
                .append("longitude", 77.2090)
                .append("createdAt", LocalDateTime.now())
                .append("updatedAt", LocalDateTime.now());
    }

    private static void cleanup(MongoDatabase db) {
        assertSafeTestDatabase(db.getName());
        for (String collection : List.of("notifications", "notification_preferences", "notification_device_tokens",
                "notification_delivery_attempts", "notification_outbox", "request_acceptances", "request_volunteers",
                "help_requests", "request_comments", "timeline_entries", "users", "user_presence")) {
            db.getCollection(collection).deleteMany(new Document());
        }
    }

    private static void assertNotificationDocument(MongoDatabase db, String id, String userId, String requestId, boolean read) {
        Document notification = db.getCollection("notifications")
                .find(and(eq("_id", new org.bson.types.ObjectId(id)), eq("recipientUserId", userId), eq("entityId", requestId)))
                .first();
        assertThat(notification).isNotNull();
        assertThat(notification.getBoolean("read", false)).isEqualTo(read);
    }

    private static String latestRequestId(MongoDatabase db, String requesterId) {
        Document request = db.getCollection("help_requests").find(eq("requesterId", requesterId)).first();
        assertThat(request).isNotNull();
        return request.getObjectId("_id").toHexString();
    }

    private static void assertSafeTestDatabase(String databaseName) {
        assertThat(databaseName.toLowerCase()).contains("test");
    }

    private static int freePort() throws IOException {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }

    private static String javaBinary() {
        return Path.of(System.getProperty("java.home"), "bin", isWindows() ? "java.exe" : "java").toString();
    }

    private static boolean isWindows() {
        return System.getProperty("os.name").toLowerCase().contains("win");
    }

    private static void quietTokenBearingClientTransportLogs() {
        org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger("org.springframework.web.socket.sockjs.client");
        if (logger instanceof ch.qos.logback.classic.Logger logbackLogger) {
            logbackLogger.setLevel(ch.qos.logback.classic.Level.OFF);
        }
    }

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private static int numberValue(Object value) {
        return value instanceof Number number ? number.intValue() : Integer.parseInt(String.valueOf(value));
    }

    private record UserToken(String userId, String token) {}

    private record StompClientSession(WebSocketStompClient client, StompSession session) {
        EventProbe subscribe(String destination) {
            EventProbe probe = new EventProbe();
            session.subscribe(destination, probe);
            return probe;
        }

        void disconnect() {
            if (session.isConnected()) session.disconnect();
            client.stop();
        }
    }

    private static class EventProbe implements StompFrameHandler {
        private final BlockingQueue<Map<String, Object>> events = new LinkedBlockingQueue<>();

        @Override
        public Type getPayloadType(StompHeaders headers) {
            return Map.class;
        }

        @Override
        @SuppressWarnings("unchecked")
        public void handleFrame(StompHeaders headers, Object payload) {
            events.add((Map<String, Object>) payload);
        }

        Map<String, Object> await(Predicate<Map<String, Object>> predicate) throws InterruptedException {
            Instant deadline = Instant.now().plusSeconds(10);
            while (Instant.now().isBefore(deadline)) {
                Map<String, Object> event = events.poll(250, java.util.concurrent.TimeUnit.MILLISECONDS);
                if (event != null && predicate.test(event)) return event;
            }
            throw new AssertionError("Timed out waiting for STOMP event");
        }
    }
}
