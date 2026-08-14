package com.hvhn.backend.config;

import java.util.Arrays;
import java.util.List;

public final class CorsOriginParser {

    private CorsOriginParser() {
    }

    public static List<String> parse(String configuredOrigins, boolean production) {
        List<String> origins = Arrays.stream((configuredOrigins == null ? "" : configuredOrigins).split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .distinct()
                .toList();

        if (origins.isEmpty()) {
            throw new IllegalStateException("At least one CORS origin must be configured.");
        }
        if (production && origins.stream().anyMatch(origin -> origin.equals("*") || origin.equals("http://*") || origin.equals("https://*"))) {
            throw new IllegalStateException("Wildcard CORS origins are not allowed in production.");
        }
        return origins;
    }
}
