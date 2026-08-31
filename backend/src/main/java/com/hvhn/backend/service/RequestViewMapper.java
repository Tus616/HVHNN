package com.hvhn.backend.service;

import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;

@Service
public class RequestViewMapper {

    private final UserRepository userRepository;

    public RequestViewMapper(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Map<String, Object> toRequestMap(HelpRequest request) {
        return toRequestMap(request, null);
    }

    public Map<String, Object> toRequestMap(HelpRequest request, Double distanceKm) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", request.getId());
        map.put("title", request.getTitle());
        map.put("description", request.getDescription());
        map.put("category", request.getCategory());
        map.put("urgency", request.getUrgency());
        map.put("status", canonicalRequestStatus(request.getStatus()));
        map.put("scope", request.getScope());
        map.put("latitude", request.getLatitude());
        map.put("longitude", request.getLongitude());
        map.put("mapLatitude", safeCoordinate(request.getLatitude()));
        map.put("mapLongitude", safeCoordinate(request.getLongitude()));
        map.put("address", request.getAddress());
        map.put("location", request.getAddress());
        map.put("city", request.getCity());
        map.put("district", request.getDistrict());
        map.put("state", request.getState());
        map.put("postalCode", request.getPostalCode());
        map.put("locationSource", request.getLocationSource());
        map.put("locationUpdatedAt", request.getLocationUpdatedAt() != null ? request.getLocationUpdatedAt().toString() : null);
        map.put("requiredBloodGroup", request.getRequiredBloodGroup());
        map.put("requiredSkill", request.getRequiredSkill());
        map.put("contactPhone", request.getContactPhone());
        map.put("contact", request.getContactPhone());
        map.put("timeline", request.getTimeline());
        map.put("totalResponseTimeMinutes", request.getTotalResponseTimeMinutes());
        map.put("aiCategory", request.getAiCategory());
        map.put("aiUrgency", request.getAiUrgency());
        map.put("aiSummary", request.getAiSummary());
        map.put("currentTier", request.getCurrentTier());
        map.put("viewCount", request.getViewCount());
        map.put("views", request.getViewCount());
        map.put("responseCount", request.getResponseCount());
        map.put("volunteerProgressStatus", canonicalVolunteerProgress(request.getVolunteerProgressStatus(), request.getStatus()));
        map.put("requesterRatingPending", request.isRequesterRatingPending());
        map.put("requesterRated", request.isRequesterRated());
        map.put("volunteerRating", request.getVolunteerRating());
        map.put("volunteerFeedback", request.getVolunteerFeedback());
        map.put("createdAt", request.getCreatedAt() != null ? request.getCreatedAt().toString() : null);
        map.put("createdAtEpochMs", request.getCreatedAt() != null
                ? request.getCreatedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
                : null);
        map.put("acceptedAt", request.getAcceptedAt() != null ? request.getAcceptedAt().toString() : null);
        map.put("completedAt", request.getCompletedAt() != null ? request.getCompletedAt().toString() : null);
        map.put("volunteerStatusUpdatedAt", request.getVolunteerStatusUpdatedAt() != null
                ? request.getVolunteerStatusUpdatedAt().toString()
                : null);

        map.put("distanceKm", distanceKm != null ? Math.round(distanceKm * 100.0) / 100.0 : null);

        if (request.getRequesterId() != null) {
            map.put("userId", request.getRequesterId());
            Map<String, Object> requester = new HashMap<>();
            requester.put("id", request.getRequesterId());
            requester.put("fullName", request.getRequesterName());
            requester.put("phone", request.getContactPhone());
            userRepository.findById(request.getRequesterId()).ifPresent(user -> {
                requester.put("rating", user.getRating());
                requester.put("verificationLevel", user.getVerificationLevel().name());
                requester.put("profileImage", user.getProfileImage());
                requester.put("avatarUrl", user.getProfileImage());
            });
            map.put("requester", requester);
        }

        if (request.getVolunteerId() != null) {
            Map<String, Object> volunteer = new HashMap<>();
            volunteer.put("id", request.getVolunteerId());
            volunteer.put("fullName", request.getVolunteerName());
            userRepository.findById(request.getVolunteerId()).ifPresent(user -> enrichVolunteerSnapshot(volunteer, user));
            map.put("volunteer", volunteer);
        }

        if (request.getCommunityId() != null) {
            Map<String, Object> community = new HashMap<>();
            community.put("id", request.getCommunityId());
            community.put("name", request.getCommunityName());
            map.put("community", community);
        }

        return map;
    }

    private void enrichVolunteerSnapshot(Map<String, Object> volunteer, User user) {
        volunteer.put("rating", user.getRating());
        volunteer.put("verificationLevel", user.getVerificationLevel().name());
        volunteer.put("profileImage", user.getProfileImage());
        volunteer.put("avatarUrl", user.getProfileImage());
        volunteer.put("totalHelpCount", Math.max(user.getTotalHelpCount(), user.getRequestsHelped()));
        volunteer.put("badge", VolunteerBadgeSupport.highestBadge(Math.max(user.getTotalHelpCount(), user.getRequestsHelped())));
    }

    private Double safeCoordinate(Double value) {
        if (value == null || !Double.isFinite(value)) return null;
        return Math.round(value * 1000.0) / 1000.0;
    }

    private String canonicalRequestStatus(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase();
        return switch (normalized) {
            case "ACTIVE", "ACCEPTED" -> "ASSIGNED";
            case "PENDING_COMPLETION" -> "COMPLETION_REQUESTED";
            default -> normalized;
        };
    }

    private String canonicalVolunteerProgress(String progress, String requestStatus) {
        String normalized = progress == null ? "" : progress.trim().toUpperCase();
        if ("ASSIGNED".equals(normalized)) return "ACCEPTED";
        if ("PENDING_COMPLETION".equals(normalized)) return "COMPLETION_REQUESTED";
        if (!normalized.isBlank()) return normalized;
        String status = canonicalRequestStatus(requestStatus);
        return switch (status) {
            case "ASSIGNED" -> "ACCEPTED";
            case "COMPLETION_REQUESTED" -> "COMPLETION_REQUESTED";
            case "COMPLETED" -> "COMPLETED";
            case "CANCELLED" -> "CANCELLED";
            default -> null;
        };
    }
}
