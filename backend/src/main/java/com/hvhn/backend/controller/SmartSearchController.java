package com.hvhn.backend.controller;

import com.hvhn.backend.service.SmartSearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/requests")
public class SmartSearchController {

    private final SmartSearchService smartSearchService;

    public SmartSearchController(SmartSearchService smartSearchService) {
        this.smartSearchService = smartSearchService;
    }

    /**
     * AI-powered smart search endpoint.
     * Understands natural language queries, detects categories, and re-ranks results.
     */
    @PostMapping("/smart-search")
    public ResponseEntity<?> smartSearch(@RequestBody Map<String, Object> body) {
        try {
            String query = (String) body.getOrDefault("query", "");
            Double latitude = body.get("latitude") != null ? ((Number) body.get("latitude")).doubleValue() : null;
            Double longitude = body.get("longitude") != null ? ((Number) body.get("longitude")).doubleValue() : null;

            if (query.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Search query is required."));
            }

            Map<String, Object> results = smartSearchService.smartSearch(query, latitude, longitude);
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Smart search failed: " + e.getMessage()));
        }
    }
}
