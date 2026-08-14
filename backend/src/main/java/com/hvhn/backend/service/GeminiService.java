package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Core service for calling the Gemini Developer API (Google AI Studio).
 *
 * <p>Authentication uses a plain API key — no Vertex AI, no service-account JSON,
 * no Google Cloud billing required.
 *
 * <p>Required environment variable:
 * <ul>
 *   <li>{@code GEMINI_API_KEY} — key obtained from Google AI Studio</li>
 * </ul>
 *
 * <p>Optional:
 * <ul>
 *   <li>{@code GEMINI_MODEL} — defaults to {@code gemini-2.5-flash}</li>
 *   <li>{@code GEMINI_EMBEDDING_MODEL} — defaults to {@code gemini-embedding-2}
 *       (supported by the Developer API embedContent endpoint)</li>
 * </ul>
 *
 * <p>Endpoints used:
 * <pre>
 *   generateContent : https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
 *   embedContent    : https://generativelanguage.googleapis.com/v1beta/models/{embeddingModel}:embedContent?key={apiKey}
 * </pre>
 *
 * <p>The {@code gemini-embedding-2} model is verified compatible with the
 * {@code embedContent} endpoint of the Gemini Developer API.
 * Response shape: {@code { "embedding": { "values": [...] } }}
 */
@Service
public class GeminiService {

    private static final Logger logger = LoggerFactory.getLogger(GeminiService.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    /** Gemini Developer API base URL */
    private static final String API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:gemini-2.5-flash}")
    private String model;

    /**
     * Embedding model for the Developer API embedContent endpoint.
     * {@code gemini-embedding-2} is the recommended model and is confirmed
     * compatible with the Developer API (not Vertex AI only).
     */
    @Value("${gemini.embedding-model:gemini-embedding-2}")
    private String embeddingModel;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    @PostConstruct
    public void init() {
        if (!StringUtils.hasText(apiKey)) {
            logger.warn("[gemini] GEMINI_API_KEY is not set. AI features will be unavailable. "
                    + "Obtain a key from https://aistudio.google.com/app/apikey");
        } else {
            logger.info("[gemini] GeminiService initialized with Developer API. model={} embeddingModel={}",
                    model, embeddingModel);
        }
    }

    /**
     * Returns {@code true} if a Gemini API key is present.
     */
    public boolean isAvailable() {
        return StringUtils.hasText(apiKey);
    }

