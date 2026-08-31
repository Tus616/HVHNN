package com.hvhn.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.RequestVolunteer;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.RequestVolunteerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class MlIntelligenceService {
    private static final Logger logger = LoggerFactory.getLogger(MlIntelligenceService.class);

    private final boolean enabled;
    private final String serviceUrl;
    private final ObjectMapper objectMapper;
    private final HelpRequestRepository requestRepository;
    private final RequestVolunteerRepository requestVolunteerRepository;
    private final HttpClient httpClient;
    private final Duration requestTimeout;

    public MlIntelligenceService(
            @Value("${ml.enabled:true}") boolean enabled,
            @Value("${ml.service-url:http://localhost:8001}") String serviceUrl,
            @Value("${ml.request-timeout-seconds:3}") int timeoutSeconds,
            ObjectMapper objectMapper,
            HelpRequestRepository requestRepository,
            RequestVolunteerRepository requestVolunteerRepository
    ) {
        this.enabled = enabled;
        this.serviceUrl = trimTrailingSlash(serviceUrl);
        this.objectMapper = objectMapper;
        this.requestRepository = requestRepository;
        this.requestVolunteerRepository = requestVolunteerRepository;
        this.requestTimeout = Duration.ofSeconds(Math.max(1, timeoutSeconds));
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public Map<String, Object> health() {
        return postOrGet("/health", null).orElse(Map.of("status", "unavailable", "enabled", enabled));
    }

    public Map<String, Object> analyzeRequest(String title, String description) {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("available", false);
        fallback.put("modelVersion", "fallback");
        fallback.put("predictedCategory", null);
        fallback.put("categoryConfidence", 0.0);
        fallback.put("predictedUrgency", null);
        fallback.put("urgencyConfidence", 0.0);
        fallback.put("suggestionAvailable", false);
        fallback.put("categorySuggestionAvailable", false);
        fallback.put("urgencySuggestionAvailable", false);
        fallback.put("urgencySource", "FALLBACK");
        Map<String, Object> body = new HashMap<>();
        body.put("title", safeText(title, 180));
        body.put("description", safeText(description, 4000));
        return postOrGet("/predict/request", body).map(response -> {
            response.put("available", true);
            return response;
        }).orElse(fallback);
    }

    public Map<String, Object> detectDuplicate(HelpRequest draft) {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("available", false);
        fallback.put("duplicateLikely", false);
        fallback.put("overallScore", 0.0);
        fallback.put("textSimilarity", 0.0);
        fallback.put("similarityScore", 0.0);
        fallback.put("matchingRequestId", null);
        fallback.put("threshold", 0.60);
        fallback.put("reason", null);

        Map<String, Object> body = new HashMap<>();
        body.put("title", safeText(draft.getTitle(), 180));
        body.put("description", safeText(draft.getDescription(), 4000));
        body.put("category", draft.getCategory());
        body.put("city", draft.getCity());
        body.put("district", draft.getDistrict());
        body.put("state", draft.getState());
        body.put("candidates", duplicateCandidates(draft));
        return postOrGet("/detect/duplicate", body).map(response -> {
            response.put("available", true);
            return response;
        }).orElse(fallback);
    }

    public Map<String, Object> searchRequests(String query, List<Map<String, Object>> candidates) {
        Map<String, Object> fallback = new HashMap<>();
        fallback.put("available", false);
        fallback.put("modelVersion", "fallback");
        fallback.put("implementation", "keyword fallback");
        fallback.put("results", List.of());
        if (!StringUtils.hasText(query) || candidates == null || candidates.isEmpty()) {
            return fallback;
        }
        Map<String, Object> body = new HashMap<>();
        body.put("query", safeText(query, 400));
        body.put("candidates", candidates.stream()
                .limit(100)
                .map(candidate -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("requestId", String.valueOf(candidate.getOrDefault("id", candidate.getOrDefault("requestId", ""))));
                    item.put("title", safeText(String.valueOf(candidate.getOrDefault("title", "")), 180));
                    item.put("description", safeText(String.valueOf(candidate.getOrDefault("description", "")), 1000));
                    item.put("category", String.valueOf(candidate.getOrDefault("category", "")));
                    item.put("status", String.valueOf(candidate.getOrDefault("status", "OPEN")));
                    return item;
                })
                .filter(item -> StringUtils.hasText(String.valueOf(item.get("requestId"))))
                .toList());
        return postOrGet("/search/requests", body).map(response -> {
            response.put("available", true);
            return response;
        }).orElse(fallback);
    }

    public List<RankedVolunteer> rankVolunteers(HelpRequest request, List<VolunteerCandidate> candidates) {
        if (candidates == null || candidates.isEmpty()) return List.of();
        Map<String, Object> body = new HashMap<>();
        body.put("requestId", request.getId());
        body.put("category", request.getCategory());
        body.put("urgency", request.getUrgency());
        body.put("candidates", candidates.stream().map(VolunteerCandidate::features).toList());
        Optional<Map<String, Object>> response = postOrGet("/rank/volunteers", body);
        if (response.isPresent() && response.get().get("rankedVolunteers") instanceof List<?> raw) {
            List<RankedVolunteer> ranked = new ArrayList<>();
            for (Object item : raw) {
                if (item instanceof Map<?, ?> map) {
                    ranked.add(new RankedVolunteer(
                            String.valueOf(map.get("userId")),
                            toDouble(map.get("score"), 0),
                            toInt(map.get("rank"), ranked.size() + 1),
                            toInt(map.get("matchScore"), (int) Math.round(toDouble(map.get("score"), 0) * 100)),
                            stringList(map.get("reasons")),
                            String.valueOf(response.get().getOrDefault("modelVersion", "phase10-volunteer-ranker-v1")),
                            String.valueOf(response.get().getOrDefault("rankingMode", "BOOTSTRAP_RANKING"))
                    ));
                }
            }
            if (!ranked.isEmpty()) return ranked;
        }
        List<VolunteerCandidate> ordered = candidates.stream()
                .sorted(Comparator.comparingDouble((VolunteerCandidate candidate) -> bootstrapScore(candidate, request)).reversed())
                .toList();
        List<RankedVolunteer> fallbackRanked = new ArrayList<>();
        for (int index = 0; index < ordered.size(); index += 1) {
            VolunteerCandidate candidate = ordered.get(index);
            fallbackRanked.add(new RankedVolunteer(
                    candidate.userId(),
                    bootstrapScore(candidate, request),
                    index + 1,
                    (int) Math.round(bootstrapScore(candidate, request) * 100),
                    candidate.reasons(),
                    "phase10-volunteer-ranker-v1",
                    "BOOTSTRAP_RANKING"
            ));
        }
        return fallbackRanked;
    }

    public VolunteerCandidate candidateFor(HelpRequest request, User user, double distanceKm) {
        List<RequestVolunteer> history = requestVolunteerRepository.findByVolunteerIdOrderByAssignedAtDesc(user.getId());
        long accepted = history.stream().filter(event -> "ACCEPTED".equalsIgnoreCase(event.getStatus()) || "COMPLETED".equalsIgnoreCase(event.getStatus())).count();
        long completed = history.stream().filter(event -> "COMPLETED".equalsIgnoreCase(event.getStatus())).count();
        double completionRate = accepted == 0 ? 0.0 : (double) completed / accepted;
        double acceptanceRate = history.isEmpty() ? 0.0 : (double) accepted / history.size();
        boolean categoryMatch = user.getVolunteerCategories() != null && user.getVolunteerCategories().contains(normalize(request.getCategory()));
        boolean skillMatch = !StringUtils.hasText(request.getRequiredSkill()) || user.getSkills().stream().anyMatch(skill -> skill.name().equalsIgnoreCase(request.getRequiredSkill()));
        boolean available = "ONLINE".equalsIgnoreCase(user.getVolunteerStatus()) || user.isAlwaysAvailable();
        boolean sameCity = sameText(request.getCity(), user.getCity());
        boolean sameDistrict = sameText(request.getDistrict(), user.getDistrict());
        Double recentDays = user.getLastHelpDate() == null ? null : (double) Math.max(0, Duration.between(user.getLastHelpDate(), LocalDateTime.now()).toDays());
        double categorySuccess = categorySuccessRate(user.getId(), request.getCategory(), history);
        double areaSuccess = areaSuccessRate(user.getId(), request, history);
        return new VolunteerCandidate(user.getId(), distanceKm, categoryMatch, skillMatch, available, available, user.isVolunteer(),
                Math.max(user.getTotalHelpCount(), user.getRequestsHelped()), (int) accepted, completionRate, acceptanceRate,
                categorySuccess, areaSuccess, user.getRating(), sameCity, sameDistrict, recentDays);
    }

    private Optional<Map<String, Object>> postOrGet(String path, Map<String, Object> body) {
        if (!enabled) return Optional.empty();
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(serviceUrl + path))
                    .timeout(requestTimeout)
                    .header("Content-Type", "application/json");
            HttpRequest request = body == null
                    ? builder.GET().build()
                    : builder.POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body))).build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) return Optional.empty();
            return Optional.of(objectMapper.readValue(response.body(), new TypeReference<>() {}));
        } catch (Exception exception) {
            logger.debug("ML service unavailable for {}: {}", path, exception.getMessage());
            return Optional.empty();
        }
    }

    private List<Map<String, Object>> duplicateCandidates(HelpRequest draft) {
        return requestRepository.findByStatus("OPEN").stream()
                .filter(request -> StringUtils.hasText(request.getTitle()))
                .filter(request -> !StringUtils.hasText(draft.getRequesterId()) || !draft.getRequesterId().equals(request.getRequesterId()))
                .filter(request -> !StringUtils.hasText(draft.getCategory()) || !StringUtils.hasText(request.getCategory()) || normalize(draft.getCategory()).equals(normalize(request.getCategory())))
                .filter(request -> sameText(draft.getCity(), request.getCity()) || sameText(draft.getDistrict(), request.getDistrict()) || sameText(draft.getState(), request.getState()) || !StringUtils.hasText(draft.getState()))
                .limit(40)
                .map(request -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("id", request.getId());
                    item.put("title", safeText(request.getTitle(), 180));
                    item.put("description", safeText(request.getDescription(), 1000));
                    item.put("category", request.getCategory());
                    item.put("status", request.getStatus());
                    item.put("city", request.getCity());
                    item.put("district", request.getDistrict());
                    item.put("state", request.getState());
                    item.put("createdAt", request.getCreatedAt() != null ? request.getCreatedAt().toString() : null);
                    if (hasCoordinates(draft) && hasCoordinates(request)) {
                        item.put("distanceKm", distanceBetween(draft.getLatitude(), draft.getLongitude(), request.getLatitude(), request.getLongitude()));
                    }
                    return item;
                })
                .toList();
    }

    private double bootstrapScore(VolunteerCandidate candidate, HelpRequest request) {
        double distance = 1.0 / (1.0 + Math.max(candidate.distanceKm(), 0.0) / 5.0);
        return Math.min(1.0, (candidate.categoryMatch() ? 0.24 : 0) + (candidate.skillMatch() ? 0.08 : 0) + distance * 0.22 + (candidate.available() ? 0.16 : 0) + candidate.completionRate() * 0.12 + candidate.acceptanceRate() * 0.08 + Math.min(candidate.rating() / 5.0, 1.0) * 0.05);
    }

    private String safeText(String value, int limit) {
        String text = value == null ? "" : value.trim();
        return text.length() <= limit ? text : text.substring(0, limit);
    }

    private String trimTrailingSlash(String value) {
        String text = StringUtils.hasText(value) ? value.trim() : "http://localhost:8001";
        return text.endsWith("/") ? text.substring(0, text.length() - 1) : text;
    }

    private boolean hasCoordinates(HelpRequest request) {
        return request.getLatitude() != null && request.getLongitude() != null;
    }

    private double distanceBetween(double lat1, double lon1, double lat2, double lon2) {
        double earth = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100.0) / 100.0;
    }

    private boolean sameText(String left, String right) {
        return StringUtils.hasText(left) && StringUtils.hasText(right) && left.trim().equalsIgnoreCase(right.trim());
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private double toDouble(Object value, double fallback) {
        if (value instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(String.valueOf(value)); } catch (RuntimeException ignored) { return fallback; }
    }

    private int toInt(Object value, int fallback) {
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (RuntimeException ignored) { return fallback; }
    }

    private List<String> stringList(Object value) {
        if (value instanceof List<?> list) return list.stream().map(String::valueOf).toList();
        return List.of("Eligible volunteer");
    }

    public record VolunteerCandidate(String userId, double distanceKm, boolean categoryMatch, boolean skillMatch,
                                     boolean available, boolean availabilityMatch, boolean volunteerMode,
                                     int completedHelps, int acceptanceCount, double completionRate,
                                     double acceptanceRate, double historicalSuccessForCategory,
                                     double historicalSuccessForArea, double rating, boolean sameCity,
                                     boolean sameDistrict, Double recentActivityDays) {
        Map<String, Object> features() {
            Map<String, Object> map = new HashMap<>();
            map.put("userId", userId);
            map.put("distanceKm", distanceKm);
            map.put("categoryMatch", categoryMatch);
            map.put("skillMatch", skillMatch);
            map.put("available", available);
            map.put("availabilityMatch", availabilityMatch);
            map.put("volunteerMode", volunteerMode);
            map.put("completedHelps", completedHelps);
            map.put("acceptanceCount", acceptanceCount);
            map.put("completionRate", completionRate);
            map.put("acceptanceRate", acceptanceRate);
            map.put("historicalSuccessForCategory", historicalSuccessForCategory);
            map.put("historicalSuccessForArea", historicalSuccessForArea);
            map.put("rating", rating);
            map.put("sameCity", sameCity);
            map.put("sameDistrict", sameDistrict);
            map.put("recentActivityDays", recentActivityDays);
            return map;
        }

        List<String> reasons() {
            List<String> reasons = new ArrayList<>();
            if (categoryMatch) reasons.add("Category match");
            reasons.add(String.format(Locale.ROOT, "%.1f km away", distanceKm));
            if (available) reasons.add("Available now");
            if (completionRate >= 0.75 || completedHelps >= 5) reasons.add(String.format(Locale.ROOT, "%.0f%% completion reliability", completionRate * 100));
            if (rating >= 4.0) reasons.add("Strong rating");
            return reasons.stream().limit(4).toList();
        }
    }

    private double categorySuccessRate(String userId, String category, List<RequestVolunteer> history) {
        if (!StringUtils.hasText(category) || history == null || history.isEmpty()) return 0.0;
        long total = 0;
        long completed = 0;
        for (RequestVolunteer event : history.stream().limit(50).toList()) {
            Optional<HelpRequest> request = requestRepository.findById(event.getRequestId());
            if (request.isPresent() && sameText(category, request.get().getCategory())) {
                total += 1;
                if ("COMPLETED".equalsIgnoreCase(event.getStatus())) completed += 1;
            }
        }
        return total == 0 ? 0.0 : (double) completed / total;
    }

    private double areaSuccessRate(String userId, HelpRequest target, List<RequestVolunteer> history) {
        if (target == null || history == null || history.isEmpty()) return 0.0;
        long total = 0;
        long completed = 0;
        for (RequestVolunteer event : history.stream().limit(50).toList()) {
            Optional<HelpRequest> request = requestRepository.findById(event.getRequestId());
            if (request.isPresent() && (sameText(target.getCity(), request.get().getCity()) || sameText(target.getDistrict(), request.get().getDistrict()))) {
                total += 1;
                if ("COMPLETED".equalsIgnoreCase(event.getStatus())) completed += 1;
            }
        }
        return total == 0 ? 0.0 : (double) completed / total;
    }

    public record RankedVolunteer(String userId, double score, int rank, int matchScore, List<String> reasons, String modelVersion, String rankingMode) {}
}
