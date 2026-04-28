package com.hvhn.backend.controller;

import com.hvhn.backend.dto.CommunityRequestCreateRequest;
import com.hvhn.backend.dto.CommunityUpsertRequest;
import com.hvhn.backend.dto.MemberRoleUpdateRequest;
import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.Member;
import com.hvhn.backend.model.Request;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.enums.CommunityCategory;
import com.hvhn.backend.model.enums.RequestStatus;
import com.hvhn.backend.model.enums.RequestUrgency;
import com.hvhn.backend.service.CommunityService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;

@RestController
@RequestMapping({"/api/communities", "/communities"})
public class CommunityController {

    private final CommunityService communityService;
    private final com.hvhn.backend.service.HelpRequestService helpRequestService;
    private final com.hvhn.backend.service.RequestViewMapper requestViewMapper;

    public CommunityController(CommunityService communityService, 
                               com.hvhn.backend.service.HelpRequestService helpRequestService,
                               com.hvhn.backend.service.RequestViewMapper requestViewMapper) {
        this.communityService = communityService;
        this.helpRequestService = helpRequestService;
        this.requestViewMapper = requestViewMapper;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllCommunities(
            @RequestParam(required = false) String category
    ) {
        List<Community> communities = communityService.getAllCommunities(parseCategory(category));
        return ResponseEntity.ok(communities.stream().map(this::mapCommunity).toList());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createCommunity(
            @Valid @RequestBody CommunityUpsertRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        Community community = communityService.createCommunity(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(mapCommunity(community));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getCommunity(@PathVariable String id) {
        return ResponseEntity.ok(mapCommunity(communityService.getCommunity(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateCommunity(
            @PathVariable String id,
            @Valid @RequestBody CommunityUpsertRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        Community community = communityService.updateCommunity(id, request, currentUser);
        return ResponseEntity.ok(mapCommunity(community));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCommunity(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser
    ) {
        communityService.deleteCommunity(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<Map<String, Object>> joinCommunity(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> payload,
            @AuthenticationPrincipal User currentUser
    ) {
        String code = payload != null ? payload.get("code") : null;
        Member member = communityService.joinCommunity(id, currentUser, code);
        return ResponseEntity.ok(mapMember(member));
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<Map<String, String>> leaveCommunity(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser
    ) {
        communityService.leaveCommunity(id, currentUser);
        return ResponseEntity.ok(Map.of("message", "Left community successfully"));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<Map<String, Object>>> getMembers(@PathVariable String id) {
        List<Member> members = communityService.getMembers(id);
        return ResponseEntity.ok(members.stream().map(this::mapMember).toList());
    }

    @PutMapping("/{id}/members/{memberId}/role")
    public ResponseEntity<Map<String, Object>> updateMemberRole(
            @PathVariable String id,
            @PathVariable String memberId,
            @RequestBody MemberRoleUpdateRequest payload,
            @AuthenticationPrincipal User currentUser
    ) {
        Member member = communityService.updateMemberRole(id, memberId, payload, currentUser);
        return ResponseEntity.ok(mapMember(member));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> removeMember(
            @PathVariable String id,
            @PathVariable String memberId,
            @AuthenticationPrincipal User currentUser
    ) {
        communityService.removeMember(id, memberId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/broadcast")
    public ResponseEntity<Map<String, String>> broadcastMessage(
            @PathVariable String id,
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal User currentUser
    ) {
        communityService.broadcastMessage(id, payload.get("content"), currentUser);
        return ResponseEntity.ok(Map.of("message", "Broadcast sent successfully"));
    }


    @GetMapping("/{id}/requests")
    public ResponseEntity<List<Map<String, Object>>> getCommunityRequests(
            @PathVariable String id,
            @RequestParam(required = false) String urgency,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String search,
            @AuthenticationPrincipal User currentUser
    ) {
        if (currentUser == null) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        // Check membership
        if (!communityService.isMember(id, currentUser.getId())) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN, "Only community members can view requests");
        }
        // Fetch legacy requests
        List<Request> legacyRequests = communityService.getRequests(
                id,
                parseUrgency(urgency),
                parseStatus(status),
                location,
                search
        );
        
        // Fetch new unified requests
        List<com.hvhn.backend.model.HelpRequest> unifiedRequests = helpRequestService.getRequestsByCommunity(id);
        
        // Combine them
        List<Map<String, Object>> combined = new ArrayList<>();
        combined.addAll(legacyRequests.stream().map(this::mapRequest).toList());
        combined.addAll(unifiedRequests.stream().map(requestViewMapper::toRequestMap).toList());
        
        // Sort by date (descending)
        combined.sort((a, b) -> {
            String dateA = (String) a.get("createdAt");
            String dateB = (String) b.get("createdAt");
            if (dateA == null) return 1;
            if (dateB == null) return -1;
            return dateB.compareTo(dateA);
        });

        return ResponseEntity.ok(combined);
    }

    @PostMapping("/{id}/requests")
    public ResponseEntity<Map<String, Object>> createCommunityRequest(
            @PathVariable String id,
            @Valid @RequestBody CommunityRequestCreateRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        com.hvhn.backend.dto.HelpRequestDTO unifiedDto = new com.hvhn.backend.dto.HelpRequestDTO();
        unifiedDto.setTitle(request.getTitle());
        unifiedDto.setDescription(request.getDescription());
        unifiedDto.setAddress(request.getLocation());
        unifiedDto.setUrgency(request.getUrgency() != null ? request.getUrgency().name() : "MEDIUM");
        unifiedDto.setCommunityId(id);
        
        if (currentUser == null) {
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user required");
        }

        com.hvhn.backend.model.HelpRequest helpRequest = helpRequestService.createRequest(unifiedDto, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(requestViewMapper.toRequestMap(helpRequest));
    }

    private Map<String, Object> mapCommunity(Community community) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", community.getId());
        response.put("name", community.getName());
        response.put("description", community.getDescription());
        response.put("location", community.getLocation());
        response.put("category", community.getCategory() != null ? community.getCategory().name().toLowerCase() : null);
        response.put("memberIds", community.getMemberIds());
        response.put("memberCount", communityService.getMemberCount(community.getId()));
        response.put("requestCount", communityService.getRequestCount(community.getId()));
        response.put("institutionDomain", community.getInstitutionDomain());
        response.put("hasJoinCode", community.getJoinCode() != null && !community.getJoinCode().isEmpty());
        response.put("createdAt", community.getCreatedAt() != null ? community.getCreatedAt().toString() : null);
        response.put("updatedAt", community.getUpdatedAt() != null ? community.getUpdatedAt().toString() : null);
        return response;
    }

    private Map<String, Object> mapMember(Member member) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", member.getId());
        response.put("userId", member.getUserId());
        response.put("communityId", member.getCommunityId());
        response.put("role", member.getRole() != null ? member.getRole().name() : null);
        response.put("joinedAt", member.getJoinedAt() != null ? member.getJoinedAt().toString() : null);

        // Fetch user details for the member
        communityService.getUserById(member.getUserId()).ifPresent(user -> {
            response.put("fullName", user.getFullName());
            response.put("verificationLevel", user.getVerificationLevel().name());
            response.put("profileImage", user.getProfileImage());
        });

        return response;
    }

    private Map<String, Object> mapRequest(Request request) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", request.getId());
        response.put("communityId", request.getCommunityId());
        response.put("title", request.getTitle());
        response.put("description", request.getDescription());
        response.put("location", request.getLocation());
        response.put("urgency", request.getUrgency() != null ? request.getUrgency().name() : null);
        response.put("status", request.getStatus() != null ? request.getStatus().name() : null);
        response.put("requestedBy", request.getRequestedBy());
        response.put("createdAt", request.getCreatedAt() != null ? request.getCreatedAt().toString() : null);
        response.put("updatedAt", request.getUpdatedAt() != null ? request.getUpdatedAt().toString() : null);
        return response;
    }

    private CommunityCategory parseCategory(String category) {
        if (category == null || category.isBlank()) {
            return null;
        }
        return CommunityCategory.fromValue(category);
    }

    private RequestUrgency parseUrgency(String urgency) {
        if (urgency == null || urgency.isBlank()) {
            return null;
        }
        return RequestUrgency.fromValue(urgency);
    }

    private RequestStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        return RequestStatus.fromValue(status);
    }
}
