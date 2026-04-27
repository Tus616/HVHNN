package com.hvhn.backend.controller;

import com.hvhn.backend.dto.CommunityRequestUpdateRequest;
import com.hvhn.backend.model.Request;
import com.hvhn.backend.model.User;
import com.hvhn.backend.service.CommunityService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
public class CommunityRequestController {

    private final CommunityService communityService;

    public CommunityRequestController(CommunityService communityService) {
        this.communityService = communityService;
    }

    @PutMapping({"/api/requests/{requestId}", "/requests/{requestId}"})
    public ResponseEntity<Map<String, Object>> updateRequest(
            @PathVariable String requestId,
            @Valid @RequestBody CommunityRequestUpdateRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        Request updatedRequest = communityService.updateRequest(requestId, request, currentUser);
        return ResponseEntity.ok(mapRequest(updatedRequest));
    }

    @DeleteMapping({"/api/requests/{requestId}", "/requests/{requestId}"})
    public ResponseEntity<Void> deleteRequest(
            @PathVariable String requestId,
            @AuthenticationPrincipal User currentUser
    ) {
        communityService.deleteRequest(requestId, currentUser);
        return ResponseEntity.noContent().build();
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
}
