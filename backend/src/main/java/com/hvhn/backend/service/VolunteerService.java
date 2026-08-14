package com.hvhn.backend.service;

import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.dto.NearbyVolunteerCandidate;
import com.hvhn.backend.model.RequestVolunteer;
import com.hvhn.backend.model.TimelineEntry;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.VolunteerRating;
import com.hvhn.backend.model.enums.NotificationCategory;
import com.hvhn.backend.model.enums.NotificationPriority;
import com.hvhn.backend.model.enums.NotificationType;
import com.hvhn.backend.model.enums.VolunteerCategory;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.RequestVolunteerRepository;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.repository.VolunteerRatingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Set;
import java.time.Duration;

@Service
public class VolunteerService {

    private static final Logger logger = LoggerFactory.getLogger(VolunteerService.class);

    private static final String VOLUNTEER_ONLINE = "ONLINE";
    private static final String VOLUNTEER_OFFLINE = "OFFLINE";
    private static final String ASSIGNMENT_PENDING = "PENDING";
    private static final String ASSIGNMENT_DECLINED = "DECLINED";
    private static final String ASSIGNMENT_ACCEPTED = "ACCEPTED";
    private static final String ASSIGNMENT_COMPLETED = "COMPLETED";
    private static final String REQUEST_OPEN = "OPEN";
    private static final String REQUEST_ASSIGNED = "ASSIGNED";
    private static final String REQUEST_ACTIVE = "IN_PROGRESS";
    private static final String REQUEST_COMPLETION_REQUESTED = "COMPLETION_REQUESTED";
    private static final String REQUEST_COMPLETED = "COMPLETED";
    private static final Set<String> ALLOWED_PROGRESS = Set.of(
            "ON_THE_WAY",
            "REACHED",
            "HELPING",
            "REQUEST_COMPLETION",
            "COMPLETION_REQUESTED",
            "PENDING_COMPLETION",
            "COMPLETED"
    );

    private final HelpRequestRepository helpRequestRepository;
    private final UserRepository userRepository;
    private final RequestVolunteerRepository requestVolunteerRepository;
    private final VolunteerRatingRepository volunteerRatingRepository;
    private final NotificationService notificationService;
    private final HelpRequestService helpRequestService;
    private final RequestViewMapper requestViewMapper;
    private final UserViewMapper userViewMapper;
    private final GeospatialService geospatialService;
    private final LocationService locationService;
    private final MlIntelligenceService mlIntelligenceService;
    private final MlMatchingEventService mlMatchingEventService;
    private final int volunteerTopK;

    public VolunteerService(HelpRequestRepository helpRequestRepository,
                            UserRepository userRepository,
                            RequestVolunteerRepository requestVolunteerRepository,
                            VolunteerRatingRepository volunteerRatingRepository,
                            NotificationService notificationService,
                            @org.springframework.context.annotation.Lazy HelpRequestService helpRequestService,
                            RequestViewMapper requestViewMapper,
                            UserViewMapper userViewMapper,
                            GeospatialService geospatialService,
                            LocationService locationService,
                            MlIntelligenceService mlIntelligenceService,
                            MlMatchingEventService mlMatchingEventService,
                            @Value("${ml.volunteer-top-k:${ML_VOLUNTEER_TOP_K:20}}") int volunteerTopK) {

        this.helpRequestRepository = helpRequestRepository;
        this.userRepository = userRepository;
        this.requestVolunteerRepository = requestVolunteerRepository;
        this.volunteerRatingRepository = volunteerRatingRepository;
        this.notificationService = notificationService;
        this.helpRequestService = helpRequestService;
        this.requestViewMapper = requestViewMapper;
        this.userViewMapper = userViewMapper;
        this.geospatialService = geospatialService;
        this.locationService = locationService;
        this.mlIntelligenceService = mlIntelligenceService;
        this.mlMatchingEventService = mlMatchingEventService;
        this.volunteerTopK = Math.max(1, Math.min(volunteerTopK, 100));
    }

    public Map<String, Object> toggleVolunteer(User user, boolean isVolunteer) {
        requireVerifiedUser(user);
        user.setVolunteer(isVolunteer);
        if (!isVolunteer) {
            user.setVolunteerStatus(VOLUNTEER_OFFLINE);
            user.setVolunteerCategories(List.of());
        } else if (user.getVolunteerSetupCompletedAt() == null) {
            user.setVolunteerSetupCompletedAt(LocalDateTime.now());
        }
        return userViewMapper.toUserMap(userRepository.save(user));
    }

