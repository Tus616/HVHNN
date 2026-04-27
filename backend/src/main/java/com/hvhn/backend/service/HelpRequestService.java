package com.hvhn.backend.service;

import com.hvhn.backend.dto.HelpRequestDTO;
import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.RequestAcceptance;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.CommunityRepository;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.RequestAcceptanceRepository;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.model.TimelineEntry;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import org.springframework.scheduling.annotation.Scheduled;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.Comparator;
import java.util.List;

@Service
public class HelpRequestService {

    private final HelpRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final CommunityRepository communityRepository;
    private final RequestAcceptanceRepository acceptanceRepository;
    private final AICategorizationService aiService;
    private final VolunteerService volunteerService;
    private final NotificationService notificationService;
    private final RiskScoringService riskScoringService;
    private final DynamicRadiusService dynamicRadiusService;
    private final OcrVerificationService ocrVerificationService;
    private final RequestParsingService parsingService;
    private final EmbeddingService embeddingService;
    private final VerificationPipelineService verificationPipelineService;
    private final HvhnAiService hvhnAiService;
    private final MongoTemplate mongoTemplate;
    private final RateLimiterService rateLimiterService;

    public HelpRequestService(HelpRequestRepository requestRepository,
                              UserRepository userRepository,
                              CommunityRepository communityRepository,
                              RequestAcceptanceRepository acceptanceRepository,
                              AICategorizationService aiService,
                              VolunteerService volunteerService,
                              NotificationService notificationService,
                              RiskScoringService riskScoringService,
                              DynamicRadiusService dynamicRadiusService,
                              OcrVerificationService ocrVerificationService,
                              RequestParsingService parsingService,
                              EmbeddingService embeddingService,
                              VerificationPipelineService verificationPipelineService,
                              HvhnAiService hvhnAiService,
                              MongoTemplate mongoTemplate,
                              RateLimiterService rateLimiterService) {
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
        this.communityRepository = communityRepository;
        this.acceptanceRepository = acceptanceRepository;
        this.aiService = aiService;
        this.volunteerService = volunteerService;
        this.notificationService = notificationService;
        this.riskScoringService = riskScoringService;
        this.dynamicRadiusService = dynamicRadiusService;
        this.ocrVerificationService = ocrVerificationService;
        this.parsingService = parsingService;
        this.embeddingService = embeddingService;
        this.verificationPipelineService = verificationPipelineService;
        this.hvhnAiService = hvhnAiService;
        this.mongoTemplate = mongoTemplate;
        this.rateLimiterService = rateLimiterService;
    }

