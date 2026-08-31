package com.hvhn.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoDatabase;
import org.bson.Document;
import org.bson.types.ObjectId;
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
import static com.mongodb.client.model.Filters.in;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MessagingExternalStompIntegrationIT {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String TEST_DB = "hvhn_phase5_stomp_test";
    private static final String MONGO_URI = "mongodb://localhost:27017/" + TEST_DB;
    private static final String PASSWORD = "Phase5-Stomp-Password-1";
    private static final Path JAR = Path.of("target", "backend-phase5-stomp-verification.jar");

    @Test
    void verifiesRealAuthenticatedExternalStompFlowAgainstPackagedBackend() throws Exception {
        quietTokenBearingClientTransportLogs();
        assertSafeTestDatabase(TEST_DB);
        assertThat(Files.exists(JAR))
                .as("Build the packaged verification jar first with -Dapp.finalName=backend-phase5-stomp-verification")
                .isTrue();

        int port = freePort();
        Path logPath = Path.of("target", "phase5-stomp-backend.log");
        String runId = "phase5-" + UUID.randomUUID();

        try (MongoClient mongoClient = MongoClients.create(MONGO_URI)) {
            MongoDatabase db = mongoClient.getDatabase(TEST_DB);
            cleanup(db);
            seedUsers(db, runId);

            Process backend = startBackend(port, logPath);
            try {
                HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
                String baseUrl = "http://localhost:" + port;
                assertHealthReady(http, baseUrl);

                UserToken userA = login(http, baseUrl, runId + "-a@hvhn.test");
                UserToken userB = login(http, baseUrl, runId + "-b@hvhn.test");
                UserToken userC = login(http, baseUrl, runId + "-c@hvhn.test");

                JsonNode directA = postJson(http, baseUrl + "/api/chat/rooms/direct", userA.token(),
                        Map.of("participantId", userB.userId()));
                String roomId = directA.get("id").asText();
                JsonNode directB = postJson(http, baseUrl + "/api/chat/rooms/direct", userB.token(),
                        Map.of("participantId", userA.userId()));
                assertThat(directB.get("id").asText()).isEqualTo(roomId);
                assertDirectRoomState(db, roomId, userA.userId(), userB.userId());

                StompClientSession clientA = connect(baseUrl, userA.token());
                StompClientSession clientB = connect(baseUrl, userB.token());
                StompClientSession clientA2 = connect(baseUrl, userA.token());
                try {
                    assertThatThrownBy(() -> connect(baseUrl, "bad-token-" + UUID.randomUUID()))
                            .as("invalid JWT handshake")
                            .isInstanceOf(Exception.class);
                    assertThatThrownBy(() -> connectWithoutToken(baseUrl))
                            .as("missing JWT handshake")
                            .isInstanceOf(Exception.class);

                    EventProbe aReceipts = clientA.subscribe("/user/queue/chat/receipts");
                    EventProbe aMessages = clientA.subscribe("/user/queue/chat/messages");
                    EventProbe bMessages = clientB.subscribe("/user/queue/chat/messages");
                    EventProbe bTyping = clientB.subscribe("/topic/typing/" + roomId);
                    EventProbe presence = clientB.subscribe("/topic/presence");

                    awaitPresence(db, userA.userId(), 2, "ONLINE");
                    clientA2.disconnect();
                    awaitPresence(db, userA.userId(), 1, "ONLINE");

                    String onlineClientId = "online-" + UUID.randomUUID();
                    clientA.send("/app/chat.send", Map.of(
                            "roomId", roomId,
                            "content", "sanitized-online-message",
                            "messageType", "CHAT",
                            "clientMessageId", onlineClientId,
                            "senderId", userB.userId()
                    ));
                    Map<String, Object> onlineMessage = bMessages.await(event -> onlineClientId.equals(event.get("clientMessageId")));
                    String onlineMessageId = stringValue(onlineMessage.get("id"));
                    assertPersistedMessageAndReceipt(db, roomId, onlineMessageId, userB.userId(), true, false);
                    aReceipts.await(event -> onlineMessageId.equals(event.get("messageId")) && "DELIVERED".equals(event.get("type")));

                    clientA.send("/app/chat.send", Map.of(
                            "roomId", roomId,
                            "content", "sanitized-online-message",
                            "messageType", "CHAT",
                            "clientMessageId", onlineClientId
                    ));
                    assertThat(bMessages.poll(Duration.ofMillis(600), event -> onlineClientId.equals(event.get("clientMessageId")))).isNull();
                    assertThat(countChatMessages(db, roomId, onlineClientId)).isEqualTo(1);
                    assertUnread(db, roomId, userB.userId(), 1);

                    clientB.send("/app/chat.seen", Map.of("roomId", roomId, "lastSeenMessageId", onlineMessageId));
                    aReceipts.await(event -> onlineMessageId.equals(event.get("messageId")) && "SEEN".equals(event.get("type")));
                    assertPersistedMessageAndReceipt(db, roomId, onlineMessageId, userB.userId(), true, true);
                    assertUnread(db, roomId, userB.userId(), 0);
                    clientB.send("/app/chat.seen", Map.of("roomId", roomId, "lastSeenMessageId", onlineMessageId));
                    assertUnread(db, roomId, userB.userId(), 0);

                    StompClientSession clientC = connect(baseUrl, userC.token());
                    try {
                        clientC.send("/app/chat.send", Map.of(
                                "roomId", roomId,
                                "content", "blocked",
                                "messageType", "CHAT",
                                "clientMessageId", "unauthorized-" + UUID.randomUUID()
                        ));
                        Thread.sleep(250);
                        assertThat(countChatMessagesWithContent(db, roomId, "blocked")).isZero();
                    } finally {
                        clientC.disconnect();
                    }

                    clientA.send("/app/chat.typing", Map.of("roomId", roomId, "typing", true));
                    bTyping.await(event -> userA.userId().equals(event.get("userId")) && Boolean.TRUE.equals(event.get("typing")));
                    clientA.send("/app/chat.typing", Map.of("roomId", roomId, "typing", false));
                    bTyping.await(event -> userA.userId().equals(event.get("userId")) && Boolean.FALSE.equals(event.get("typing")));
                    assertThat(countTypingDocuments(db, roomId)).isZero();

                    JsonNode reactionAdded = postJson(http, baseUrl + "/api/chat/messages/" + onlineMessageId + "/react?emoji=OK", userB.token(), null);
                    assertThat(reactionAdded.get("reactions").has("OK")).isTrue();
                    JsonNode reactionRemoved = postJson(http, baseUrl + "/api/chat/messages/" + onlineMessageId + "/react?emoji=OK", userB.token(), null);
                    assertThat(reactionRemoved.get("reactions").has("OK")).isFalse();
                    assertStatus(http, "POST", baseUrl + "/api/chat/messages/" + onlineMessageId + "/react?emoji=OK", userC.token(), null, 400);

                    assertStatus(http, "DELETE", baseUrl + "/api/chat/conversations/" + roomId, userB.token(), null, 204);
                    assertThat(getJson(http, baseUrl + "/api/chat/conversations", userB.token()).toString()).doesNotContain(roomId);
                    assertThat(getJson(http, baseUrl + "/api/chat/conversations", userA.token()).toString()).contains(roomId);

                    clientB.disconnect();
                    awaitPresence(db, userB.userId(), 0, "OFFLINE");
                    String offlineClientId = "offline-" + UUID.randomUUID();
                    clientA.send("/app/chat.send", Map.of(
                            "roomId", roomId,
                            "content", "sanitized-offline-message",
                            "messageType", "CHAT",
                            "clientMessageId", offlineClientId
                    ));
                    assertThatCode(() -> aMessages.await(event -> offlineClientId.equals(event.get("clientMessageId")))).doesNotThrowAnyException();
                    Document offlineDoc = awaitMessageDocument(db, roomId, offlineClientId);
                    String offlineMessageId = offlineDoc.getObjectId("_id").toHexString();
                    assertPersistedMessageAndReceipt(db, roomId, offlineMessageId, userB.userId(), false, false);
                    assertUnread(db, roomId, userB.userId(), 1);

                    StompClientSession clientBReconnect = connect(baseUrl, userB.token());
                    try {
                        getJson(http, baseUrl + "/api/chat/conversations/" + roomId + "/messages?page=0&size=50", userB.token());
                        aReceipts.await(event -> offlineMessageId.equals(event.get("messageId")) && "DELIVERED".equals(event.get("type")));
                        assertPersistedMessageAndReceipt(db, roomId, offlineMessageId, userB.userId(), true, false);
                        clientBReconnect.send("/app/chat.seen", Map.of("roomId", roomId, "lastSeenMessageId", offlineMessageId));
                        aReceipts.await(event -> offlineMessageId.equals(event.get("messageId")) && "SEEN".equals(event.get("type")));
                        assertUnread(db, roomId, userB.userId(), 0);
                    } finally {
                        clientBReconnect.disconnect();
                    }

                    assertThat(countDirectRooms(db, userA.userId(), userB.userId())).isEqualTo(1);
                    assertStatus(http, "POST", baseUrl + "/api/chat/conversations/" + roomId + "/seen?lastSeenMessageId=" + onlineMessageId,
                            userC.token(), null, 400);
                } finally {
                    clientA.disconnect();
                    clientB.disconnect();
                }
                awaitPresence(db, userA.userId(), 0, "OFFLINE");
                assertThat(Files.readString(logPath)).doesNotContain(userA.token(), userB.token(), userC.token());
            } finally {
                backend.destroy();
                if (!backend.waitFor(10, java.util.concurrent.TimeUnit.SECONDS)) {
                    backend.destroyForcibly();
                }
                cleanup(db);
            }
        }
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
                "--app.chat.upload-dir=target/phase5-stomp-uploads"
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
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(5))
                .method(method, publisher);
        if (token != null) builder.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        if (body != null) builder.header(HttpHeaders.CONTENT_TYPE, "application/json");
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(expected);
    }

    private static StompClientSession connect(String baseUrl, String token) throws Exception {
        return connectRaw(baseUrl + "/ws?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8));
    }

    private static StompClientSession connectWithoutToken(String baseUrl) throws Exception {
        return connectRaw(baseUrl + "/ws");
    }

    private static StompClientSession connectRaw(String url) throws Exception {
        List<Transport> transports = List.of(new WebSocketTransport(new StandardWebSocketClient()));
        WebSocketStompClient stompClient = new WebSocketStompClient(new SockJsClient(transports));
        stompClient.setMessageConverter(new MappingJackson2MessageConverter());
        StompSession session = stompClient.connectAsync(url, new StompSessionHandlerAdapter() {}).get();
        assertThat(session.isConnected()).isTrue();
        return new StompClientSession(stompClient, session);
    }

    private static void seedUsers(MongoDatabase db, String runId) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        MongoCollection<Document> users = db.getCollection("users");
        users.insertMany(List.of(
                userDoc(runId + "-a", encoder),
                userDoc(runId + "-b", encoder),
                userDoc(runId + "-c", encoder)
        ));
    }

    private static Document userDoc(String prefix, BCryptPasswordEncoder encoder) {
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
                .append("createdAt", LocalDateTime.now())
                .append("updatedAt", LocalDateTime.now());
    }

    private static void cleanup(MongoDatabase db) {
        assertSafeTestDatabase(db.getName());
        List<String> collections = List.of("chat_message_receipts", "chat_messages", "chat_room_states",
                "chat_rooms", "user_presence", "email_otp_challenges", "users");
        for (String collection : collections) {
            db.getCollection(collection).deleteMany(new Document());
        }
    }

    private static void assertSafeTestDatabase(String databaseName) {
        assertThat(databaseName.toLowerCase()).contains("test");
    }

    private static void assertDirectRoomState(MongoDatabase db, String roomId, String a, String b) {
        Document room = db.getCollection("chat_rooms").find(eq("participantKey", directParticipantKey(a, b))).first();
        assertThat(room).isNotNull();
        assertThat(room.getObjectId("_id").toHexString()).isEqualTo(roomId);
        assertThat(room.getList("participantIds", String.class)).containsExactlyInAnyOrder(a, b);
        assertThat(room.getString("participantKey")).isNotBlank();
        assertThat(countDirectRooms(db, a, b)).isEqualTo(1);
    }

    private static long countDirectRooms(MongoDatabase db, String a, String b) {
        return db.getCollection("chat_rooms").countDocuments(and(eq("type", "DIRECT"), in("participantIds", a), in("participantIds", b)));
    }

    private static String directParticipantKey(String a, String b) {
        return a.compareTo(b) <= 0 ? a + ":" + b : b + ":" + a;
    }

    private static void assertPersistedMessageAndReceipt(MongoDatabase db, String roomId, String messageId, String userId,
                                                         boolean delivered, boolean seen) {
        Document message = db.getCollection("chat_messages").find(and(eq("_id", new ObjectId(messageId)), eq("roomId", roomId))).first();
        assertThat(message).isNotNull();
        Document receipt = db.getCollection("chat_message_receipts")
                .find(and(eq("messageId", messageId), eq("userId", userId))).first();
        assertThat(receipt).isNotNull();
        if (delivered) {
            assertThat(receipt.get("deliveredAt")).isNotNull();
        } else {
            assertThat(receipt.get("deliveredAt")).isNull();
        }
        if (seen) assertThat(receipt.get("seenAt")).isNotNull();
    }

    private static void assertUnread(MongoDatabase db, String roomId, String userId, int unread) {
        Document state = db.getCollection("chat_room_states").find(and(eq("roomId", roomId), eq("userId", userId))).first();
        assertThat(state).isNotNull();
        assertThat(state.getInteger("unreadCount", -1)).isEqualTo(unread);
    }

    private static void awaitPresence(MongoDatabase db, String userId, int sessions, String status) throws InterruptedException {
        Instant deadline = Instant.now().plusSeconds(10);
        while (Instant.now().isBefore(deadline)) {
            Document presence = db.getCollection("user_presence").find(eq("userId", userId)).first();
            if (presence != null
                    && sessions == presence.getInteger("activeSessionCount", -1)
                    && status.equals(presence.getString("status"))) {
                if ("OFFLINE".equals(status)) assertThat(presence.get("lastSeen")).isNotNull();
                return;
            }
            Thread.sleep(150);
        }
        throw new AssertionError("Timed out waiting for presence " + status + "/" + sessions);
    }

    private static Document awaitMessageDocument(MongoDatabase db, String roomId, String clientMessageId) throws InterruptedException {
        Instant deadline = Instant.now().plusSeconds(10);
        while (Instant.now().isBefore(deadline)) {
            Document message = db.getCollection("chat_messages").find(and(eq("roomId", roomId), eq("clientMessageId", clientMessageId))).first();
            if (message != null) return message;
            Thread.sleep(150);
        }
        throw new AssertionError("Timed out waiting for message document");
    }

    private static long countChatMessages(MongoDatabase db, String roomId, String clientMessageId) {
        return db.getCollection("chat_messages").countDocuments(and(eq("roomId", roomId), eq("clientMessageId", clientMessageId)));
    }

    private static long countChatMessagesWithContent(MongoDatabase db, String roomId, String content) {
        return db.getCollection("chat_messages").countDocuments(and(eq("roomId", roomId), eq("content", content)));
    }

    private static long countTypingDocuments(MongoDatabase db, String roomId) {
        return db.getCollection("chat_messages").countDocuments(and(eq("roomId", roomId), eq("messageType", "TYPING")));
    }

    private static int freePort() throws IOException {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }

    private static String javaBinary() {
        return Path.of(System.getProperty("java.home"), "bin", isWindows() ? "java.exe" : "java").toString();
    }

    private static void quietTokenBearingClientTransportLogs() {
        org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger("org.springframework.web.socket.sockjs.client");
        if (logger instanceof ch.qos.logback.classic.Logger logbackLogger) {
            logbackLogger.setLevel(ch.qos.logback.classic.Level.OFF);
        }
    }

    private static boolean isWindows() {
        return System.getProperty("os.name").toLowerCase().contains("win");
    }

    private static String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private record UserToken(String userId, String token) {}

    private record StompClientSession(WebSocketStompClient client, StompSession session) {
        EventProbe subscribe(String destination) {
            EventProbe probe = new EventProbe();
            session.subscribe(destination, probe);
            return probe;
        }

        void send(String destination, Object payload) {
            session.send(destination, payload);
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
                Map<String, Object> event = events.poll(Duration.ofMillis(250).toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
                if (event != null && predicate.test(event)) return event;
            }
            throw new AssertionError("Timed out waiting for STOMP event");
        }

        Map<String, Object> poll(Duration duration, Predicate<Map<String, Object>> predicate) throws InterruptedException {
            Instant deadline = Instant.now().plus(duration);
            while (Instant.now().isBefore(deadline)) {
                Map<String, Object> event = events.poll(100, java.util.concurrent.TimeUnit.MILLISECONDS);
                if (event != null && predicate.test(event)) return event;
            }
            return null;
        }
    }
}