    public Map<String, Object> updateVolunteerStatus(User user, String status) {
        User volunteer = requireVolunteerUser(user);
        volunteer.setVolunteerStatus(normalizeVolunteerStatus(status));
        return userViewMapper.toUserMap(userRepository.save(volunteer));
    }

    public Map<String, Object> updateVolunteerLocation(User user, Double latitude, Double longitude) {
        if (latitude == null || longitude == null) {
            throw new IllegalArgumentException("Latitude and longitude are required.");
        }
        User volunteer = requireVerifiedUser(user);
        volunteer.setLocation(locationService.point(latitude, longitude));
        volunteer.setLatitude(latitude);
        volunteer.setLongitude(longitude);
        volunteer.setLocationSource(LocationService.SOURCE_BROWSER);
        volunteer.setLocationUpdatedAt(LocalDateTime.now());
        return userViewMapper.toUserMap(userRepository.save(volunteer));
    }

    public Map<String, Object> updateVolunteerCategories(User user, List<String> categories) {
        User volunteer = requireVolunteerUser(user);
        List<String> normalizedCategories = normalizeVolunteerCategories(categories);
        if (normalizedCategories.isEmpty()) {
            throw new IllegalArgumentException("Choose at least one volunteer category.");
        }
        volunteer.setVolunteerCategories(normalizedCategories);
        return userViewMapper.toUserMap(userRepository.save(volunteer));
    }

    public List<Map<String, Object>> getNearbyVolunteers(String requestId) {
        HelpRequest request = getRequest(requestId);
        return findNearbyVolunteerMatches(request).stream()
                .map(match -> {
                    Map<String, Object> volunteer = userViewMapper.toUserMap(match.user());
                    volunteer.put("distanceKm", Math.round(match.distanceKm() * 100.0) / 100.0);
                    volunteer.put("radiusKm", match.radiusKm());
                    return volunteer;
                })
                .toList();
    }

    public List<Map<String, Object>> getBloodMatches(String bloodGroup, User currentUser) {
        if (!StringUtils.hasText(bloodGroup) || currentUser == null || !hasLocation(currentUser.getLatitude(), currentUser.getLongitude())) {
            return List.of();
        }
        return userRepository.findByVolunteerTrueAndVerifiedTrue().stream()
                .filter(User::isBloodDonor)
                .filter(candidate -> VOLUNTEER_ONLINE.equalsIgnoreCase(candidate.getVolunteerStatus()))
                .filter(candidate -> hasLocation(candidate.getLatitude(), candidate.getLongitude()))
                .filter(candidate -> !currentUser.getId().equals(candidate.getId()))
                .filter(candidate -> isBloodCompatible(bloodGroup, candidate.getBloodGroup()))
                .map(candidate -> new VolunteerMatch(candidate, 
                        distanceBetween(currentUser.getLatitude(), currentUser.getLongitude(), candidate.getLatitude(), candidate.getLongitude()), 0))
                .sorted(Comparator.comparingDouble(VolunteerMatch::distanceKm))
                .map(match -> {
                    Map<String, Object> volunteer = userViewMapper.toUserMap(match.user());
                    volunteer.put("distanceKm", Math.round(match.distanceKm() * 100.0) / 100.0);
                    return volunteer;
                })
                .toList();
    }

