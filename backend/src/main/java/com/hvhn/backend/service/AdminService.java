package com.hvhn.backend.service;

import com.hvhn.backend.dto.DashboardStats;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.CommunityRepository;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class AdminService {

    private final HelpRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final CommunityRepository communityRepository;

    public AdminService(HelpRequestRepository requestRepository,
                        UserRepository userRepository,
                        CommunityRepository communityRepository) {
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
        this.communityRepository = communityRepository;
    }

    public DashboardStats getDashboardStats() {
        DashboardStats stats = new DashboardStats();

        stats.setTotalRequests(requestRepository.count());
        stats.setOpenRequests(requestRepository.countByStatus("OPEN"));
        stats.setCompletedRequests(requestRepository.countByStatus("COMPLETED"));
        stats.setTotalUsers(userRepository.count());
        stats.setTotalCommunities(communityRepository.count());

        // Count volunteers (users who have helped at least once)
        stats.setTotalVolunteers(
            userRepository.findAll().stream()
                .filter(User::isVolunteer)
                .count()
        );

        // Requests by category
        Map<String, Long> byCategory = new HashMap<>();
        for (String cat : new String[]{"BLOOD_DONATION", "MEDICAL", "FOOD", "TRANSPORT", "GENERAL", "EMERGENCY"}) {
            byCategory.put(cat, requestRepository.countByCategory(cat));
        }
        stats.setRequestsByCategory(byCategory);

        // Requests by status
        Map<String, Long> byStatus = new HashMap<>();
        for (String status : new String[]{"OPEN", "ACTIVE", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"}) {
            byStatus.put(status, requestRepository.countByStatus(status));
        }
        stats.setRequestsByStatus(byStatus);

        // Calculate average response time
        double avgTime = requestRepository.findAll().stream()
                .filter(r -> "COMPLETED".equals(r.getStatus()) && r.getTotalResponseTimeMinutes() != null)
                .mapToLong(r -> r.getTotalResponseTimeMinutes())
                .average()
                .orElse(0.0);
        stats.setAverageResponseTimeMinutes(Math.round(avgTime * 10.0) / 10.0);
        
        stats.setFlaggedRequests(requestRepository.countByVerificationStatus("FLAGGED"));

        return stats;
    }

    public java.util.List<HelpRequest> getFlaggedRequests() {
        return requestRepository.findAll().stream()
                .filter(r -> "FLAGGED".equals(r.getVerificationStatus()))
                .toList();
    }

    public HelpRequest reviewRequest(String requestId, String status, String adminId, String adminName) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new java.util.NoSuchElementException("Request not found"));
        
        request.setVerificationStatus(status); // VERIFIED or REJECTED
        
        if ("REJECTED".equals(status)) {
            request.setStatus("CANCELLED");
        }
        
        request.setAdminReviewRequired(false);
        
        // Add timeline entry
        if (request.getTimeline() == null) request.setTimeline(new java.util.ArrayList<>());
        request.getTimeline().add(new com.hvhn.backend.model.TimelineEntry("ADMIN_REVIEW_" + status, adminName, adminId));
        
        HelpRequest saved = requestRepository.save(request);
        
        // Re-save to category collection to sync
        if (saved.getCategory() != null) {
            String categoryCollection = "help_requests_" + saved.getCategory().toLowerCase();
            // We use mongoTemplate to ensure it updates the specific collection too
            // Note: In a real app we might use a listener, but here we do it explicitly for speed
            // mongoTemplate.save(saved, categoryCollection); // Redundant if they share same IDs but good for isolation
        }
        
        return saved;
    }
}
