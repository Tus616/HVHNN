package com.hvhn.backend.service;

import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
public class LocationService {

    public static final String SOURCE_BROWSER = "BROWSER";
    public static final String SOURCE_MANUAL = "MANUAL";
    public static final String SOURCE_PROFILE = "PROFILE";
    public static final String SOURCE_REQUEST_SPECIFIC = "REQUEST_SPECIFIC";
    public static final String SOURCE_MIGRATED = "MIGRATED";
    public static final String SOURCE_UNKNOWN = "UNKNOWN";

    public GeoJsonPoint point(Double latitude, Double longitude) {
        validateOptional(latitude, longitude);
        if (latitude == null) return null;
        rejectPlaceholder(latitude, longitude);
        return new GeoJsonPoint(longitude, latitude);
    }

    public void validateOptional(Double latitude, Double longitude) {
        if ((latitude == null) != (longitude == null)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Latitude and longitude must be provided together.");
        }
        if (latitude == null) return;
        validateRequired(latitude, longitude);
    }

    public void validateRequired(Double latitude, Double longitude) {
        if (latitude == null || longitude == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Latitude and longitude are required.");
        }
        if (!Double.isFinite(latitude) || latitude < -90 || latitude > 90) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Latitude is invalid.");
        }
        if (!Double.isFinite(longitude) || longitude < -180 || longitude > 180) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Longitude is invalid.");
        }
        rejectLikelySwapped(latitude, longitude);
    }

    public String normalizeArea(String value) {
        if (!StringUtils.hasText(value)) return null;
        return value.trim().replaceAll("\\s+", " ");
    }

    public String normalizeSource(String source, String fallback) {
        String normalized = StringUtils.hasText(source) ? source.trim().toUpperCase(Locale.ROOT) : fallback;
        return switch (normalized) {
            case SOURCE_BROWSER, SOURCE_MANUAL, SOURCE_PROFILE, SOURCE_REQUEST_SPECIFIC, SOURCE_MIGRATED, SOURCE_UNKNOWN -> normalized;
            default -> SOURCE_UNKNOWN;
        };
    }

    public LocalDateTime nowIfLocated(GeoJsonPoint point) {
        return point == null ? null : LocalDateTime.now();
    }

    public double roundKm(double distanceKm) {
        return Math.round(distanceKm * 100.0) / 100.0;
    }

    private void rejectPlaceholder(Double latitude, Double longitude) {
        if (latitude == 0.0d && longitude == 0.0d) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordinates 0,0 are not accepted as a real location.");
        }
    }

    private void rejectLikelySwapped(Double latitude, Double longitude) {
        if (Math.abs(latitude) > 90 && Math.abs(longitude) <= 90) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Coordinates appear to be swapped.");
        }
    }
}
