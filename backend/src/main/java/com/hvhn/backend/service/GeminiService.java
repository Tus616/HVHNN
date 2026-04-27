package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.AccessToken;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

/**
 * Core service for calling Google Gemini API via Vertex AI REST endpoints.
 * Authenticates using the GCP service account JSON key file.
 */
@Service
public class GeminiService {

    private static final Logger logger = LoggerFactory.getLogger(GeminiService.class);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${gemini.project-id}")
    private String projectId;

    @Value("${gemini.location}")
    private String location;

    @Value("${gemini.model}")
    private String model;

    @Value("${gemini.embedding-model}")
    private String embeddingModel;

    @Value("${gemini.service-account.path}")
    private Resource serviceAccountResource;

    private GoogleCredentials credentials;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();

    @PostConstruct
    public void init() {
        try (InputStream is = serviceAccountResource.getInputStream()) {
            credentials = GoogleCredentials.fromStream(is)
                    .createScoped(List.of("https://www.googleapis.com/auth/cloud-platform"));
            credentials.refreshIfExpired();
            logger.info("Gemini AI service initialized successfully for project: {}", projectId);
        } catch (Exception e) {
            logger.error("Failed to initialize Gemini AI service. AI features will use fallback logic.", e);
            credentials = null;
        }
    }

    /**
     * Returns true if the Gemini API is properly configured and available.
     */
    public boolean isAvailable() {
        return credentials != null;
    }

    /**
     * Send a text prompt to Gemini and get the response text.
     */
    public String generateText(String prompt) {
        if (!isAvailable()) {
            logger.warn("Gemini is not available. Returning null.");
            return null;
        }

        try {
            String endpoint = String.format(
                    "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
                    location, projectId, location, model
            );

            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode contents = requestBody.putArray("contents");
            ObjectNode content = contents.addObject();
            ArrayNode parts = content.putArray("parts");
            parts.addObject().put("text", prompt);

            // Generation config for structured output
            ObjectNode generationConfig = requestBody.putObject("generationConfig");
            generationConfig.put("temperature", 0.2);
            generationConfig.put("maxOutputTokens", 1024);

            String responseBody = callGeminiApi(endpoint, requestBody.toString());
            return extractTextFromResponse(responseBody);

        } catch (Exception e) {
            logger.error("Gemini text generation failed: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Send an image (Base64) + text prompt to Gemini Vision and get the response.
     */
    public String analyzeImage(String base64Image, String mimeType, String prompt) {
        if (!isAvailable()) {
            logger.warn("Gemini is not available for image analysis.");
            return null;
        }

        try {
            String endpoint = String.format(
                    "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
                    location, projectId, location, model
            );

            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode contents = requestBody.putArray("contents");
            ObjectNode content = contents.addObject();
            ArrayNode parts = content.putArray("parts");

            // Image part
            ObjectNode imagePart = parts.addObject();
            ObjectNode inlineData = imagePart.putObject("inlineData");
            inlineData.put("mimeType", mimeType);
            inlineData.put("data", base64Image);

            // Text prompt part
            parts.addObject().put("text", prompt);

            ObjectNode generationConfig = requestBody.putObject("generationConfig");
            generationConfig.put("temperature", 0.1);
            generationConfig.put("maxOutputTokens", 2048);

            String responseBody = callGeminiApi(endpoint, requestBody.toString());
            return extractTextFromResponse(responseBody);

        } catch (Exception e) {
            logger.error("Gemini image analysis failed: {}", e.getMessage(), e);
            return null;
        }
    }

    /**
     * Generate an embedding vector for the given text.
     */
    public List<Double> generateEmbedding(String text) {
        if (!isAvailable()) {
            logger.warn("Gemini is not available for embeddings.");
            return null;
        }

        try {
            String endpoint = String.format(
                    "https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:predict",
                    location, projectId, location, embeddingModel
            );

            ObjectNode requestBody = objectMapper.createObjectNode();
            ArrayNode instances = requestBody.putArray("instances");
            ObjectNode instance = instances.addObject();
            instance.put("content", text);
            instance.put("task_type", "RETRIEVAL_DOCUMENT");

            String responseBody = callGeminiApi(endpoint, requestBody.toString());
            return extractEmbeddingFromResponse(responseBody);

        } catch (Exception e) {
            logger.error("Gemini embedding generation failed: {}", e.getMessage(), e);
            return null;
        }
    }

    private List<Double> extractEmbeddingFromResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            JsonNode predictions = root.path("predictions");
            if (predictions.isArray() && !predictions.isEmpty()) {
                JsonNode values = predictions.get(0).path("embeddings").path("values");
                if (values.isArray()) {
                    List<Double> embedding = new java.util.ArrayList<>();
                    for (JsonNode value : values) {
                        embedding.add(value.asDouble());
                    }
                    return embedding;
                }
            }
            logger.warn("No embedding values found in Gemini response.");
            return null;
        } catch (Exception e) {
            logger.error("Failed to parse Gemini embedding response: {}", e.getMessage());
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
            // Strip markdown code fences if present (```json ... ```)
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
            logger.warn("Failed to parse Gemini JSON response: {}", e.getMessage());
            return null;
        }
    }

    private String callGeminiApi(String endpoint, String body) throws Exception {
        credentials.refreshIfExpired();
        AccessToken token = credentials.getAccessToken();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(30))
                .header("Authorization", "Bearer " + token.getTokenValue())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            logger.error("Gemini API returned status {}: {}", response.statusCode(), response.body());
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
            logger.warn("No text found in Gemini response structure.");
            return null;
        } catch (Exception e) {
            logger.error("Failed to parse Gemini response: {}", e.getMessage());
            return null;
        }
    }
}
