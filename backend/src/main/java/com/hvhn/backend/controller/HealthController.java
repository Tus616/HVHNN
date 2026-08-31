package com.hvhn.backend.controller;

import org.bson.Document;
import org.springframework.core.env.Environment;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final MongoTemplate mongoTemplate;
    private final Environment environment;

    public HealthController(MongoTemplate mongoTemplate, Environment environment) {
        this.mongoTemplate = mongoTemplate;
        this.environment = environment;
    }

    @GetMapping
    public Map<String, Object> health() {
        Map<String, Object> body = baseBody("UP");
        body.put("mongoConfigured", hasText(environment.getProperty("spring.data.mongodb.uri")));
        body.put("jwtConfigured", hasText(environment.getProperty("app.jwt.secret")));
        return body;
    }

    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> readiness() {
        Map<String, Object> body = baseBody("UP");
        try {
            mongoTemplate.getDb().runCommand(new Document("ping", 1));
            body.put("mongo", "UP");
            return ResponseEntity.ok(body);
        } catch (RuntimeException exception) {
            body.put("status", "DOWN");
            body.put("mongo", "DOWN");
            body.put("message", "MongoDB is not reachable");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
        }
    }

    private Map<String, Object> baseBody(String status) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", status);
        body.put("service", "hvhn-backend");
        body.put("timestamp", Instant.now().toString());
        return body;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