    public HelpRequest createRequest(HelpRequestDTO dto, User requester) {
        // Apply Rate Limit: 2 requests per 5 seconds
        rateLimiterService.checkRateLimit(requester.getId(), 2, 5);

        logger.info("Creating help request for user: {}", requester.getEmail());

        // 1. Unified AI Parsing (UX Boost: Auto-fill)
        if (dto.getRawInput() != null && !dto.getRawInput().isBlank()) {
            Map<String, Object> parseInput = new java.util.HashMap<>();
            parseInput.put("mode", "parse_request");
            parseInput.put("data", Map.of(
                "raw_text", dto.getRawInput(),
                "user_id", requester.getId(),
                "community_id", dto.getCommunityId() != null ? dto.getCommunityId() : "global",
                "timestamp", System.currentTimeMillis()
            ));
            Map<String, Object> parsed = hvhnAiService.process(parseInput);
            if (!parsed.containsKey("error")) {
                if (dto.getCategory() == null || dto.getCategory().isEmpty()) dto.setCategory((String) parsed.get("category"));
                if (dto.getUrgency() == null || dto.getUrgency().isEmpty()) dto.setUrgency((String) parsed.get("urgency"));
                
                Map<String, Object> ext = (Map<String, Object>) parsed.get("extracted_info");
                if (dto.getAddress() == null || dto.getAddress().isEmpty()) dto.setAddress((String) ext.get("location_hint"));
                if (dto.getRequiredBloodGroup() == null || dto.getRequiredBloodGroup().isEmpty()) dto.setRequiredBloodGroup((String) ext.get("blood_group"));
            }
        }

        // 2. Unified AI Fake Detection (Security)
        Map<String, Object> fakeInput = new java.util.HashMap<>();
        fakeInput.put("mode", "fake_detection");
        fakeInput.put("data", Map.of(
            "user_id", requester.getId(),
            "request_text", dto.getTitle() + " " + dto.getDescription(),
            "user_history", Map.of(
                "total_requests", requester.getRequestsCreated(),
                "flagged_count", 0,
                "account_age_days", 30
            )
        ));
        Map<String, Object> fakeResult = hvhnAiService.process(fakeInput);
        
        // Strict blocking: If AI says block or risk is likely_fake, do not save at all.
        if ("block".equals(fakeResult.get("action")) || "likely_fake".equals(fakeResult.get("risk_level"))) {
            throw new RuntimeException("Request blocked by security: " + fakeResult.get("reason"));
        }

        HelpRequest request = new HelpRequest();
        request.setAiFakeDetectionResult(fakeResult);

        request.setTitle(dto.getTitle());
        request.setDescription(dto.getDescription());
        request.setCategory(dto.getCategory());
        request.setUrgency(dto.getUrgency());
        if (request.getStatus() == null) request.setStatus("OPEN");
        request.setLatitude(dto.getLatitude());
        request.setLongitude(dto.getLongitude());
        request.setAddress(dto.getAddress());
        request.setContactPhone(dto.getContactPhone());
        request.setRequesterId(requester.getId());
        request.setRequesterName(requester.getFullName());
        request.setCurrentTier(1);
        request.setExpiresAt(LocalDateTime.now().plusHours(24));

        if (dto.getCommunityId() != null && !dto.getCommunityId().isBlank()) {
            logger.info("Setting community snapshot for communityId: {}", dto.getCommunityId());
            communityRepository.findById(dto.getCommunityId())
                    .ifPresentOrElse(
                        community -> setCommunitySnapshot(request, community),
                        () -> logger.warn("Community not found: {}", dto.getCommunityId())
                    );
        }
        
        request.setRequiredBloodGroup(dto.getRequiredBloodGroup());
        request.setRequiredSkill(dto.getRequiredSkill());

        // Generate embedding for semantic search
        try {
            request.setEmbedding(embeddingService.generateEmbeddingForRequest(request));
        } catch (Exception e) {
            System.err.println("Failed to generate embedding for request: " + e.getMessage());
        }

        // Apply Time Constraint and Dynamic Radius
        request.setHelpNeededWithinMinutes(dto.getHelpNeededWithinMinutes());
        DynamicRadiusService.RadiusResult radiusResult = dynamicRadiusService.calculateRadius(dto.getHelpNeededWithinMinutes());
        request.setDynamicRadiusKm(radiusResult.getPrimaryRadiusKm());
        request.setRelayRadiusKm(radiusResult.getRelayRadiusKm());

        // Run the verification pipeline
        verificationPipelineService.processVerification(request, requester, dto.getDocumentBase64());

        requester.setRequestsCreated(requester.getRequestsCreated() + 1);
        requester.setPoints(requester.getPoints() + 5); // +5 points for raising a request
        userRepository.save(requester);

        HelpRequest savedRequest = requestRepository.save(request);

        // 3. Unified AI Volunteer Matching
        if ("OPEN".equals(savedRequest.getStatus()) && !savedRequest.isFlagged()) {
            try {
                List<User> volunteers = userRepository.findByRole("USER"); // Simple fetch for now
                List<Map<String, Object>> volData = volunteers.stream().map(v -> {
                    Map<String, Object> m = new java.util.HashMap<>();
                    m.put("volunteer_id", v.getId());
                    m.put("name", v.getFullName());
                    m.put("is_available", true); // Should check real availability
                    m.put("skills", List.of("general_help")); 
                    m.put("distance_km", 2.5); // Should calculate real distance
                    m.put("success_rate", 0.9);
                    return m;
                }).collect(java.util.stream.Collectors.toList());

                Map<String, Object> matchInput = new java.util.HashMap<>();
                matchInput.put("mode", "match_volunteers");
                matchInput.put("data", Map.of(
                    "request", Map.of(
                        "category", savedRequest.getCategory(),
                        "urgency", savedRequest.getUrgency(),
                        "blood_group", savedRequest.getRequiredBloodGroup() != null ? savedRequest.getRequiredBloodGroup() : "N/A"
                    ),
                    "volunteers", volData
                ));
                Map<String, Object> matchResult = hvhnAiService.process(matchInput);
                savedRequest.setAiMatchingResult(matchResult);
                requestRepository.save(savedRequest);

                // Trigger Notifications for top 3
                List<Map<String, Object>> ranked = (List<Map<String, Object>>) matchResult.get("ranked_volunteers");
                if (ranked != null) {
                    for (int i = 0; i < Math.min(3, ranked.size()); i++) {
                        String vid = (String) ranked.get(i).get("volunteer_id");
                        String msg = (String) ranked.get(i).get("notify_message");
                        notificationService.sendNotification(vid, "NEW_MATCH", msg);
                    }
                }
            } catch (Exception e) {
                System.err.println("AI Matching failed: " + e.getMessage());
            }
        }

        if ("EMERGENCY".equalsIgnoreCase(savedRequest.getCategory())) {
            notificationService.alertEmergencyContacts(requester, savedRequest);
        }

        addTimelineEntry(savedRequest, "REQUEST_RAISED", requester.getFullName(), requester.getId());

        // Save to separate category-specific collection for extremely fast querying
        if (savedRequest.getCategory() != null) {
            String categoryCollection = "help_requests_" + savedRequest.getCategory().toLowerCase();
            mongoTemplate.save(savedRequest, categoryCollection);
        }

        return savedRequest;
    }

