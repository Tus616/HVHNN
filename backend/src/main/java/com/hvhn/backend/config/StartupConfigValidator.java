package com.hvhn.backend.config;

import jakarta.annotation.PostConstruct;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * Validates required environment variables at startup.
 *
 * <p>Hard failures only apply when the {@code prod} or {@code production} Spring profile is active.
 * In all other environments (local, test) missing optional credentials are warned about but
 * do not prevent startup — individual features degrade gracefully.
 *
 * <p>Feature-specific variables (Mailjet, Cloudinary, Gemini) are warned about
 * in all environments if absent, because the features will be unavailable without them.
 * They are enforced as hard failures only in production.
 */
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

        if (production) {
            // Hard failures — these are always required in production
            requireEnv("MONGODB_URI");
            requireEnv("JWT_SECRET");
            requireEnv("CORS_ALLOWED_ORIGINS");

            // Integration-specific hard failures in production
            requireEnv("MAILJET_API_KEY");
            requireEnv("MAILJET_API_SECRET");
            requireEnv("MAIL_FROM");
            requireEnv("CLOUDINARY_CLOUD_NAME");
            requireEnv("CLOUDINARY_API_KEY");
            requireEnv("CLOUDINARY_API_SECRET");
            requireEnv("GEMINI_API_KEY");
        } else {
            // Non-production: warn about missing optional integrations so developers notice
            warnIfMissing("MAILJET_API_KEY", "email delivery (OTP, notifications, emergency alerts) will be disabled");
            warnIfMissing("CLOUDINARY_CLOUD_NAME", "chat file upload will be disabled");
            warnIfMissing("GEMINI_API_KEY", "all AI features (assistant, categorization, smart search, OCR) will be unavailable");
        }
    }

    private void requireEnv(String name) {
        String value = environment.getProperty(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(
                    "[startup] Missing required production environment variable: " + name);
        }
    }

    private void warnIfMissing(String name, String consequence) {
        String value = environment.getProperty(name);
        if (value == null || value.isBlank()) {
            // Use System.err so the warning appears even if logging is not yet configured
            System.err.println("[startup][WARN] " + name + " is not set — " + consequence + ".");
        }
    }
}
