package com.hvhn.backend.service;

import com.hvhn.backend.dto.HelpRequestDTO;
import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.RequestComment;
import com.hvhn.backend.model.RequestAcceptance;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.CommunityRepository;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.RequestCommentRepository;
import com.hvhn.backend.repository.RequestAcceptanceRepository;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.model.TimelineEntry;
import com.hvhn.backend.model.enums.NotificationType;
import com.hvhn.backend.model.enums.VolunteerCategory;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.scheduling.annotation.Scheduled;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import java.util.Comparator;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class HelpRequestService {

    private static final Logger logger = LoggerFactory.getLogger(HelpRequestService.class);

    private final HelpRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final CommunityRepository communityRepository;
    private final RequestAcceptanceRepository acceptanceRepository;
    private final RequestCommentRepository commentRepository;
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
    private final LocationService locationService;
    private final MlMatchingEventService mlMatchingEventService;

    public HelpRequestService(HelpRequestRepository requestRepository,
                              UserRepository userRepository,
                              CommunityRepository communityRepository,
                              RequestAcceptanceRepository acceptanceRepository,
                              RequestCommentRepository commentRepository,
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
                              RateLimiterService rateLimiterService,
                              LocationService locationService,
                              MlMatchingEventService mlMatchingEventService) {
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
        this.communityRepository = communityRepository;
        this.acceptanceRepository = acceptanceRepository;
        this.commentRepository = commentRepository;
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
        this.locationService = locationService;
        this.mlMatchingEventService = mlMatchingEventService;
    }

    public static final String REQUEST_OPEN = "OPEN";
    public static final String REQUEST_ASSIGNED = "ASSIGNED";
    public static final String REQUEST_IN_PROGRESS = "IN_PROGRESS";
    public static final String REQUEST_COMPLETION_REQUESTED = "COMPLETION_REQUESTED";
    public static final String REQUEST_COMPLETED = "COMPLETED";
    public static final String REQUEST_CANCELLED = "CANCELLED";

    public static final String PROGRESS_ACCEPTED = "ACCEPTED";
    public static final String PROGRESS_ON_THE_WAY = "ON_THE_WAY";
    public static final String PROGRESS_REACHED = "REACHED";
    public static final String PROGRESS_HELPING = "HELPING";
    public static final String PROGRESS_COMPLETION_REQUESTED = "COMPLETION_REQUESTED";
    public static final String PROGRESS_COMPLETED = "COMPLETED";
    public static final String PROGRESS_CANCELLED = "CANCELLED";

    public HelpRequest createRequest(HelpRequestDTO dto, User requester) {
        requireAuthenticated(requester);
        validateCreateRequest(dto);
        validateRequestText(dto.getTitle(), dto.getDescription());

        try {
            rateLimiterService.checkRateLimit(requester.getId(), 2, 5);
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, exception.getMessage(), exception);
        }

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
            try {
                Map<String, Object> parsed = hvhnAiService.process(parseInput);
                if (!parsed.containsKey("error")) {
                    if (dto.getCategory() == null || dto.getCategory().isEmpty()) dto.setCategory((String) parsed.get("category"));
                    if (dto.getUrgency() == null || dto.getUrgency().isEmpty()) dto.setUrgency((String) parsed.get("urgency"));

                    Map<String, Object> ext = (Map<String, Object>) parsed.get("extracted_info");
                    if (ext != null) {
                        if (dto.getAddress() == null || dto.getAddress().isEmpty()) dto.setAddress((String) ext.get("location_hint"));
                        if (dto.getRequiredBloodGroup() == null || dto.getRequiredBloodGroup().isEmpty()) dto.setRequiredBloodGroup((String) ext.get("blood_group"));
                    }
                }
            } catch (RuntimeException exception) {
                logger.warn("Optional request parsing failed for requesterId={}: {}", requester.getId(), exception.getMessage());
            }
        }

        // 2. Unified AI Fake Detection (blocking only when the provider returns a clear reject decision)
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
        Map<String, Object> fakeResult = Map.of();
        try {
            fakeResult = hvhnAiService.process(fakeInput);
        } catch (RuntimeException exception) {
            logger.warn("Optional fake-detection check failed for requesterId={}: {}", requester.getId(), exception.getMessage());
        }
        
        // Strict blocking: If AI says block or risk is likely_fake, do not save at all.
        if ("block".equals(fakeResult.get("action")) || "likely_fake".equals(fakeResult.get("risk_level"))) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Request rejected by moderation checks.");
        }

        HelpRequest request = new HelpRequest();
        request.setAiFakeDetectionResult(fakeResult);

        request.setTitle(dto.getTitle().trim());
        request.setDescription(dto.getDescription().trim());
        request.setCategory(canonicalCategory(dto.getCategory()));
        request.setUrgency(canonicalUrgency(dto.getUrgency()));
        request.setStatus(REQUEST_OPEN);
        request.setScope(StringUtils.hasText(dto.getCommunityId()) ? "COMMUNITY" : "GLOBAL");
        // Ensure createdAt is always present and JS-friendly (avoid long fractional seconds)
        LocalDateTime now = LocalDateTime.now().withNano(0);
        request.setCreatedAt(now);
        request.setUpdatedAt(now);
        applyRequestLocation(request, dto, requester);
        request.setAddress((dto.getAddress() == null || dto.getAddress().isBlank()) ? requester.getAddress() : dto.getAddress());
        request.setContactPhone((dto.getContactPhone() == null || dto.getContactPhone().isBlank()) ? requester.getPhone() : dto.getContactPhone());
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
        addTimelineEntry(savedRequest, "REQUEST_CREATED", requester.getFullName(), requester.getId(), "REQUESTER", null, REQUEST_OPEN);

        // 3. Unified AI Volunteer Matching
        if (REQUEST_OPEN.equals(savedRequest.getStatus()) && !savedRequest.isFlagged()) {
            try {
                List<User> volunteers = userRepository.findAll(); // Simple fetch for now
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
            try {
                notificationService.alertEmergencyContacts(requester, savedRequest);
            } catch (RuntimeException exception) {
                logger.warn("Emergency notification failed for requestId={}: {}", savedRequest.getId(), exception.getMessage());
            }
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
        return requestRepository.findByCategoryAndStatus(canonicalCategory(category), REQUEST_OPEN);
    }

    public List<HelpRequest> getRequestsByCommunity(String communityId) {
        return requestRepository.findByCommunityId(communityId);
    }

    public List<HelpRequest> getOpenRequests() {
        return requestRepository.findByStatus(REQUEST_OPEN)
                .stream()
                .filter(request -> !request.isDeletedByRequester())
                .filter(request -> !StringUtils.hasText(request.getCommunityId()) || "GLOBAL".equalsIgnoreCase(request.getScope()))
                .sorted(Comparator
                        .comparingInt((HelpRequest request) -> urgencyRank(request.getUrgency()))
                        .thenComparing(HelpRequest::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    /**
     * Default feed returns only discoverable requests.
     */
    public List<HelpRequest> getFeedRequests() {
        List<HelpRequest> requests = requestRepository.findByStatusInOrderByCreatedAtDesc(List.of(REQUEST_OPEN));
        return requests.stream()
                .filter(request -> !request.isDeletedByRequester())
                .filter(request -> !StringUtils.hasText(request.getCommunityId()) || "GLOBAL".equalsIgnoreCase(request.getScope()))
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
                .filter(request -> !request.isDeletedByRequester())
                .sorted(Comparator.comparing(HelpRequest::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    public List<HelpRequest> getVolunteerRequests(User user) {
        return requestRepository.findByVolunteerIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .filter(request -> !request.isDeletedByVolunteer())
                .toList();
    }

    public HelpRequest getRequestById(String id) {
        return getRequestById(id, null);
    }

    public HelpRequest getRequestById(String id, User viewer) {
        HelpRequest request = requestRepository.findById(id)
                .filter(value -> !value.isDeletedByRequester())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
        if (viewer != null && StringUtils.hasText(viewer.getId()) && !Objects.equals(request.getRequesterId(), viewer.getId())) {
            request.setViewCount(request.getViewCount() + 1);
            return requestRepository.save(request);
        }
        return request;
    }

    public HelpRequest getPublicRequest(String id) {
        HelpRequest request = requestRepository.findById(id)
                .filter(value -> !value.isDeletedByRequester())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
        request.setShareCount(request.getShareCount() + 1);
        return requestRepository.save(request);
    }

    public HelpRequest acceptRequest(String requestId, User volunteer) {
        requireEligibleVolunteer(volunteer);
        HelpRequest current = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
        if (Objects.equals(current.getRequesterId(), volunteer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot accept your own request.");
        }
        LocalDateTime now = LocalDateTime.now().withNano(0);
        Query query = new Query(Criteria.where("_id").is(requestId)
                .and("status").is(REQUEST_OPEN)
                .orOperator(Criteria.where("volunteerId").exists(false), Criteria.where("volunteerId").is(null)));
        Update update = new Update()
                .set("status", REQUEST_ASSIGNED)
                .set("volunteerId", volunteer.getId())
                .set("volunteerName", volunteer.getFullName())
                .set("volunteerProgressStatus", PROGRESS_ACCEPTED)
                .set("acceptedAt", now)
                .set("updatedAt", now)
                .set("volunteerStatusUpdatedAt", now)
                .set("requesterRatingPending", false)
                .set("requesterRated", false)
                .inc("responseCount", 1);

        HelpRequest assigned = mongoTemplate.findAndModify(
                query,
                update,
                FindAndModifyOptions.options().returnNew(true),
                HelpRequest.class
        );
        if (assigned == null) {
            HelpRequest latest = requestRepository.findById(requestId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
            if (!REQUEST_OPEN.equals(canonicalRequestStatus(latest.getStatus())) || StringUtils.hasText(latest.getVolunteerId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This request has already been assigned.");
            }
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Request cannot be accepted from its current state.");
        }

        acceptanceRepository.findByHelpRequestIdAndVolunteerId(requestId, volunteer.getId())
                .orElseGet(() -> {
                    RequestAcceptance acceptance = new RequestAcceptance();
                    acceptance.setHelpRequestId(requestId);
                    acceptance.setVolunteerId(volunteer.getId());
                    acceptance.setStatus(PROGRESS_ACCEPTED);
                    return acceptanceRepository.save(acceptance);
                });

        addTimelineEntry(assigned, "REQUEST_ACCEPTED", volunteer.getFullName(), volunteer.getId(), "VOLUNTEER", REQUEST_OPEN, REQUEST_ASSIGNED);
        volunteer.setPoints(volunteer.getPoints() + 10);
        userRepository.save(volunteer);
        mlMatchingEventService.markAccepted(requestId, volunteer.getId());
        notificationService.notifyRequestEvent(NotificationType.REQUEST_ACCEPTED, assigned, volunteer, assigned.getRequesterId());
        return requestRepository.findById(requestId).orElse(assigned);
    }

    public HelpRequest completeRequest(String requestId, User user) {
        return requestCompletion(requestId, user);
    }

    public HelpRequest cancelRequest(String requestId, User user) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));

        if (!Objects.equals(request.getRequesterId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the requester can cancel this request.");
        }
        String previous = canonicalRequestStatus(request.getStatus());
        if (REQUEST_COMPLETED.equals(previous) || REQUEST_CANCELLED.equals(previous)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "This request cannot be cancelled.");
        }
        request.setStatus(REQUEST_CANCELLED);
        request.setVolunteerProgressStatus(PROGRESS_CANCELLED);
        request.setUpdatedAt(LocalDateTime.now().withNano(0));
        addTimelineEntry(request, "REQUEST_CANCELLED", user.getFullName(), user.getId(), "REQUESTER", previous, REQUEST_CANCELLED);
        HelpRequest saved = requestRepository.save(request);
        if (StringUtils.hasText(saved.getVolunteerId())) {
            notificationService.notifyRequestEvent(NotificationType.REQUEST_CANCELLED, saved, user, saved.getVolunteerId());
        }
        return saved;
    }

    public void removeOwnRequest(String requestId, User user) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
        if (!Objects.equals(request.getRequesterId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the requester can delete this request.");
        }
        acceptanceRepository.deleteByHelpRequestId(requestId);
        commentRepository.deleteByRequestId(requestId);
        notificationService.deleteRequestOwnedRecords(requestId);
        requestRepository.delete(request);
    }

    public void removeAcceptedRequest(String requestId, User user) {
        HelpRequest request = getRequestById(requestId);
        if (!Objects.equals(request.getVolunteerId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned volunteer can remove this accepted request from their history.");
        }
        request.setDeletedByVolunteer(true);
        request.setDeletedByVolunteerAt(LocalDateTime.now().withNano(0));
        requestRepository.save(request);
    }

    public HelpRequest updateRequesterAvailability(String requestId, User user, String requestedStatus) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
        if (!Objects.equals(request.getRequesterId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the requester can update availability.");
        }
        String current = canonicalRequestStatus(request.getStatus());
        String next = String.valueOf(requestedStatus == null ? "" : requestedStatus).trim().toUpperCase(Locale.ROOT);
        if ("CLOSED".equals(next)) next = REQUEST_CANCELLED;
        if (!REQUEST_OPEN.equals(next) && !REQUEST_CANCELLED.equals(next)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be OPEN or CLOSED.");
        }
        if ((REQUEST_ASSIGNED.equals(current) || REQUEST_IN_PROGRESS.equals(current) || REQUEST_COMPLETION_REQUESTED.equals(current))
                && !Objects.equals(current, next)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Accepted requests must follow the volunteer lifecycle controls.");
        }
        if (REQUEST_COMPLETED.equals(current)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Completed requests cannot be reopened or closed here.");
        }
        if (Objects.equals(current, next)) return request;
        request.setStatus(next);
        request.setVolunteerProgressStatus(REQUEST_CANCELLED.equals(next) ? PROGRESS_CANCELLED : null);
        request.setUpdatedAt(LocalDateTime.now().withNano(0));
        addTimelineEntry(request, REQUEST_CANCELLED.equals(next) ? "REQUEST_CLOSED" : "REQUEST_REOPENED",
                user.getFullName(), user.getId(), "REQUESTER", current, next);
        return requestRepository.save(request);
    }

    public HelpRequest verifyRequestCompletion(String requestId, User user) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));

        if (!request.getRequesterId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the requester can verify completion.");
        }
        String previous = canonicalRequestStatus(request.getStatus());
        if (REQUEST_COMPLETED.equals(previous)) {
            return request;
        }
        if (!REQUEST_COMPLETION_REQUESTED.equals(previous)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Request is not pending completion verification.");
        }

        request.setStatus(REQUEST_COMPLETED);
        request.setVolunteerProgressStatus(PROGRESS_COMPLETED);
        request.setCompletedAt(LocalDateTime.now().withNano(0));
        request.setUpdatedAt(LocalDateTime.now().withNano(0));
        request.setRequesterRatingPending(true);
        request.setRequesterRated(false);
        if (request.getCreatedAt() != null) {
            request.setTotalResponseTimeMinutes(Duration.between(request.getCreatedAt(), request.getCompletedAt()).toMinutes());
        }
        acceptanceRepository.findByHelpRequestIdAndVolunteerId(requestId, request.getVolunteerId()).ifPresent(acceptance -> {
            acceptance.setStatus(PROGRESS_COMPLETED);
            acceptance.setCompletedAt(request.getCompletedAt());
            acceptanceRepository.save(acceptance);
        });
        addTimelineEntry(request, "REQUEST_COMPLETED", user.getFullName(), user.getId(), "REQUESTER", previous, REQUEST_COMPLETED);
        logger.info("Request {} completion verified by requester {}", requestId, user.getEmail());
        HelpRequest saved = requestRepository.save(request);
        mlMatchingEventService.markCompleted(requestId, saved.getVolunteerId());
        notificationService.notifyRequestEvent(NotificationType.REQUEST_COMPLETION_CONFIRMED, saved, user, saved.getVolunteerId());
        return saved;
    }

    public HelpRequest rejectRequestCompletion(String requestId, User user) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));

        if (!request.getRequesterId().equals(user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the requester can reject completion.");
        }
        String previous = canonicalRequestStatus(request.getStatus());
        if (!REQUEST_COMPLETION_REQUESTED.equals(previous)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Request is not pending completion verification.");
        }

        request.setVolunteerProgressStatus(PROGRESS_HELPING);
        request.setStatus(REQUEST_IN_PROGRESS);
        request.setUpdatedAt(LocalDateTime.now().withNano(0));
        addTimelineEntry(request, "COMPLETION_REJECTED", user.getFullName(), user.getId(), "REQUESTER", previous, REQUEST_IN_PROGRESS);
        logger.info("Request {} completion rejected by requester {}, reverting to IN_PROGRESS", requestId, user.getEmail());
        HelpRequest saved = requestRepository.save(request);
        notificationService.notifyRequestEvent(NotificationType.REQUEST_COMPLETION_REJECTED, saved, user, saved.getVolunteerId());
        return saved;
    }

    public void addTimelineEntry(HelpRequest request, String event, String actorName, String actorId) {
        addTimelineEntry(request, event, actorName, actorId, null, null, request != null ? request.getStatus() : null);
    }

    public void addTimelineEntry(HelpRequest request, String event, String actorName, String actorId,
                                 String actorRole, String previousStatus, String newStatus) {
        if (request.getTimeline() == null) {
            request.setTimeline(new java.util.ArrayList<>());
        }
        boolean duplicateTail = request.getTimeline().stream()
                .reduce((first, second) -> second)
                .map(entry -> Objects.equals(entry.getEvent(), event)
                        && Objects.equals(entry.getActorId(), actorId)
                        && Objects.equals(entry.getNewStatus(), newStatus))
                .orElse(false);
        if (duplicateTail) {
            return;
        }
        TimelineEntry entry = new TimelineEntry(event, actorName, actorId);
        entry.setActorRole(actorRole);
        entry.setPreviousStatus(previousStatus);
        entry.setNewStatus(newStatus);
        request.getTimeline().add(entry);
        requestRepository.save(request);
    }

    public HelpRequest updateProgress(String requestId, User user, String actionOrStatus) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
        if (!Objects.equals(request.getVolunteerId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned volunteer can update progress.");
        }
        String previous = canonicalRequestStatus(request.getStatus());
        if (REQUEST_COMPLETED.equals(previous) || REQUEST_CANCELLED.equals(previous) || REQUEST_COMPLETION_REQUESTED.equals(previous)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Request cannot be progressed from its current state.");
        }

        String action = canonicalProgressAction(actionOrStatus);
        String nextRequestStatus = switch (action) {
            case PROGRESS_ON_THE_WAY, PROGRESS_REACHED, PROGRESS_HELPING -> REQUEST_IN_PROGRESS;
            default -> throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Unsupported progress action.");
        };
        if (action.equals(request.getVolunteerProgressStatus()) && nextRequestStatus.equals(previous)) {
            return request;
        }

        request.setVolunteerProgressStatus(action);
        request.setStatus(nextRequestStatus);
        request.setVolunteerStatusUpdatedAt(LocalDateTime.now().withNano(0));
        request.setUpdatedAt(LocalDateTime.now().withNano(0));
        String event = switch (action) {
            case PROGRESS_ON_THE_WAY -> "VOLUNTEER_ON_THE_WAY";
            case PROGRESS_REACHED -> "VOLUNTEER_REACHED";
            case PROGRESS_HELPING -> "HELP_STARTED";
            default -> "VOLUNTEER_PROGRESS_UPDATED";
        };
        addTimelineEntry(request, event, user.getFullName(), user.getId(), "VOLUNTEER", previous, nextRequestStatus);
        HelpRequest saved = requestRepository.save(request);
        notificationService.notifyRequestEvent(NotificationType.REQUEST_PROGRESS_UPDATED, saved, user, saved.getRequesterId());
        return saved;
    }

    public HelpRequest requestCompletion(String requestId, User user) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
        if (!Objects.equals(request.getVolunteerId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned volunteer can request completion.");
        }
        String previous = canonicalRequestStatus(request.getStatus());
        if (REQUEST_COMPLETION_REQUESTED.equals(previous)) {
            return request;
        }
        if (!REQUEST_ASSIGNED.equals(previous) && !REQUEST_IN_PROGRESS.equals(previous)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Request cannot enter completion verification from its current state.");
        }
        request.setStatus(REQUEST_COMPLETION_REQUESTED);
        request.setVolunteerProgressStatus(PROGRESS_COMPLETION_REQUESTED);
        request.setVolunteerStatusUpdatedAt(LocalDateTime.now().withNano(0));
        request.setUpdatedAt(LocalDateTime.now().withNano(0));
        addTimelineEntry(request, "COMPLETION_REQUESTED", user.getFullName(), user.getId(), "VOLUNTEER", previous, REQUEST_COMPLETION_REQUESTED);
        HelpRequest saved = requestRepository.save(request);
        notificationService.notifyRequestEvent(NotificationType.REQUEST_COMPLETION_REQUESTED, saved, user, saved.getRequesterId());
        return saved;
    }

    public HelpRequest withdraw(String requestId, User user) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
        if (!Objects.equals(request.getVolunteerId(), user.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the assigned volunteer can withdraw.");
        }
        String previous = canonicalRequestStatus(request.getStatus());
        if (REQUEST_COMPLETED.equals(previous) || REQUEST_CANCELLED.equals(previous)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "This request cannot be withdrawn.");
        }
        request.setStatus(REQUEST_OPEN);
        request.setVolunteerProgressStatus(null);
        request.setVolunteerId(null);
        request.setVolunteerName(null);
        request.setAcceptedAt(null);
        request.setUpdatedAt(LocalDateTime.now().withNano(0));
        acceptanceRepository.findByHelpRequestIdAndVolunteerId(requestId, user.getId()).ifPresent(acceptance -> {
            acceptance.setStatus("CANCELLED");
            acceptanceRepository.save(acceptance);
        });
        addTimelineEntry(request, "VOLUNTEER_WITHDREW", user.getFullName(), user.getId(), "VOLUNTEER", previous, REQUEST_OPEN);
        HelpRequest saved = requestRepository.save(request);
        notificationService.notifyRequestEvent(NotificationType.REQUEST_PROGRESS_UPDATED, saved, user, saved.getRequesterId());
        return saved;
    }

    public List<RequestComment> getComments(String requestId) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
        return commentRepository.findByRequestIdAndDeletedFalseOrderByCreatedAtAsc(requestId);
    }

    public RequestComment addComment(String requestId, User user, String text) {
        HelpRequest request = requestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found."));
        String safeText = text == null ? "" : text.trim();
        if (safeText.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Comment text is required.");
        }
        if (safeText.length() > 1000) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Comment is too long.");
        }
        RequestComment comment = new RequestComment();
        comment.setRequestId(requestId);
        comment.setAuthorId(user.getId());
        comment.setAuthorName(user.getFullName());
        comment.setAuthorProfileImage(user.getProfileImage());
        comment.setAvatarUrl(user.getProfileImage());
        comment.setText(safeText);
        comment.setCreatedAt(LocalDateTime.now().withNano(0));
        RequestComment saved = commentRepository.save(comment);
        String recipient = Objects.equals(user.getId(), request.getRequesterId()) ? request.getVolunteerId() : request.getRequesterId();
        if (StringUtils.hasText(recipient)) {
            notificationService.notifyRequestEvent(NotificationType.REQUEST_COMMENT_ADDED, request, user, recipient);
        }
        return saved;
    }

    public void deleteComment(String requestId, String commentId, User user) {
        RequestComment comment = commentRepository.findById(commentId)
                .filter(value -> Objects.equals(value.getRequestId(), requestId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found."));
        if (!Objects.equals(comment.getAuthorId(), user.getId()) && !"ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the author can delete this comment.");
        }
        comment.setDeleted(true);
        commentRepository.save(comment);
    }

    public List<HelpRequest> getAllRequests() {
        return requestRepository.findAll();
    }

    private void setCommunitySnapshot(HelpRequest request, Community community) {
        request.setCommunityId(community.getId());
        request.setCommunityName(community.getName());
    }

    private void validateCreateRequest(HelpRequestDTO dto) {
        if (dto == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required.");
        if (!StringUtils.hasText(dto.getTitle()) || dto.getTitle().trim().length() < 5 || dto.getTitle().trim().length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request title must be 5 to 120 characters.");
        }
        if (!StringUtils.hasText(dto.getDescription()) || dto.getDescription().trim().length() < 20 || dto.getDescription().trim().length() > 4000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request description must be 20 to 4000 characters.");
        }
        canonicalCategory(dto.getCategory());
        canonicalUrgency(dto.getUrgency());
        validateCoordinates(dto.getLatitude(), dto.getLongitude());
        if (StringUtils.hasText(dto.getContactPhone()) && dto.getContactPhone().trim().length() > 40) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Contact phone is too long.");
        }
    }

    private void validateCoordinates(Double latitude, Double longitude) {
        locationService.validateOptional(latitude, longitude);
    }

    private void applyRequestLocation(HelpRequest request, HelpRequestDTO dto, User requester) {
        Double latitude = dto.getLatitude();
        Double longitude = dto.getLongitude();
        String source = locationService.normalizeSource(dto.getLocationSource(), LocationService.SOURCE_UNKNOWN);
        if (latitude == null && longitude == null && LocationService.SOURCE_PROFILE.equals(source)) {
            latitude = requester.getLatitude();
            longitude = requester.getLongitude();
        }

        var point = locationService.point(latitude, longitude);
        request.setLatitude(latitude);
        request.setLongitude(longitude);
        request.setGeoLocation(point);
        request.setLocationSource(point != null ? source : LocationService.SOURCE_UNKNOWN);
        request.setLocationUpdatedAt(locationService.nowIfLocated(point));
        request.setCity(locationService.normalizeArea(StringUtils.hasText(dto.getCity()) ? dto.getCity() : requester.getCity()));
        request.setDistrict(locationService.normalizeArea(StringUtils.hasText(dto.getDistrict()) ? dto.getDistrict() : requester.getDistrict()));
        request.setState(locationService.normalizeArea(StringUtils.hasText(dto.getState()) ? dto.getState() : requester.getState()));
        request.setPostalCode(locationService.normalizeArea(StringUtils.hasText(dto.getPostalCode()) ? dto.getPostalCode() : requester.getPostalCode()));
    }

    private String canonicalCategory(String value) {
        try {
            return VolunteerCategory.canonicalize(value);
        } catch (RuntimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported request category.");
        }
    }

    private String canonicalUrgency(String value) {
        String normalized = value == null || value.isBlank() ? "MEDIUM" : value.trim().toUpperCase(Locale.ROOT);
        if (!Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL").contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported request urgency.");
        }
        return normalized;
    }

    private void requireAuthenticated(User user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user was not resolved.");
    }

    private void requireEligibleVolunteer(User user) {
        requireAuthenticated(user);
        if (!user.isOnboardingCompleted()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Complete onboarding before accepting requests.");
        }
        if (!user.isVerified()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only verified users can accept requests.");
        }
        if (!user.isVolunteer()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Enable volunteer mode first.");
        }
    }

    private void ensureVolunteerCategoryCompatible(HelpRequest request, User volunteer) {
        String required = canonicalCategory(request.getCategory());
        List<String> categories = volunteer.getVolunteerCategories() == null ? List.of() : volunteer.getVolunteerCategories();
        if (!categories.contains(required)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This request does not match your volunteer categories.");
        }
    }

    private String canonicalRequestStatus(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ACTIVE", "ACCEPTED" -> REQUEST_ASSIGNED;
            case "PENDING_COMPLETION" -> REQUEST_COMPLETION_REQUESTED;
            default -> normalized;
        };
    }

    private String canonicalProgressAction(String actionOrStatus) {
        String normalized = actionOrStatus == null ? "" : actionOrStatus.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "ON_THE_WAY" -> PROGRESS_ON_THE_WAY;
            case "REACHED" -> PROGRESS_REACHED;
            case "HELPING" -> PROGRESS_HELPING;
            case "REQUEST_COMPLETION", "PENDING_COMPLETION", "COMPLETION_REQUESTED", "COMPLETED" -> PROGRESS_COMPLETION_REQUESTED;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported progress action.");
        };
    }

    /**
     * Simple gibberish detection to reject meaningless strings before they reach expensive AI models.
     */
    private void validateRequestText(String title, String description) {
        if (isGibberish(title)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid request: Please provide a meaningful title.");
        }
        if (isGibberish(description)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid request: Please provide a meaningful description.");
        }
        if (description != null && description.trim().length() < 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request description is too short (min 20 characters).");
        }
    }

    private boolean isGibberish(String text) {
        if (text == null || text.isBlank()) return true;
        String cleaned = text.trim().replaceAll("[^a-zA-Z\\s]", "");
        if (cleaned.length() < 5) return true;

        String[] words = cleaned.split("\\s+");
        if (words.length < 2) return true;

        String vowels = "aeiouAEIOU";
        int gibberishWords = 0;
        int significantWords = 0;

        for (String word : words) {
            if (word.length() <= 3) continue;
            significantWords++;
            int vowelCount = 0;
            for (char c : word.toCharArray()) {
                if (vowels.indexOf(c) != -1) vowelCount++;
            }
            double vowelRatio = (double) vowelCount / word.length();
            // Most valid English words have at least one vowel and ratio > 15-20%
            if (vowelRatio < 0.15) gibberishWords++;
        }

        if (significantWords > 0 && (double) gibberishWords / significantWords > 0.5) return true;
        return false;
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