    /**
     * Send a text prompt to Gemini and get the response text.
     */
    public String generateText(String prompt) {
        if (!isAvailable()) {
            logger.warn("[gemini] generateText called but Gemini is not available (no API key).");
            return null;
        }

        try {
            String endpoint = API_BASE + model + ":generateContent?key=" + apiKey;

            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode contents = requestBody.putArray("contents");
            ObjectNode content = contents.addObject();
            ArrayNode parts = content.putArray("parts");
            parts.addObject().put("text", prompt);

            ObjectNode generationConfig = requestBody.putObject("generationConfig");
            generationConfig.put("temperature", 0.2);
            generationConfig.put("maxOutputTokens", 1024);

            String responseBody = callGeminiApi(endpoint, requestBody.toString());
            return extractTextFromResponse(responseBody);

        } catch (Exception e) {
            logger.error("[gemini] generateText failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Send a conversation history to Gemini and get the response text.
     */
    public String generateChat(List<Map<String, String>> history) {
        if (!isAvailable()) {
            logger.warn("[gemini] generateChat called but Gemini is not available (no API key).");
            return null;
        }

        try {
            String endpoint = API_BASE + model + ":generateContent?key=" + apiKey;

            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode contents = requestBody.putArray("contents");

            for (Map<String, String> msg : history) {
                String role = msg.getOrDefault("role", "user");
                if ("assistant".equals(role)) {
                    role = "model";
                }
                ObjectNode content = contents.addObject();
                content.put("role", role);
                ArrayNode parts = content.putArray("parts");
                parts.addObject().put("text", msg.getOrDefault("text", ""));
            }

            ObjectNode generationConfig = requestBody.putObject("generationConfig");
            generationConfig.put("temperature", 0.2);
            generationConfig.put("maxOutputTokens", 1024);

            String responseBody = callGeminiApi(endpoint, requestBody.toString());
            return extractTextFromResponse(responseBody);

        } catch (Exception e) {
            logger.error("[gemini] generateChat failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Send an image (Base64) + text prompt to Gemini Vision and get the response.
     */
    public String analyzeImage(String base64Image, String mimeType, String prompt) {
        if (!isAvailable()) {
            logger.warn("[gemini] analyzeImage called but Gemini is not available (no API key).");
            return null;
        }

        try {
            String endpoint = API_BASE + model + ":generateContent?key=" + apiKey;

            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode contents = requestBody.putArray("contents");
            ObjectNode content = contents.addObject();
            ArrayNode parts = content.putArray("parts");

            ObjectNode imagePart = parts.addObject();
            ObjectNode inlineData = imagePart.putObject("inlineData");
            inlineData.put("mimeType", mimeType);
            inlineData.put("data", base64Image);

            parts.addObject().put("text", prompt);

            ObjectNode generationConfig = requestBody.putObject("generationConfig");
            generationConfig.put("temperature", 0.1);
            generationConfig.put("maxOutputTokens", 2048);

            String responseBody = callGeminiApi(endpoint, requestBody.toString());
            return extractTextFromResponse(responseBody);

        } catch (Exception e) {
            logger.error("[gemini] analyzeImage failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Generate an embedding vector for the given text using the Developer API.
     *
     * <p>Uses the {@code embedContent} endpoint:
     * {@code /v1beta/models/{embeddingModel}:embedContent?key={apiKey}}
     *
     * <p>Response shape: {@code { "embedding": { "values": [float, ...] } }}
     * This is the Developer API response format, not the Vertex AI format.
     */
    public List<Double> generateEmbedding(String text) {
        if (!isAvailable()) {
            logger.warn("[gemini] generateEmbedding called but Gemini is not available (no API key).");
            return null;
        }

        try {
            // Developer API embedContent endpoint
            String endpoint = API_BASE + embeddingModel + ":embedContent?key=" + apiKey;

            ObjectNode requestBody = objectMapper.createObjectNode();
            // Required: model field with models/ prefix
            requestBody.put("model", "models/" + embeddingModel);
            ObjectNode contentNode = requestBody.putObject("content");
            ArrayNode partsNode = contentNode.putArray("parts");
            partsNode.addObject().put("text", text);
            // Request explicit output dimensionality for gemini-embedding-2 to remain backwards compatible with existing 768 vector spaces
            requestBody.put("outputDimensionality", 768);

            String responseBody = callGeminiApi(endpoint, requestBody.toString());
            return extractEmbeddingFromResponse(responseBody);

        } catch (Exception e) {
            logger.error("[gemini] generateEmbedding failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Parse a JSON string from Gemini response, handling markdown code fences.
     */
    public JsonNode parseJsonResponse(String geminiResponse) {
        if (geminiResponse == null || geminiResponse.isBlank()) {
            return null;
        }

        try {
            String cleaned = geminiResponse.trim();
            if (cleaned.startsWith("```")) {
                int firstNewline = cleaned.indexOf('\n');
                if (firstNewline > 0) {
                    cleaned = cleaned.substring(firstNewline + 1);
                }
                if (cleaned.endsWith("```")) {
                    cleaned = cleaned.substring(0, cleaned.length() - 3);
                }
                cleaned = cleaned.trim();
            }
            return objectMapper.readTree(cleaned);
        } catch (Exception e) {
            logger.warn("[gemini] Failed to parse JSON response: {}", e.getMessage());
            return null;
        }
    }

    // ----- private helpers -----

    private String callGeminiApi(String endpoint, String body) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            logger.error("[gemini] API returned status {}", response.statusCode());
            throw new RuntimeException("Gemini API returned status " + response.statusCode());
        }

        return response.body();
    }

    private String extractTextFromResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && !candidates.isEmpty()) {
                JsonNode parts = candidates.get(0).path("content").path("parts");
                if (parts.isArray() && !parts.isEmpty()) {
                    return parts.get(0).path("text").asText();
                }
            }
            logger.warn("[gemini] No text found in response structure.");
            return null;
        } catch (Exception e) {
            logger.error("[gemini] Failed to parse response: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extract embedding values from the Developer API embedContent response.
     * Expected shape: {@code { "embedding": { "values": [0.1, 0.2, ...] } }}
     */
    private List<Double> extractEmbeddingFromResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            // Developer API: root.embedding.values
            JsonNode values = root.path("embedding").path("values");

            if (values.isArray() && !values.isEmpty()) {
                List<Double> embedding = new ArrayList<>();
                for (JsonNode value : values) {
                    embedding.add(value.asDouble());
                }
                return embedding;
            }

            logger.warn("[gemini] No embedding values found in response.");
            return null;
        } catch (Exception e) {
            logger.error("[gemini] Failed to parse embedding response: {}", e.getMessage());
            return null;
        }
    }
}
