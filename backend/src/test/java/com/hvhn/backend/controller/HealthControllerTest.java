package com.hvhn.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.mock.env.MockEnvironment;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HealthControllerTest {

    @Test
    void healthDoesNotExposeSecretValues() {
        MockEnvironment environment = new MockEnvironment()
                .withProperty("spring.data.mongodb.uri", "mongodb://secret-host")
                .withProperty("app.jwt.secret", "secret");

        Map<String, Object> body = new HealthController(unreachableMongoTemplate(), environment).health();

        assertEquals("UP", body.get("status"));
        assertEquals(true, body.get("mongoConfigured"));
        assertEquals(true, body.get("jwtConfigured"));
    }

    @Test
    void readinessReturnsDownWhenMongoUnavailable() {
        var response = new HealthController(unreachableMongoTemplate(), new MockEnvironment()).readiness();

        assertEquals(503, response.getStatusCode().value());
        assertEquals("DOWN", response.getBody().get("status"));
        assertEquals("DOWN", response.getBody().get("mongo"));
    }

    private MongoTemplate unreachableMongoTemplate() {
        return new MongoTemplate(
                new SimpleMongoClientDatabaseFactory("mongodb://127.0.0.1:1/hvhn?serverSelectionTimeoutMS=50")
        );
    }
}