    public void notifyNearbyVolunteersForRequest(HelpRequest request) {
        if (request == null || !REQUEST_OPEN.equalsIgnoreCase(request.getStatus())) {
            return;
        }
        if (!hasLocation(request.getLatitude(), request.getLongitude())) {
            logger.debug("Skipping nearby volunteer matching because requestId={} has no coordinates yet.", request.getId());
            return;
        }

        List<VolunteerMatch> matches = rankVolunteerMatches(request, findNearbyVolunteerMatches(request))
                .stream()
                .limit(volunteerTopK)
                .toList();
        
        // Find tier based on match radiuses
        double primaryRadius = request.getDynamicRadiusKm() != null ? request.getDynamicRadiusKm() : 5.0;
        int tier = matches.stream().anyMatch(match -> match.radiusKm() > primaryRadius) ? 2 : 1;
        request.setCurrentTier(Math.max(request.getCurrentTier(), tier));
        
        helpRequestService.addTimelineEntry(request, "VOLUNTEER_NOTIFIED", matches.size() + " Nearby Volunteers Notified", "System");
        
        helpRequestRepository.save(request);

        for (VolunteerMatch match : matches) {
            boolean isRelay = match.radiusKm() > primaryRadius;
            
            RequestVolunteer assignment = requestVolunteerRepository.findByRequestIdAndVolunteerId(request.getId(), match.user().getId())
                    .orElseGet(RequestVolunteer::new);

            if (ASSIGNMENT_DECLINED.equalsIgnoreCase(assignment.getStatus())
                    || ASSIGNMENT_ACCEPTED.equalsIgnoreCase(assignment.getStatus())
                    || ASSIGNMENT_COMPLETED.equalsIgnoreCase(assignment.getStatus())) {
                continue;
            }

            assignment.setRequestId(request.getId());
            assignment.setVolunteerId(match.user().getId());
            assignment.setStatus(ASSIGNMENT_PENDING);
            assignment.setDistanceKm(match.distanceKm());
            assignment.setRadiusKm(match.radiusKm());
            requestVolunteerRepository.save(assignment);

            String title = isRelay ? "Relay Request: Please Help Coordinate" : "New nearby request";
            String body = isRelay 
                ? request.getTitle() + " needs help within " + match.radiusKm() + " km. You are a trusted volunteer, please coordinate!"
                : request.getTitle() + " needs help within " + match.radiusKm() + " km.";

            sendNotification(match.user(), NotificationType.REQUEST_CREATED_NEARBY, title, body, request);
        }
    }

    public Map<String, Object> acceptRequest(String requestId, User user) {
        User volunteer = requireVolunteerUser(user);
        HelpRequest saved = helpRequestService.acceptRequest(requestId, volunteer);
        mlMatchingEventService.markAccepted(requestId, volunteer.getId());
        notifyRequester(saved, "Volunteer assigned", volunteer.getFullName() + " accepted your request.");
        return requestViewMapper.toRequestMap(saved);
    }

    public Map<String, Object> declineRequest(String requestId, User user) {
        User volunteer = requireVolunteerUser(user);
        HelpRequest request = getRequest(requestId);
        ensureRequestHasCoordinates(request);

        RequestVolunteer assignment = requestVolunteerRepository.findByRequestIdAndVolunteerId(requestId, volunteer.getId())
                .orElseGet(RequestVolunteer::new);
        assignment.setRequestId(requestId);
        assignment.setVolunteerId(volunteer.getId());
        assignment.setStatus(ASSIGNMENT_DECLINED);
        assignment.setDistanceKm(distanceBetween(request.getLatitude(), request.getLongitude(),
                volunteer.getLatitude(), volunteer.getLongitude()));
        assignment.setRespondedAt(LocalDateTime.now());
        requestVolunteerRepository.save(assignment);

        Map<String, Object> response = new HashMap<>();
        response.put("requestId", requestId);
        response.put("status", ASSIGNMENT_DECLINED);
        return response;
    }

    public Map<String, Object> updateRequestProgress(String requestId, User user, String nextStatus) {
        User volunteer = requireVolunteerUser(user);
        String normalizedStatus = normalizeProgressStatus(nextStatus);

        HelpRequest saved = switch (normalizedStatus) {
            case "REQUEST_COMPLETION", "COMPLETION_REQUESTED", "PENDING_COMPLETION", "COMPLETED" ->
                    helpRequestService.requestCompletion(requestId, volunteer);
            default -> helpRequestService.updateProgress(requestId, volunteer, normalizedStatus);
        };
        notifyRequester(saved,
                "Volunteer update",
                volunteer.getFullName() + " updated your request.");
        return requestViewMapper.toRequestMap(saved);
    }

    public Map<String, Object> rateVolunteer(User requester, String requestId, String volunteerId, int rating, String feedback) {
        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5.");
        }

        HelpRequest request = getRequest(requestId);
        if (!REQUEST_COMPLETED.equalsIgnoreCase(request.getStatus())) {
            throw new IllegalArgumentException("Only completed requests can be rated.");
        }
        if (!requester.getId().equals(request.getRequesterId())) {
            throw new IllegalArgumentException("Only the requester can rate this volunteer.");
        }
        if (!StringUtils.hasText(request.getVolunteerId()) || !request.getVolunteerId().equals(volunteerId)) {
            throw new IllegalArgumentException("Volunteer information does not match this request.");
        }
        if (request.isRequesterRated() || volunteerRatingRepository.findByRequestIdAndVolunteerId(requestId, volunteerId).isPresent()) {
            throw new IllegalArgumentException("This volunteer has already been rated for the request.");
        }