    /**
     * Nightly job to expire old requests.
     * CRITICAL: 24h, HIGH: 24h, MEDIUM: 72h, LOW: 168h
     */
    @Scheduled(cron = "0 0 * * * *") // Every hour
    public void expireRequests() {
        requestRepository.findByStatus("OPEN").forEach(request -> {
            LocalDateTime now = LocalDateTime.now();
            if (request.getExpiresAt() != null && now.isAfter(request.getExpiresAt())) {
                request.setStatus("EXPIRED");
                addTimelineEntry(request, "EXPIRED", "System", null);
                requestRepository.save(request);
            }
        });
    }

    public List<HelpRequest> getRequestsByCategory(String category) {
        String targetCollection = "help_requests_" + category.toLowerCase();
        if (mongoTemplate.collectionExists(targetCollection)) {
            Query query = new Query(Criteria.where("status").is("OPEN"));
            return mongoTemplate.find(query, HelpRequest.class, targetCollection);
        }
        return requestRepository.findByCategoryAndStatus(category, "OPEN");
    }

    public List<HelpRequest> getOpenRequests() {
        return requestRepository.findByStatus("OPEN")
                .stream()
                .sorted(Comparator
                        .comparingInt((HelpRequest request) -> urgencyRank(request.getUrgency()))
                        .thenComparing(HelpRequest::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public List<HelpRequest> getRequestsByStatus(String status) {
        return requestRepository.findByStatusOrderByCreatedAtDesc(status);
    }

    public List<HelpRequest> getUserRequests(User user) {
        return requestRepository.findByRequesterId(user.getId())
                .stream()
                .sorted(Comparator.comparing(HelpRequest::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public List<HelpRequest> getVolunteerRequests(User user) {
        return requestRepository.findByVolunteerIdOrderByCreatedAtDesc(user.getId());
    }

    public HelpRequest getRequestById(String id) {
        HelpRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Request not found"));
        request.setViewCount(request.getViewCount() + 1);
        return requestRepository.save(request);
    }

    public HelpRequest getPublicRequest(String id) {
        HelpRequest request = requestRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Request not found"));
        request.setShareCount(request.getShareCount() + 1);
        return requestRepository.save(request);
    }

    public HelpRequest acceptRequest(String requestId, User volunteer) {
        volunteerService.acceptRequest(requestId, volunteer);
        RequestAcceptance acceptance = new RequestAcceptance();
        acceptance.setHelpRequestId(requestId);
        acceptance.setVolunteerId(volunteer.getId());
        acceptanceRepository.save(acceptance);
        return requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));
    }

    public HelpRequest completeRequest(String requestId, User user) {
        return volunteerService.completeLegacyRequest(requestId, user);
    }

    public HelpRequest cancelRequest(String requestId, User user) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        request.setStatus("CANCELLED");
        addTimelineEntry(request, "CANCELLED", user.getFullName(), user.getId());
        return requestRepository.save(request);
    }

    public void addTimelineEntry(HelpRequest request, String event, String actorName, String actorId) {
        if (request.getTimeline() == null) {
            request.setTimeline(new java.util.ArrayList<>());
        }
        request.getTimeline().add(new TimelineEntry(event, actorName, actorId));
        requestRepository.save(request);
    }

    public List<HelpRequest> getAllRequests() {
        return requestRepository.findAll();
    }

    private void setCommunitySnapshot(HelpRequest request, Community community) {
        request.setCommunityId(community.getId());
        request.setCommunityName(community.getName());
    }

    private int urgencyRank(String urgency) {
        if ("CRITICAL".equalsIgnoreCase(urgency)) {
            return 1;
        }
        if ("HIGH".equalsIgnoreCase(urgency)) {
            return 2;
        }
        if ("MEDIUM".equalsIgnoreCase(urgency)) {
            return 3;
        }
        return 4;
    }
}
