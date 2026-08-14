package com.hvhn.backend.controller;

import com.hvhn.backend.model.EmergencyContact;
import com.hvhn.backend.model.User;
import com.hvhn.backend.dto.OnboardingRequest;
import com.hvhn.backend.model.enums.VolunteerSkill;
import com.hvhn.backend.model.enums.VolunteerCategory;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.service.LocationService;
import com.hvhn.backend.service.UserViewMapper;
import com.mongodb.BasicDBObject;
import com.mongodb.client.gridfs.model.GridFSFile;
import jakarta.validation.Valid;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsResource;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Map;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final UserViewMapper userViewMapper;
    private final LocationService locationService;
    private final GridFsTemplate gridFsTemplate;
    private static final long MAX_AVATAR_BYTES = 2L * 1024L * 1024L;
    private static final Set<String> ALLOWED_AVATAR_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    public UserController(UserRepository userRepository, UserViewMapper userViewMapper, LocationService locationService, GridFsTemplate gridFsTemplate) {
        this.userRepository = userRepository;
        this.userViewMapper = userViewMapper;
        this.locationService = locationService;
        this.gridFsTemplate = gridFsTemplate;
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getProfile(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(userViewMapper.toUserMap(requireAuthenticatedUser(user)));
    }

    @PutMapping("/me")
    public ResponseEntity<Map<String, Object>> updateProfileAlias(
            @Valid @RequestBody com.hvhn.backend.dto.ProfileUpdateRequest request,
            @AuthenticationPrincipal User user) {
        return updateProfile(request, user);
    }

    @PutMapping("/me/profile")
    public ResponseEntity<Map<String, Object>> updateProfile(
            @Valid @RequestBody com.hvhn.backend.dto.ProfileUpdateRequest request,
            @AuthenticationPrincipal User user) {
        User authenticatedUser = requireAuthenticatedUser(user);
        
        if (request.getFullName() != null) authenticatedUser.setFullName(request.getFullName());
        if (request.getPhone() != null) authenticatedUser.setPhone(request.getPhone());
        if (request.getAddress() != null) authenticatedUser.setAddress(request.getAddress());
        if (request.getCity() != null) authenticatedUser.setCity(locationService.normalizeArea(request.getCity()));
        if (request.getDistrict() != null) authenticatedUser.setDistrict(locationService.normalizeArea(request.getDistrict()));
        if (request.getState() != null) authenticatedUser.setState(locationService.normalizeArea(request.getState()));
        if (request.getPostalCode() != null) authenticatedUser.setPostalCode(locationService.normalizeArea(request.getPostalCode()));
        if (request.getBio() != null) authenticatedUser.setBio(request.getBio());
        if (Boolean.TRUE.equals(request.getClearLocation())) {
            authenticatedUser.setLatitude(null);
            authenticatedUser.setLongitude(null);
            authenticatedUser.setLocation(null);
            authenticatedUser.setLocationSource(LocationService.SOURCE_UNKNOWN);
            authenticatedUser.setLocationUpdatedAt(null);
        }
        if (request.getLatitude() != null || request.getLongitude() != null) {
            validateCoordinates(request.getLatitude(), request.getLongitude());
            authenticatedUser.setLatitude(request.getLatitude());
            authenticatedUser.setLongitude(request.getLongitude());
            authenticatedUser.setLocation(locationService.point(request.getLatitude(), request.getLongitude()));
            authenticatedUser.setLocationSource(locationService.normalizeSource(request.getLocationSource(), LocationService.SOURCE_MANUAL));
            authenticatedUser.setLocationUpdatedAt(LocalDateTime.now());
        }
        
        authenticatedUser.setBloodGroup(request.getBloodGroup());
        authenticatedUser.setBloodDonor(request.getIsBloodDonor());
        authenticatedUser.setUpdatedAt(LocalDateTime.now());
        
        userRepository.save(authenticatedUser);
        return ResponseEntity.ok(userViewMapper.toUserMap(authenticatedUser));
    }

    @PutMapping("/me/onboarding")
    public ResponseEntity<Map<String, Object>> completeOnboarding(
            @Valid @RequestBody OnboardingRequest request,
            @AuthenticationPrincipal User user
    ) {
        User authenticatedUser = requireAuthenticatedUser(user);
        if (!hasText(request.getFullName()) && !hasText(authenticatedUser.getFullName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Full name is required.");
        }
        if (!hasText(request.getPhone()) && !hasText(authenticatedUser.getPhone())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone is required.");
        }
        validateCoordinates(request.getLatitude(), request.getLongitude());

        List<String> categories = canonicalCategories(request.getVolunteerCategories());
        if (request.isVolunteerEnabled() && categories.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose at least one volunteer category.");
        }

        if (hasText(request.getFullName())) authenticatedUser.setFullName(request.getFullName().trim());
        if (hasText(request.getPhone())) authenticatedUser.setPhone(request.getPhone().trim());
        authenticatedUser.setBio(trimToNull(request.getBio()));
        authenticatedUser.setAddress(trimToNull(request.getAddress()));
        authenticatedUser.setCity(locationService.normalizeArea(request.getCity()));
        authenticatedUser.setDistrict(locationService.normalizeArea(request.getDistrict()));
        authenticatedUser.setState(locationService.normalizeArea(request.getState()));
        authenticatedUser.setPostalCode(locationService.normalizeArea(request.getPostalCode()));
        authenticatedUser.setLatitude(request.getLatitude());
        authenticatedUser.setLongitude(request.getLongitude());
        authenticatedUser.setLocation(locationService.point(request.getLatitude(), request.getLongitude()));
        authenticatedUser.setLocationSource(locationService.normalizeSource(request.getLocationSource(), request.getLatitude() != null ? LocationService.SOURCE_MANUAL : LocationService.SOURCE_UNKNOWN));
        authenticatedUser.setLocationUpdatedAt(locationService.nowIfLocated(authenticatedUser.getLocation()));
        authenticatedUser.setVolunteer(request.isVolunteerEnabled());
        authenticatedUser.setVolunteerCategories(request.isVolunteerEnabled() ? categories : List.of());
        authenticatedUser.setVolunteerStatus(request.isVolunteerEnabled() ? authenticatedUser.getVolunteerStatus() : "OFFLINE");
        if (request.isVolunteerEnabled()) {
            authenticatedUser.setVolunteerSetupCompletedAt(LocalDateTime.now());
        }
        authenticatedUser.setOnboardingCompleted(true);
        if (authenticatedUser.getOnboardingCompletedAt() == null) {
            authenticatedUser.setOnboardingCompletedAt(LocalDateTime.now());
        }
        authenticatedUser.setUpdatedAt(LocalDateTime.now());

        return ResponseEntity.ok(userViewMapper.toUserMap(userRepository.save(authenticatedUser)));
    }

    @PutMapping("/skills")
    public ResponseEntity<Map<String, Object>> updateSkills(
            @RequestBody Map<String, List<String>> payload,
            @AuthenticationPrincipal User user) {
        User authenticatedUser = requireAuthenticatedUser(user);
        List<String> skillStrings = payload.get("skills");
        
        if (skillStrings != null) {
            List<VolunteerSkill> skills = skillStrings.stream()
                    .map(s -> {
                        try {
                            return VolunteerSkill.valueOf(s.toUpperCase());
                        } catch (IllegalArgumentException e) {
                            return null;
                        }
                    })
                    .filter(java.util.Objects::nonNull)
                    .toList();
            authenticatedUser.setSkills(skills);
            userRepository.save(authenticatedUser);
        }
        
        return ResponseEntity.ok(userViewMapper.toUserMap(authenticatedUser));
    }

    @PutMapping("/emergency-contacts")
    public ResponseEntity<Map<String, Object>> updateEmergencyContacts(
            @RequestBody Map<String, List<EmergencyContact>> payload,
            @AuthenticationPrincipal User user) {
        User authenticatedUser = requireAuthenticatedUser(user);
        List<EmergencyContact> contacts = payload.get("contacts");

        if (contacts != null) {
            if (contacts.size() > 3) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Maximum 3 emergency contacts allowed");
            }
            authenticatedUser.setEmergencyContacts(contacts);
            userRepository.save(authenticatedUser);
        }

        return ResponseEntity.ok(userViewMapper.toUserMap(authenticatedUser));
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<List<Map<String, Object>>> getLeaderboard() {
        List<User> users = userRepository.findAll();
        users.sort((a, b) -> Integer.compare(b.getPoints(), a.getPoints()));
        List<Map<String, Object>> leaderboard = users.stream()
                .limit(20)
                .map(userViewMapper::toUserMap)
                .toList();
        return ResponseEntity.ok(leaderboard);
    }

    @GetMapping("/impact")
    public ResponseEntity<Map<String, Object>> getImpactStats(@AuthenticationPrincipal User user) {
        User authenticatedUser = requireAuthenticatedUser(user);
        Map<String, Object> impact = new java.util.HashMap<>();
        impact.put("currentStreak", authenticatedUser.getCurrentStreak());
        impact.put("longestStreak", authenticatedUser.getLongestStreak());
        impact.put("totalDistanceTraveled", Math.round(authenticatedUser.getTotalDistanceTraveled() * 100.0) / 100.0);
        impact.put("totalPeopleHelped", authenticatedUser.getTotalPeopleHelped());
        impact.put("points", authenticatedUser.getPoints());
        return ResponseEntity.ok(impact);
    }

    @PutMapping("/volunteer/schedule")
    public ResponseEntity<Map<String, Object>> updateVolunteerSchedule(
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal User user) {
        User authenticatedUser = requireAuthenticatedUser(user);
        
        if (payload.containsKey("isAlwaysAvailable")) {
            authenticatedUser.setAlwaysAvailable((Boolean) payload.get("isAlwaysAvailable"));
        }
        
        if (payload.containsKey("schedule")) {
            List<Map<String, Object>> scheduleList = (List<Map<String, Object>>) payload.get("schedule");
            List<com.hvhn.backend.model.AvailabilityEntry> entries = scheduleList.stream()
                .map(m -> new com.hvhn.backend.model.AvailabilityEntry(
                    (String) m.get("day"),
                    (String) m.get("startTime"),
                    (String) m.get("endTime"),
                    (Boolean) m.get("enabled")
                ))
                .toList();
            authenticatedUser.setAvailabilitySchedule(entries);
        }
        
        userRepository.save(authenticatedUser);
        return ResponseEntity.ok(userViewMapper.toUserMap(authenticatedUser));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable String id) {
        return userRepository.findById(id)
                .map(user -> ResponseEntity.ok(userViewMapper.toUserMap(user)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadAvatar(@AuthenticationPrincipal User user,
                                                            @RequestParam("file") MultipartFile file) throws IOException {
        User authenticatedUser = requireAuthenticatedUser(user);
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an avatar image.");
        }
        String contentType = file.getContentType();
        if (!ALLOWED_AVATAR_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Avatar must be JPG, PNG, or WebP.");
        }
        if (file.getSize() > MAX_AVATAR_BYTES) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Avatar must be 2 MB or smaller.");
        }

        deleteAvatarFiles(authenticatedUser.getId());
        BasicDBObject metadata = new BasicDBObject();
        metadata.put("ownerUserId", authenticatedUser.getId());
        metadata.put("contentType", contentType);
        metadata.put("createdAt", LocalDateTime.now().toString());
        gridFsTemplate.store(file.getInputStream(), "avatar-" + authenticatedUser.getId(), contentType, metadata);

        String avatarUrl = "/api/users/" + authenticatedUser.getId() + "/avatar?v=" + System.currentTimeMillis();
        authenticatedUser.setProfileImage(avatarUrl);
        authenticatedUser.setUpdatedAt(LocalDateTime.now().withNano(0));
        userRepository.save(authenticatedUser);
        return ResponseEntity.ok(userViewMapper.toUserMap(authenticatedUser));
    }

    @DeleteMapping("/me/avatar")
    public ResponseEntity<Map<String, Object>> removeAvatar(@AuthenticationPrincipal User user) {
        User authenticatedUser = requireAuthenticatedUser(user);
        deleteAvatarFiles(authenticatedUser.getId());
        authenticatedUser.setProfileImage(null);
        authenticatedUser.setUpdatedAt(LocalDateTime.now().withNano(0));
        userRepository.save(authenticatedUser);
        return ResponseEntity.ok(userViewMapper.toUserMap(authenticatedUser));
    }

    @GetMapping("/{id}/avatar")
    public ResponseEntity<byte[]> getAvatar(@PathVariable String id) throws IOException {
        GridFSFile file = gridFsTemplate.findOne(Query.query(Criteria.where("metadata.ownerUserId").is(id)));
        if (file == null) return ResponseEntity.notFound().build();
        GridFsResource resource = gridFsTemplate.getResource(file);
        String contentType = String.valueOf(file.getMetadata() != null ? file.getMetadata().get("contentType") : MediaType.APPLICATION_OCTET_STREAM_VALUE);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic())
                .header(HttpHeaders.CONTENT_TYPE, contentType)
                .body(resource.getContentAsByteArray());
    }

    private void deleteAvatarFiles(String userId) {
        gridFsTemplate.delete(Query.query(Criteria.where("metadata.ownerUserId").is(userId)));
    }

    private User requireAuthenticatedUser(User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user was not resolved");
        }
        return user;
    }

    private List<String> canonicalCategories(List<String> categories) {
        if (categories == null) return List.of();
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String category : categories) {
            if (!hasText(category)) continue;
            normalized.add(VolunteerCategory.canonicalize(category));
        }
        return List.copyOf(normalized);
    }

    private void validateCoordinates(Double latitude, Double longitude) {
        locationService.validateOptional(latitude, longitude);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }
}
