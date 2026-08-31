package com.hvhn.backend.service;

import com.hvhn.backend.model.User;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class UserViewMapper {

    public Map<String, Object> toUserMap(User user) {
        Map<String, Object> map = new HashMap<>();
        int totalHelpCount = Math.max(user.getTotalHelpCount(), user.getRequestsHelped());
        List<String> volunteerBadges = VolunteerBadgeSupport.badgesFor(totalHelpCount);
        String volunteerBadge = VolunteerBadgeSupport.highestBadge(totalHelpCount);

        map.put("id", user.getId());
        map.put("email", user.getEmail());
        map.put("normalizedEmail", user.getNormalizedEmail() != null ? user.getNormalizedEmail() : user.getEmail());
        map.put("fullName", user.getFullName());
        map.put("phone", user.getPhone());
        map.put("profileImage", user.getProfileImage());
        map.put("avatarUrl", user.getProfileImage());
        map.put("role", user.getRole());
        map.put("authProvider", user.getAuthProvider());
        map.put("accountStatus", user.getAccountStatus());
        map.put("emailVerified", user.isEmailVerified());
        map.put("points", user.getPoints());
        map.put("requestsHelped", Math.max(user.getRequestsHelped(), totalHelpCount));
        map.put("requestsCreated", user.getRequestsCreated());
        map.put("rating", user.getRating());
        map.put("ratingCount", user.getRatingCount());
        map.put("verified", user.isVerified());
        map.put("verificationLevel", user.getVerificationLevel() != null ? user.getVerificationLevel().name() : "BASIC");
        map.put("latitude", user.getLatitude());
        map.put("longitude", user.getLongitude());
        map.put("address", user.getAddress());
        map.put("city", user.getCity());
        map.put("district", user.getDistrict());
        map.put("state", user.getState());
        map.put("postalCode", user.getPostalCode());
        map.put("locationSource", user.getLocationSource());
        map.put("locationUpdatedAt", user.getLocationUpdatedAt() != null ? user.getLocationUpdatedAt().toString() : null);
        map.put("isVolunteer", user.isVolunteer());
        map.put("volunteerEnabled", user.isVolunteer());
        map.put("volunteerStatus", user.getVolunteerStatus());
        map.put("volunteerCategories", user.getVolunteerCategories());
        map.put("volunteerSetupCompletedAt", user.getVolunteerSetupCompletedAt());
        map.put("onboardingCompleted", user.isOnboardingCompleted());
        map.put("onboardingCompletedAt", user.getOnboardingCompletedAt());
        map.put("onboardingVersion", user.getOnboardingVersion());
        map.put("totalHelpCount", totalHelpCount);
        map.put("bio", user.getBio());
        map.put("bloodGroup", user.getBloodGroup());
        map.put("isBloodDonor", user.isBloodDonor());
        map.put("badges", volunteerBadges);
        map.put("badge", volunteerBadge != null ? volunteerBadge : legacyPointsBadge(user.getPoints()));
        map.put("skills", user.getSkills());
        map.put("emergencyContacts", user.getEmergencyContacts());
        map.put("currentStreak", user.getCurrentStreak());
        map.put("longestStreak", user.getLongestStreak());
        map.put("totalDistanceTraveled", Math.round(user.getTotalDistanceTraveled() * 100.0) / 100.0);
        map.put("totalPeopleHelped", user.getTotalPeopleHelped());
        map.put("availabilitySchedule", user.getAvailabilitySchedule());
        map.put("isAlwaysAvailable", user.isAlwaysAvailable());
        return map;
    }

    private String legacyPointsBadge(int points) {
        if (points >= 500) {
            return "Hero";
        }
        if (points >= 200) {
            return "Champion";
        }
        if (points >= 100) {
            return "Helper";
        }
        if (points >= 50) {
            return "Volunteer";
        }
        return "Newcomer";
    }
}
