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
    @GetMapping("/smart-search")
    public ResponseEntity<?> smartSearchGet(@RequestParam String query,
                                            @RequestParam(required = false) Double latitude,
                                            @RequestParam(required = false) Double longitude) {
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Search query is required."));
        }

        Map<String, Object> results = smartSearchService.smartSearch(query, latitude, longitude);
        return ResponseEntity.ok(results);
    }

    @PostMapping("/smart-search")
    public ResponseEntity<?> smartSearch(@RequestBody Map<String, Object> body) {
        String query = (String) body.getOrDefault("query", "");
        Double latitude = body.get("latitude") != null ? ((Number) body.get("latitude")).doubleValue() : null;
        Double longitude = body.get("longitude") != null ? ((Number) body.get("longitude")).doubleValue() : null;

        return smartSearchGet(query, latitude, longitude);
    }
}
