package com.hvhn.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.hvhn.backend.model.User;
import com.hvhn.backend.service.HvhnAiService;
import com.hvhn.backend.service.RateLimiterService;
import com.hvhn.backend.utils.SecurityUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class HvhnAiController {

    private final HvhnAiService aiService;
    private final RateLimiterService rateLimiterService;

    public HvhnAiController(HvhnAiService aiService, RateLimiterService rateLimiterService) {
        this.aiService = aiService;
        this.rateLimiterService = rateLimiterService;
    }

    @PostMapping("/process")
    public ResponseEntity<Object> processAi(@RequestBody Map<String, Object> payload) {
        User user = SecurityUtils.getCurrentUser();
        if (user == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        String mode = (String) payload.get("mode");
        Map<String, Object> data = (Map<String, Object>) payload.get("data");

        // Rate limit: 2 requests per 5 seconds
        try {
            rateLimiterService.checkRateLimit(user.getId(), 2, 5);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "rate_limit_exceeded", "message", e.getMessage()));
        }

        // Role Restrictions
        boolean isAdminMode = "predict_demand".equals(mode) || "community_health".equals(mode);
        if (isAdminMode && !"ADMIN".equalsIgnoreCase(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "access_denied", "message", "This mode is restricted to administrators."));
        }

        JsonNode result = aiService.processRequest(mode, data);
        return ResponseEntity.ok(result);
    }
}
