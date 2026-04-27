package com.hvhn.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Dynamic radius calculation service.
 * Determines the maximum serviceable radius based on time constraints
 * and urban traffic conditions, enabling time-aware volunteer matching.
 */
@Service
public class DynamicRadiusService {

    private static final Logger logger = LoggerFactory.getLogger(DynamicRadiusService.class);

    // Average speeds for urban Indian cities (km/h)
    private static final double SPEED_PEAK_HOURS = 15.0;    // 8-10 AM, 5-8 PM
    private static final double SPEED_NORMAL = 25.0;         // Regular daytime
    private static final double SPEED_NIGHT = 35.0;          // 10 PM - 6 AM
    private static final double SPEED_BIKE = 20.0;           // Two-wheeler average

    // Radius bounds
    private static final double MIN_RADIUS_KM = 1.0;
    private static final double MAX_RADIUS_KM = 50.0;
    private static final double DEFAULT_RADIUS_KM = 5.0;

    /**
     * Calculate the dynamic radius based on time constraint.
     *
     * @param helpNeededWithinMinutes How many minutes the requester needs help within
     * @return Calculated radius in kilometers
     */
    public RadiusResult calculateRadius(Integer helpNeededWithinMinutes) {
        if (helpNeededWithinMinutes == null || helpNeededWithinMinutes <= 0) {
            return new RadiusResult(DEFAULT_RADIUS_KM, DEFAULT_RADIUS_KM * 2, "DEFAULT",
                    "No time constraint specified. Using default 5km radius.");
        }

        double avgSpeed = estimateCurrentSpeed();
        double directRadiusKm = (helpNeededWithinMinutes / 60.0) * avgSpeed;

        // Apply real-world correction (roads aren't straight lines)
        double correctedRadius = directRadiusKm * 0.7; // ~70% of straight-line distance

        // Clamp to bounds
        double primaryRadius = Math.max(MIN_RADIUS_KM, Math.min(MAX_RADIUS_KM, correctedRadius));

        // Relay radius is 2x primary (for indirect/network reach)
        double relayRadius = Math.min(MAX_RADIUS_KM, primaryRadius * 2.0);

        String urgencyTier;
        if (helpNeededWithinMinutes <= 30) {
            urgencyTier = "IMMEDIATE";
        } else if (helpNeededWithinMinutes <= 120) {
            urgencyTier = "URGENT";
        } else if (helpNeededWithinMinutes <= 480) {
            urgencyTier = "SAME_DAY";
        } else {
            urgencyTier = "FLEXIBLE";
        }

        String explanation = String.format(
                "Based on %d min time constraint, avg speed %.0f km/h → %.1f km direct radius (corrected to %.1f km for road distance). Relay radius: %.1f km.",
                helpNeededWithinMinutes, avgSpeed, directRadiusKm, primaryRadius, relayRadius);

        logger.info("Dynamic radius calculated: primary={}km, relay={}km, tier={}, minutes={}",
                primaryRadius, relayRadius, urgencyTier, helpNeededWithinMinutes);

        return new RadiusResult(
                Math.round(primaryRadius * 10.0) / 10.0,
                Math.round(relayRadius * 10.0) / 10.0,
                urgencyTier,
                explanation
        );
    }

    /**
     * Estimate current average travel speed based on time of day.
     */
    private double estimateCurrentSpeed() {
        int hour = java.time.LocalTime.now().getHour();

        if (hour >= 22 || hour < 6) {
            return SPEED_NIGHT;
        }
        if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
            return SPEED_PEAK_HOURS;
        }
        return SPEED_NORMAL;
    }

    /**
     * Result of dynamic radius calculation.
     */
    public static class RadiusResult {
        private final double primaryRadiusKm;
        private final double relayRadiusKm;
        private final String urgencyTier;
        private final String explanation;

        public RadiusResult(double primaryRadiusKm, double relayRadiusKm,
                           String urgencyTier, String explanation) {
            this.primaryRadiusKm = primaryRadiusKm;
            this.relayRadiusKm = relayRadiusKm;
            this.urgencyTier = urgencyTier;
            this.explanation = explanation;
        }

        public double getPrimaryRadiusKm() { return primaryRadiusKm; }
        public double getRelayRadiusKm() { return relayRadiusKm; }
        public String getUrgencyTier() { return urgencyTier; }
        public String getExplanation() { return explanation; }
    }
}
