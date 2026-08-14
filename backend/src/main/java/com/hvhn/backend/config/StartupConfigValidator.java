package com.hvhn.backend.config;

import jakarta.annotation.PostConstruct;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

@Component
public class StartupConfigValidator {

    private final Environment environment;

    public StartupConfigValidator(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void validateProductionSecrets() {
        boolean production = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile));
        if (!production) {
            return;
        }

        requireEnv("MONGODB_URI");
        requireEnv("JWT_SECRET");
        requireEnv("CORS_ALLOWED_ORIGINS");
    }

    private void requireEnv(String name) {
        String value = environment.getProperty(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing required production environment variable: " + name);
        }
    }
}