        VolunteerRating volunteerRating = new VolunteerRating();
        volunteerRating.setRequestId(requestId);
        volunteerRating.setVolunteerId(volunteerId);
        volunteerRating.setRequesterId(requester.getId());
        volunteerRating.setRating(rating);
        volunteerRating.setFeedback(StringUtils.hasText(feedback) ? feedback.trim() : null);
        volunteerRatingRepository.save(volunteerRating);

        User volunteer = userRepository.findById(volunteerId)
                .orElseThrow(() -> new NoSuchElementException("Volunteer not found."));
        int currentRatingCount = volunteer.getRatingCount();
        double currentAverage = volunteer.getRating();
        double recalculatedRating = ((currentAverage * currentRatingCount) + rating) / (currentRatingCount + 1);
        volunteer.setRating(Math.round(recalculatedRating * 100.0) / 100.0);
        volunteer.setRatingCount(currentRatingCount + 1);
        volunteer.setTotalHelpCount(Math.max(volunteer.getTotalHelpCount(), volunteer.getRequestsHelped()) + 1);
        volunteer.setRequestsHelped(volunteer.getTotalHelpCount());
        userRepository.save(volunteer);

        request.setVolunteerRating(rating);
        request.setVolunteerFeedback(volunteerRating.getFeedback());
        request.setRequesterRated(true);
        request.setRequesterRatingPending(false);
        helpRequestRepository.save(request);

