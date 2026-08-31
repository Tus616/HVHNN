package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Set;

/**
 * Uploads files to Cloudinary using the signed Upload API over HTTPS.
 *
 * <p>No local disk is used. Files are streamed directly to Cloudinary.
 * Returns a permanent {@code secure_url} (HTTPS).
 *
 * <p>Required environment variables:
 * <ul>
 *   <li>{@code CLOUDINARY_CLOUD_NAME}</li>
 *   <li>{@code CLOUDINARY_API_KEY}</li>
 *   <li>{@code CLOUDINARY_API_SECRET}</li>
 * </ul>
 *
 * <p>When credentials are absent, {@link #isConfigured()} returns {@code false}.
 * Upload attempts while unconfigured throw {@link CloudinaryUploadException}.
 */
@Service
public class CloudinaryUploadService {

    private static final Logger log = LoggerFactory.getLogger(CloudinaryUploadService.class);

    /** Cloudinary upload folder for all chat attachments. */
    private static final String UPLOAD_FOLDER = "sahay/chat";

    /** Accepted MIME-type prefixes. */
    private static final Set<String> ALLOWED_MIME_PREFIXES =
            Set.of("image/", "video/", "audio/", "application/pdf");

    /** 20 MB limit — same guard that existed on the local-disk path. */
    private static final long MAX_FILE_BYTES = 20L * 1024 * 1024;

    private static final int TIMEOUT_SECONDS = 60;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;
    private final HttpClient httpClient;

    public CloudinaryUploadService(
            @Value("${cloudinary.cloud-name:}") String cloudName,
            @Value("${cloudinary.api-key:}") String apiKey,
            @Value("${cloudinary.api-secret:}") String apiSecret
    ) {
        this.cloudName = cloudName;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                .build();

        if (!isConfigured()) {
            log.warn("[cloudinary] CloudinaryUploadService is not fully configured. "
                    + "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to enable uploads.");
        } else {
            log.info("[cloudinary] CloudinaryUploadService configured. cloudName={}", cloudName);
        }
    }

    /** Returns {@code true} if all required credentials are present. */
    public boolean isConfigured() {
        return StringUtils.hasText(cloudName)
                && StringUtils.hasText(apiKey)
                && StringUtils.hasText(apiSecret);
    }

    /**
     * Upload a file to Cloudinary and return the permanent {@code secure_url}.
     *
     * @param file the multipart file to upload
     * @return the Cloudinary {@code secure_url} (absolute HTTPS URL)
     * @throws CloudinaryUploadException on validation failure or Cloudinary API error
     */
    public String upload(MultipartFile file) {
        validateFile(file);

        if (!isConfigured()) {
            throw new CloudinaryUploadException(
                    "File upload is not configured (missing Cloudinary credentials).");
        }

        long timestamp = System.currentTimeMillis() / 1000;
        String signature = sign(timestamp);
        String boundary = "sahay-" + Long.toHexString(System.nanoTime());
        String url = "https://api.cloudinary.com/v1_1/" + cloudName + "/auto/upload";

        byte[] body = buildMultipartBody(boundary, file, timestamp, signature);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofSeconds(TIMEOUT_SECONDS))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                .build();

        HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("[cloudinary] error=INTERRUPTED");
            throw new CloudinaryUploadException("Upload interrupted.", e);
        } catch (Exception e) {
            log.error("[cloudinary] error=IO_FAILURE category={}", e.getClass().getSimpleName());
            throw new CloudinaryUploadException("Upload failed due to an I/O error.", e);
        }

        int status = response.statusCode();
        if (status < 200 || status >= 300) {
            log.error("[cloudinary] status={} error=REJECTED", status);
            throw new CloudinaryUploadException(
                    "Cloudinary rejected the upload with HTTP " + status + ".");
        }

        try {
            JsonNode json = MAPPER.readTree(response.body());
            JsonNode secureUrl = json.get("secure_url");
            if (secureUrl == null || secureUrl.isNull() || !StringUtils.hasText(secureUrl.asText())) {
                log.error("[cloudinary] status={} error=MISSING_SECURE_URL", status);
                throw new CloudinaryUploadException("Cloudinary response did not include a secure_url.");
            }
            log.info("[cloudinary] status={} result=UPLOADED", status);
            return secureUrl.asText();
        } catch (CloudinaryUploadException e) {
            throw e;
        } catch (Exception e) {
            log.error("[cloudinary] error=RESPONSE_PARSE_FAILURE");
            throw new CloudinaryUploadException("Failed to parse Cloudinary upload response.", e);
        }
    }

    // ----- private helpers -----

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new CloudinaryUploadException("Choose a file to upload.");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new CloudinaryUploadException("File exceeds the maximum allowed size of 20 MB.");
        }
        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType) || ALLOWED_MIME_PREFIXES.stream().noneMatch(contentType::startsWith)) {
            throw new CloudinaryUploadException(
                    "File type is not allowed. Accepted: images, video, audio, PDF.");
        }
    }

    /**
     * Build the SHA-1 signature required by the Cloudinary signed upload API.
     * Signs: {@code folder=...&timestamp=...} + apiSecret
     */
    private String sign(long timestamp) {
        String toSign = "folder=" + UPLOAD_FOLDER + "&timestamp=" + timestamp + apiSecret;
        try {
            MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
            byte[] digest = sha1.digest(toSign.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute Cloudinary signature.", e);
        }
    }

    /** Builds a raw multipart/form-data body compatible with Java's HttpClient. */
    private byte[] buildMultipartBody(String boundary, MultipartFile file,
                                      long timestamp, String signature) {
        try {
            String CRLF = "\r\n";
            String dash = "--";
            StringBuilder sb = new StringBuilder();

            // file part
            sb.append(dash).append(boundary).append(CRLF);
            sb.append("Content-Disposition: form-data; name=\"file\"; filename=\"")
              .append(sanitizeFileName(file.getOriginalFilename())).append("\"").append(CRLF);
            sb.append("Content-Type: ").append(file.getContentType()).append(CRLF);
            sb.append(CRLF);

            byte[] headerBytes = sb.toString().getBytes(StandardCharsets.UTF_8);
            byte[] fileBytes = file.getBytes();

            // remaining fields as text parts
            String tailParts = CRLF
                    + buildTextPart(boundary, "folder", UPLOAD_FOLDER)
                    + buildTextPart(boundary, "timestamp", String.valueOf(timestamp))
                    + buildTextPart(boundary, "api_key", apiKey)
                    + buildTextPart(boundary, "signature", signature)
                    + dash + boundary + dash + CRLF;

            byte[] tailBytes = tailParts.getBytes(StandardCharsets.UTF_8);

            byte[] result = new byte[headerBytes.length + fileBytes.length + tailBytes.length];
            System.arraycopy(headerBytes, 0, result, 0, headerBytes.length);
            System.arraycopy(fileBytes, 0, result, headerBytes.length, fileBytes.length);
            System.arraycopy(tailBytes, 0, result, headerBytes.length + fileBytes.length, tailBytes.length);
            return result;
        } catch (IOException e) {
            throw new CloudinaryUploadException("Failed to read uploaded file bytes.", e);
        }
    }

    private String buildTextPart(String boundary, String name, String value) {
        return "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"" + name + "\"\r\n"
                + "\r\n"
                + value + "\r\n";
    }

    private String sanitizeFileName(String name) {
        if (!StringUtils.hasText(name)) return "attachment";
        return name.replaceAll("[^A-Za-z0-9._-]", "-");
    }

    /** Runtime exception for Cloudinary upload failures. */
    public static class CloudinaryUploadException extends RuntimeException {
        public CloudinaryUploadException(String message) {
            super(message);
        }
        public CloudinaryUploadException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
