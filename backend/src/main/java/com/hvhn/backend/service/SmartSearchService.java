package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.repository.HelpRequestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * AI-powered smart search service.
 * Uses Gemini to understand search intent, routes to the correct category,
 * and re-ranks results by semantic relevance.
 */
@Service
public class SmartSearchService {

    private static final Logger logger = LoggerFactory.getLogger(SmartSearchService.class);

    private final GeminiService geminiService;
    private final HelpRequestRepository helpRequestRepository;
    private final RequestViewMapper requestViewMapper;
    private final EmbeddingService embeddingService;

    public SmartSearchService(GeminiService geminiService,
                               HelpRequestRepository helpRequestRepository,
                               RequestViewMapper requestViewMapper,
                               EmbeddingService embeddingService) {
        this.geminiService = geminiService;
        this.helpRequestRepository = helpRequestRepository;
        this.requestViewMapper = requestViewMapper;
        this.embeddingService = embeddingService;
    }

    /**
     * Smart search: parse intent with AI, filter by category, re-rank by relevance.
     */
    public Map<String, Object> smartSearch(String query, Double latitude, Double longitude) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("query", query);

        // Step 1: Use Gemini to understand the search intent
        SearchIntent intent = parseSearchIntent(query);
        result.put("detectedCategory", intent.category);
        result.put("detectedUrgency", intent.urgency);
        result.put("interpretation", intent.interpretation);

        // Step 2: Query the unified help_requests collection.
        List<HelpRequest> candidates;
        if (intent.category != null && !intent.category.equals("ALL")) {
            candidates = helpRequestRepository.findByCategoryAndStatus(intent.category, "OPEN");
            if (candidates.isEmpty()) {
                // Broaden search to all open requests as fallback
                candidates = helpRequestRepository.findByStatus("OPEN");
            }
        } else {
            candidates = helpRequestRepository.findByStatus("OPEN");
        }

        // Step 3: Re-rank results using Gemini for semantic relevance
        List<Map<String, Object>> rankedResults = rerankResults(query, candidates, latitude, longitude);
        result.put("results", rankedResults);
        result.put("totalFound", rankedResults.size());

        return result;
    }

    private SearchIntent parseSearchIntent(String query) {
        if (!geminiService.isAvailable()) {
            return fallbackIntentParsing(query);
        }

        try {
            String prompt = String.format("""
                    You are a search intent parser for a help network app.
                    Analyze this search query and return JSON with:
                    - "category": one of BLOOD_DONATION, MEDICAL, FOOD, TRANSPORT, EMERGENCY, CLOTHES, SHELTER, GENERAL, or ALL if unclear
                    - "urgency": one of CRITICAL, HIGH, MEDIUM, LOW, or null if not specified
                    - "interpretation": a brief human-readable interpretation of what the user is looking for

                    Search query: "%s"

                    Respond ONLY with valid JSON, no explanation.
                    """, query);

            String response = geminiService.generateText(prompt);
            JsonNode json = geminiService.parseJsonResponse(response);

            if (json != null) {
                return new SearchIntent(
                        getJsonText(json, "category", "ALL"),
                        getJsonText(json, "urgency", null),
                        getJsonText(json, "interpretation", "Searching for: " + query)
                );
            }
        } catch (Exception e) {
            logger.warn("Gemini intent parsing failed: {}", e.getMessage());
        }

        return fallbackIntentParsing(query);
    }

    private SearchIntent fallbackIntentParsing(String query) {
        String lower = query.toLowerCase();
        String category = "ALL";

        if (lower.contains("blood") || lower.contains("donor")) category = "BLOOD_DONATION";
        else if (lower.contains("medicine") || lower.contains("doctor") || lower.contains("hospital")) category = "MEDICAL";
        else if (lower.contains("food") || lower.contains("meal") || lower.contains("hungry")) category = "FOOD";
        else if (lower.contains("transport") || lower.contains("ride") || lower.contains("vehicle")) category = "TRANSPORT";
        else if (lower.contains("emergency") || lower.contains("fire") || lower.contains("flood")) category = "EMERGENCY";

        return new SearchIntent(category, null, "Keyword search for: " + query);
    }

    private List<Map<String, Object>> rerankResults(String query, List<HelpRequest> candidates,
                                                      Double latitude, Double longitude) {
        if (candidates.isEmpty()) {
            return List.of();
        }

        // Step 3: Re-rank results using Semantic Embeddings
        if (candidates.size() > 0) {
            try {
                return semanticRerank(query, candidates);
            } catch (Exception e) {
                logger.warn("Semantic re-ranking failed, using default order: {}", e.getMessage());
            }
        }

        // Default: sort by urgency then recency
        return candidates.stream()
                .sorted(Comparator.comparingInt((HelpRequest r) -> urgencyRank(r.getUrgency()))
                        .thenComparing(HelpRequest::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(r -> {
                    Map<String, Object> map = requestViewMapper.toRequestMap(r);
                    map.put("relevanceScore", 0.5);
                    return map;
                })
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> semanticRerank(String query, List<HelpRequest> candidates) {
        List<Double> queryEmbedding = embeddingService.generateEmbeddingForQuery(query);
        
        if (queryEmbedding == null) {
            return candidates.stream()
                .map(r -> {
                    Map<String, Object> map = requestViewMapper.toRequestMap(r);
                    map.put("relevanceScore", 0.5);
                    return map;
                }).collect(Collectors.toList());
        }

        return candidates.stream()
            .map(r -> {
                double score = 0.0;
                if (r.getEmbedding() != null) {
                    score = embeddingService.calculateCosineSimilarity(queryEmbedding, r.getEmbedding());
                }
                Map<String, Object> map = requestViewMapper.toRequestMap(r);
                map.put("relevanceScore", score);
                return map;
            })
            .sorted((m1, m2) -> Double.compare((Double)m2.get("relevanceScore"), (Double)m1.get("relevanceScore")))
            .collect(Collectors.toList());
    }

    private int urgencyRank(String urgency) {
        return switch (urgency != null ? urgency.toUpperCase() : "") {
            case "CRITICAL" -> 1;
            case "HIGH" -> 2;
            case "MEDIUM" -> 3;
            default -> 4;
        };
    }

    private String getJsonText(JsonNode json, String field, String defaultValue) {
        JsonNode node = json.get(field);
        if (node == null || node.isNull() || node.asText().equalsIgnoreCase("null")) {
            return defaultValue;
        }
        return node.asText();
    }

    private record SearchIntent(String category, String urgency, String interpretation) {}
}
