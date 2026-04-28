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
        map.put("status", request.getStatus());
        map.put("latitude", request.getLatitude());
        map.put("longitude", request.getLongitude());
        map.put("address", request.getAddress());
        map.put("location", request.getAddress());
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
        map.put("volunteerProgressStatus", request.getVolunteerProgressStatus());
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

        if (distanceKm != null) {
            map.put("distanceKm", Math.round(distanceKm * 100.0) / 100.0);
        }

        if (request.getRequesterId() != null) {
            map.put("userId", request.getRequesterId());
            Map<String, Object> requester = new HashMap<>();
            requester.put("id", request.getRequesterId());
            requester.put("fullName", request.getRequesterName());
            requester.put("phone", request.getContactPhone());
            userRepository.findById(request.getRequesterId()).ifPresent(user -> {
                requester.put("rating", user.getRating());
                requester.put("verificationLevel", user.getVerificationLevel().name());
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
        volunteer.put("totalHelpCount", Math.max(user.getTotalHelpCount(), user.getRequestsHelped()));
        volunteer.put("badge", VolunteerBadgeSupport.highestBadge(Math.max(user.getTotalHelpCount(), user.getRequestsHelped())));
    }
}
