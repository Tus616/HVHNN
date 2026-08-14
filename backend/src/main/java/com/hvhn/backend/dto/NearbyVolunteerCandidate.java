package com.hvhn.backend.dto;

public record NearbyVolunteerCandidate(
        String volunteerId,
        Double distanceKm,
        String compatibleCategory,
        String verificationStatus,
        String availability
) {
}