        Map<String, Object> response = new HashMap<>();
        response.put("request", requestViewMapper.toRequestMap(request));
        response.put("volunteer", userViewMapper.toUserMap(volunteer));
        return response;
    }

    public Map<String, Object> getVolunteerStats(User user) {
        User volunteer = requireVolunteerUser(user);
        int totalHelped = Math.max(volunteer.getTotalHelpCount(), volunteer.getRequestsHelped());
        List<User> volunteers = userRepository.findAll().stream()
                .filter(User::isVolunteer)
                .sorted(Comparator
                        .comparingInt((User current) -> Math.max(current.getTotalHelpCount(), current.getRequestsHelped())).reversed()
                        .thenComparing(User::getRating, Comparator.reverseOrder())
                        .thenComparing(User::getFullName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();

        int rank = 0;
        for (int index = 0; index < volunteers.size(); index++) {
            if (volunteer.getId().equals(volunteers.get(index).getId())) {
                rank = index + 1;
                break;
            }
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalHelped", totalHelped);
        stats.put("rating", volunteer.getRating());
        stats.put("rank", rank);
        stats.put("badges", VolunteerBadgeSupport.badgesFor(totalHelped));
        return stats;
    }

    public List<Map<String, Object>> getIncomingRequests(User user) {
        User volunteer = requireVolunteerUser(user);
        List<RequestVolunteer> pendingAssignments = requestVolunteerRepository
                .findByVolunteerIdAndStatusOrderByAssignedAtDesc(volunteer.getId(), ASSIGNMENT_PENDING);

        return pendingAssignments.stream()
                .map(assignment -> helpRequestRepository.findById(assignment.getRequestId())
                        .filter(request -> REQUEST_OPEN.equalsIgnoreCase(request.getStatus()))
                        .map(request -> requestViewMapper.toRequestMap(request, assignment.getDistanceKm()))
                        .orElse(null))
                .filter(Objects::nonNull)
                .toList();
    }

    public List<Map<String, Object>> getActiveRequests(User user) {
        User volunteer = requireVolunteerUser(user);
        return helpRequestRepository.findByVolunteerIdOrderByCreatedAtDesc(volunteer.getId()).stream()
                .filter(request -> REQUEST_ASSIGNED.equalsIgnoreCase(request.getStatus())
                        || REQUEST_ACTIVE.equalsIgnoreCase(request.getStatus())
                        || REQUEST_COMPLETION_REQUESTED.equalsIgnoreCase(request.getStatus()))
                .map(requestViewMapper::toRequestMap)
                .toList();
    }

    public List<Map<String, Object>> getCompletedRequests(User user) {
        User volunteer = requireVolunteerUser(user);
        return helpRequestRepository.findByVolunteerIdOrderByCreatedAtDesc(volunteer.getId()).stream()
                .filter(request -> REQUEST_COMPLETED.equalsIgnoreCase(request.getStatus()))
                .map(requestViewMapper::toRequestMap)
                .toList();
    }

    public HelpRequest completeLegacyRequest(String requestId, User user) {
        return helpRequestService.requestCompletion(requestId, user);
    }

    private HelpRequest getRequest(String requestId) {
        return helpRequestRepository.findById(requestId)
                .orElseThrow(() -> new NoSuchElementException("Request not found."));
    }

    private User requireVerifiedUser(User user) {
        if (user == null) {
            throw new IllegalArgumentException("Authenticated user was not resolved.");
        }
        if (!user.isVerified()) {
            throw new IllegalArgumentException("Only verified users can use volunteer features.");
        }
        return user;
    }

    private User requireVolunteerUser(User user) {
        User verifiedUser = requireVerifiedUser(user);
        if (!verifiedUser.isVolunteer()) {
            logger.warn("User {} is not in volunteer mode", verifiedUser.getId());
            throw new IllegalArgumentException("Enable volunteer mode first.");
        }
        return verifiedUser;
    }

    private String normalizeVolunteerStatus(String status) {
        String normalized = safeUpper(status);
        if (!VOLUNTEER_ONLINE.equals(normalized) && !VOLUNTEER_OFFLINE.equals(normalized)) {
            throw new IllegalArgumentException("Volunteer status must be ONLINE or OFFLINE.");
        }
        return normalized;
    }

    private List<String> normalizeVolunteerCategories(List<String> categories) {
        if (categories == null) {
            return List.of();
        }

        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String category : categories) {
            String value = safeUpper(category);
            if (!StringUtils.hasText(value)) {
                continue;
            }
            normalized.add(VolunteerCategory.canonicalize(value));
        }
        return new ArrayList<>(normalized);
    }

    private String normalizeProgressStatus(String status) {
        String normalized = safeUpper(status);
        if (!ALLOWED_PROGRESS.contains(normalized)) {
            throw new IllegalArgumentException("Request status must be ON_THE_WAY, REACHED, HELPING, or COMPLETION_REQUESTED.");
        }
        return normalized;
    }

    private List<VolunteerMatch> findNearbyVolunteerMatches(HelpRequest request) {
        ensureRequestHasCoordinates(request);
        double primaryRadius = request.getDynamicRadiusKm() != null ? request.getDynamicRadiusKm() : 5.0;
        double relayRadius = request.getRelayRadiusKm() != null ? request.getRelayRadiusKm() : 10.0;

        List<VolunteerMatch> immediateMatches = geospatialService.nearbyVolunteers(request, primaryRadius, 100).stream()
                .map(this::toVolunteerMatch)
                .filter(Objects::nonNull)
                .filter(match -> volunteerCanHandleCategory(match.user(), request))
                .toList();
        if (!immediateMatches.isEmpty()) {
            return immediateMatches;
        }

        return geospatialService.nearbyVolunteers(request, relayRadius, 100).stream()
                .map(this::toVolunteerMatch)
                .filter(Objects::nonNull)
                .filter(match -> volunteerCanHandleCategory(match.user(), request))
                .filter(match -> match.user().getRating() >= 4.5 && match.user().getRequestsHelped() > 5)
                .toList();
    }

    private List<VolunteerMatch> rankVolunteerMatches(HelpRequest request, List<VolunteerMatch> matches) {
        if (matches == null || matches.isEmpty()) {
            return List.of();
        }
        List<MlIntelligenceService.VolunteerCandidate> candidates = matches.stream()
                .map(match -> mlIntelligenceService.candidateFor(request, match.user(), match.distanceKm()))
                .toList();
        List<MlIntelligenceService.RankedVolunteer> ranked = mlIntelligenceService.rankVolunteers(request, candidates);
        if (ranked.isEmpty()) {
            return matches;
        }

        Map<String, VolunteerMatch> byVolunteerId = new HashMap<>();
        matches.forEach(match -> byVolunteerId.put(match.user().getId(), match));
        List<VolunteerMatch> ordered = new ArrayList<>();
        List<Map<String, Object>> rankingEvents = new ArrayList<>();
        String modelVersion = ranked.get(0).modelVersion();
        String rankingMode = ranked.get(0).rankingMode();

        for (MlIntelligenceService.RankedVolunteer item : ranked) {
            VolunteerMatch match = byVolunteerId.remove(item.userId());
            if (match == null) continue;
            ordered.add(match);
            Map<String, Object> event = new HashMap<>();
            event.put("userId", item.userId());
            event.put("score", item.score());
            event.put("rank", item.rank());
            event.put("matchScore", item.matchScore());
            rankingEvents.add(event);
        }
        ordered.addAll(byVolunteerId.values());
        mlMatchingEventService.recordRanking(request.getId(), rankingEvents, modelVersion, rankingMode);
        return ordered;
    }

    private VolunteerMatch toVolunteerMatch(NearbyVolunteerCandidate candidate) {
        if (candidate == null || candidate.volunteerId() == null || candidate.distanceKm() == null) return null;
        return userRepository.findById(candidate.volunteerId())
                .filter(User::isVolunteer)
                .filter(User::isVerified)
                .filter(user -> "ACTIVE".equalsIgnoreCase(user.getAccountStatus()))
                .filter(user -> VOLUNTEER_ONLINE.equalsIgnoreCase(user.getVolunteerStatus()))
                .filter(user -> hasLocation(user.getLatitude(), user.getLongitude()))
                .map(user -> new VolunteerMatch(user, candidate.distanceKm(), candidate.distanceKm() <= 5.0d ? 5.0d : 10.0d))
                .orElse(null);
    }

    private VolunteerMatch ensureVolunteerCanHandleRequest(HelpRequest request, User volunteer) {
        ensureRequestHasCoordinates(request);
        if (!volunteerCanHandleCategory(volunteer, request)) {
            throw new IllegalArgumentException("This request does not match your volunteer categories or skills.");
        }
        if (!hasLocation(volunteer.getLatitude(), volunteer.getLongitude())) {
            throw new IllegalArgumentException("Update your volunteer location before accepting requests.");
        }
        double distanceKm = distanceBetween(request.getLatitude(), request.getLongitude(), volunteer.getLatitude(), volunteer.getLongitude());
        double primaryRadius = request.getDynamicRadiusKm() != null ? request.getDynamicRadiusKm() : 5.0;
        double relayRadius = request.getRelayRadiusKm() != null ? request.getRelayRadiusKm() : 10.0;
        if (distanceKm > relayRadius) {
            logger.warn("User {} is too far from request {}", volunteer.getId(), request.getId());
            throw new IllegalArgumentException("This request is outside the volunteer radius.");
        }
        
        return new VolunteerMatch(volunteer, distanceKm, distanceKm <= primaryRadius ? primaryRadius : relayRadius);
    }

    private boolean volunteerCanHandleCategory(User volunteer, HelpRequest request) {
        List<String> categories = volunteer.getVolunteerCategories();
        if (categories == null || categories.isEmpty()) {
            return false;
        }
        
        boolean canHandleCategory = categories.contains(mapRequestCategoryToVolunteerCategory(request.getCategory()));
        if (!canHandleCategory) return false;
        
        if (request.getCategory() != null && request.getCategory().contains("BLOOD")) {
            if (!volunteer.isBloodDonor()) return false;
            if (StringUtils.hasText(request.getRequiredBloodGroup())) {
                return isBloodCompatible(request.getRequiredBloodGroup(), volunteer.getBloodGroup());
            }
        }
        
        // Skill matching logic
        if (StringUtils.hasText(request.getRequiredSkill())) {
            String requiredSkill = request.getRequiredSkill().toUpperCase();
            boolean hasSkill = volunteer.getSkills().stream()
                    .anyMatch(s -> s.name().equals(requiredSkill));
            if (!hasSkill) return false;
        }
        
        return true;
    }

    private List<VolunteerMatch> filterMatchesByRadius(HelpRequest request, List<User> candidates, double radiusKm) {
        return candidates.stream()
                .map(candidate -> new VolunteerMatch(
                        candidate,
                        distanceBetween(request.getLatitude(), request.getLongitude(),
                                candidate.getLatitude(), candidate.getLongitude()),
                        radiusKm))
                .filter(match -> match.distanceKm() <= radiusKm)
                .sorted(Comparator.comparingDouble(VolunteerMatch::distanceKm))
                .toList();
    }

    private String mapRequestCategoryToVolunteerCategory(String requestCategory) {
        String normalized = safeUpper(requestCategory);
        if (normalized.contains("BLOOD")) {
            return VolunteerCategory.BLOOD_DONATION.name();
        }
        if (normalized.contains("MEDICAL")) {
            return VolunteerCategory.MEDICAL.name();
        }
        if (normalized.contains("FOOD")) {
            return VolunteerCategory.FOOD.name();
        }
        if (normalized.contains("TRANSPORT")) {
            return VolunteerCategory.TRANSPORT.name();
        }
        if (normalized.contains("EMERGENCY") || normalized.contains("CRITICAL")) {
            return VolunteerCategory.EMERGENCY.name();
        }
        return VolunteerCategory.GENERAL.name();
    }

    private boolean isBloodCompatible(String required, String donor) {
        if (!StringUtils.hasText(required) || !StringUtils.hasText(donor)) {
            return false;
        }
        String r = safeUpper(required).replace(" POSITIVE", "+").replace(" NEGATIVE", "-");
        String d = safeUpper(donor).replace(" POSITIVE", "+").replace(" NEGATIVE", "-");

        return switch (r) {
            case "A+" -> List.of("A+", "A-", "O+", "O-").contains(d);
            case "O+" -> List.of("O+", "O-").contains(d);
            case "B+" -> List.of("B+", "B-", "O+", "O-").contains(d);
            case "AB+" -> true; // Universal recipient
            case "A-" -> List.of("A-", "O-").contains(d);
            case "O-" -> "O-".equals(d);
            case "B-" -> List.of("B-", "O-").contains(d);
            case "AB-" -> List.of("AB-", "A-", "B-", "O-").contains(d);
            default -> r.equals(d);
        };
    }

    private boolean hasLocation(Double latitude, Double longitude) {
        return latitude != null && longitude != null;
    }

    private void ensureRequestHasCoordinates(HelpRequest request) {
        if (!hasLocation(request.getLatitude(), request.getLongitude())) {
            throw new IllegalArgumentException("This request does not have a usable location yet.");
        }
    }

    private double distanceBetween(double requestLatitude, double requestLongitude,
                                   double volunteerLatitude, double volunteerLongitude) {
        double earthRadiusKm = 6371.0d;
        double latitudeDistance = Math.toRadians(volunteerLatitude - requestLatitude);
        double longitudeDistance = Math.toRadians(volunteerLongitude - requestLongitude);
        double latitude1 = Math.toRadians(requestLatitude);
        double latitude2 = Math.toRadians(volunteerLatitude);

        double haversine = Math.sin(latitudeDistance / 2) * Math.sin(latitudeDistance / 2)
                + Math.cos(latitude1) * Math.cos(latitude2)
                * Math.sin(longitudeDistance / 2) * Math.sin(longitudeDistance / 2);
        double centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
        return earthRadiusKm * centralAngle;
    }

    private void notifyRequester(HelpRequest request, String title, String body) {
        if (!StringUtils.hasText(request.getRequesterId())) {
            return;
        }
        userRepository.findById(request.getRequesterId()).ifPresent(user ->
                sendNotification(user, NotificationType.REQUEST_PROGRESS_UPDATED, title, body, request));
    }

    private void sendNotification(User user, NotificationType type, String title, String body, HelpRequest request) {
        if (user == null) {
            return;
        }

        try {
            notificationService.notifyUser(NotificationService.NotificationCommand.builder()
                    .recipientUserId(user.getId())
                    .type(type)
                    .category(NotificationCategory.REQUEST)
                    .priority(request != null && "CRITICAL".equalsIgnoreCase(request.getUrgency()) ? NotificationPriority.URGENT : NotificationPriority.NORMAL)
                    .title(title)
                    .body(body)
                    .entityType("HELP_REQUEST")
                    .entityId(request == null ? null : request.getId())
                    .actionUrl(request == null ? null : "/request/" + request.getId())
                    .deduplicationKey(type + ":" + (request == null ? "unknown" : request.getId()) + ":" + user.getId())
                    .build());
        } catch (RuntimeException exception) {
            logger.warn("Failed to queue volunteer notification for userId={}: {}", user.getId(), exception.getMessage());
        }
    }

    private String safeUpper(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private record VolunteerMatch(User user, double distanceKm, double radiusKm) {
    }
}
