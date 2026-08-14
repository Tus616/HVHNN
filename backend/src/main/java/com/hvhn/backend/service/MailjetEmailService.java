package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

/**
 * Email delivery service backed by the Mailjet HTTPS API v3.1.
 *
 * <p>No SMTP is used. All email is sent over HTTPS to
 * {@code https://api.mailjet.com/v3.1/send} using HTTP Basic authentication.
 *
 * <p>Required environment variables (no production email without these):
 * <ul>
 *   <li>{@code MAILJET_API_KEY}</li>
 *   <li>{@code MAILJET_API_SECRET}</li>
 *   <li>{@code MAIL_FROM} – verified sender email address</li>
 * </ul>
 *
 * <p>Optional:
 * <ul>
 *   <li>{@code MAIL_FROM_NAME} – defaults to "Sahay"</li>
 * </ul>
 *
 * <p>When {@code MAILJET_API_KEY} or {@code MAILJET_API_SECRET} are absent,
 * the service is considered unconfigured and {@link #isConfigured()} returns
 * {@code false}. Callers decide how to handle that state.
 */
@Service
public class MailjetEmailService {

    private static final Logger log = LoggerFactory.getLogger(MailjetEmailService.class);
    private static final String MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send";
    private static final int TIMEOUT_SECONDS = 20;

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String apiKey;
    private final String apiSecret;
    private final String fromAddress;
    private final String fromName;
    private final HttpClient httpClient;

    public MailjetEmailService(
            @Value("${app.mailjet.api-key:}") String apiKey,
            @Value("${app.mailjet.api-secret:}") String apiSecret,
            @Value("${app.mail.from:}") String fromAddress,
            @Value("${app.mail.from-name:Sahay}") String fromName
    ) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.fromAddress = fromAddress;
        this.fromName = fromName;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                .build();

        if (!isConfigured()) {
            log.warn("[email] MailjetEmailService is not fully configured. "
                    + "Set MAILJET_API_KEY, MAILJET_API_SECRET, and MAIL_FROM to enable email delivery.");
        } else {
            log.info("[email] MailjetEmailService configured. provider=Mailjet from={}", fromAddress);
        }
    }

    /**
     * Returns {@code true} if all required credentials are present.
     * Does not verify credentials with Mailjet.
     */
    public boolean isConfigured() {
        return StringUtils.hasText(apiKey)
                && StringUtils.hasText(apiSecret)
                && StringUtils.hasText(fromAddress);
    }

    /**
     * Send a plain-text email via the Mailjet API.
     *
     * @param to          recipient email address
     * @param subject     email subject
     * @param textBody    plain-text body
     * @throws EmailDeliveryException if Mailjet rejects the request or an I/O error occurs
     */
    public void sendEmail(String to, String subject, String textBody) {
        if (!isConfigured()) {
            throw new EmailDeliveryException(
                    "Email delivery is not configured (missing Mailjet credentials or from-address).");
        }
        if (!StringUtils.hasText(to)) {
            throw new IllegalArgumentException("Recipient email address is required.");
        }

        String requestBody = buildRequestBody(to, subject, textBody);
        String authHeader = buildAuthHeader();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(MAILJET_SEND_URL))
                .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                .header("Content-Type", "application/json")
                .header("Authorization", authHeader)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("[email] provider=Mailjet error=INTERRUPTED to=[redacted]");
            throw new EmailDeliveryException("Email delivery interrupted.", e);
        } catch (Exception e) {
            log.error("[email] provider=Mailjet error=IO_FAILURE category={}", e.getClass().getSimpleName());
            throw new EmailDeliveryException("Email delivery failed due to an I/O error.", e);
        }

        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            // Log status and a safe error category — never log the response body which
            // might echo back the auth header or payload in debug modes.
            log.error("[email] provider=Mailjet status={} error=REJECTED", status);
            throw new EmailDeliveryException(
                    "Mailjet rejected the email request with HTTP " + status + ".");
        }

        log.info("[email] provider=Mailjet status={} result=SENT", status);
    }

    // ----- private helpers -----

    private String buildRequestBody(String to, String subject, String textBody) {
        try {
            ObjectNode root = MAPPER.createObjectNode();
            ArrayNode messages = root.putArray("Messages");
            ObjectNode message = messages.addObject();

            ObjectNode fromNode = message.putObject("From");
            fromNode.put("Email", fromAddress);
            fromNode.put("Name", StringUtils.hasText(fromName) ? fromName : "Sahay");

            ArrayNode toArray = message.putArray("To");
            ObjectNode toNode = toArray.addObject();
            toNode.put("Email", to);

            message.put("Subject", subject == null ? "" : subject);
            message.put("TextPart", textBody == null ? "" : textBody);

            return MAPPER.writeValueAsString(root);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to build Mailjet request body.", e);
        }
    }

    private String buildAuthHeader() {
        String credentials = apiKey + ":" + apiSecret;
        String encoded = Base64.getEncoder()
                .encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
        return "Basic " + encoded;
        // Note: never log this value
    }

    /**
     * Checked exception for Mailjet delivery failures.
     */
    public static class EmailDeliveryException extends RuntimeException {
        public EmailDeliveryException(String message) {
            super(message);
        }
        public EmailDeliveryException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
