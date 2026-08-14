package com.hvhn.backend.controller;

import com.hvhn.backend.dto.HelpRequestDTO;
import com.hvhn.backend.dto.NearbyRequestQuery;
import com.hvhn.backend.dto.RequestCommentCreateRequest;
import com.hvhn.backend.dto.RequestProgressUpdateRequest;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.RequestComment;
import com.hvhn.backend.model.User;
import com.hvhn.backend.service.HelpRequestService;
import com.hvhn.backend.service.GeospatialService;
import com.hvhn.backend.service.RequestViewMapper;
import com.hvhn.backend.service.VolunteerService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/requests")
public class HelpRequestController {

    private final HelpRequestService requestService;
    private final VolunteerService volunteerService;
    private final RequestViewMapper requestViewMapper;
    private final com.hvhn.backend.service.RequestParsingService parsingService;
    private final GeospatialService geospatialService;

    public HelpRequestController(HelpRequestService requestService,
                                 VolunteerService volunteerService,
                                 RequestViewMapper requestViewMapper,
                                 com.hvhn.backend.service.RequestParsingService parsingService,
                                 GeospatialService geospatialService) {
        this.requestService = requestService;
        this.volunteerService = volunteerService;
        this.requestViewMapper = requestViewMapper;
        this.parsingService = parsingService;
        this.geospatialService = geospatialService;
    }

    @PostMapping
    public ResponseEntity<?> createRequest(@RequestBody HelpRequestDTO dto,
                                           @AuthenticationPrincipal User user) {
            HelpRequest request = requestService.createRequest(dto, requireAuthenticatedUser(user));
            try {
            volunteerService.notifyNearbyVolunteersForRequest(request);
            } catch (RuntimeException ignored) {
                // Notification matching is non-blocking for request creation.
            }
            return ResponseEntity.status(HttpStatus.CREATED).body(requestViewMapper.toRequestMap(request));
    }

    @PostMapping("/parse")
    public ResponseEntity<?> parseRequest(@RequestBody Map<String, String> body) {
        try {
            String input = body.get("text");
            if (input == null || input.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Text input is required"));
            }
            return ResponseEntity.ok(parsingService.parseRequest(input));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/open")
    public ResponseEntity<List<Map<String, Object>>> getOpenRequests() {
        List<HelpRequest> requests = requestService.getOpenRequests();
        return ResponseEntity.ok(requests.stream().map(requestViewMapper::toRequestMap).toList());
    }

    /**
     * Default feed endpoint used by the React Help Feed.
     * Returns OPEN + ACTIVE requests (active = already accepted/assigned).
     */
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getFeedRequests() {
        List<HelpRequest> requests = requestService.getFeedRequests();
        return ResponseEntity.ok(requests.stream().map(requestViewMapper::toRequestMap).toList());
    }

    @GetMapping("/nearby")
    public ResponseEntity<List<Map<String, Object>>> getNearbyRequests(@ModelAttribute NearbyRequestQuery query) {
        return ResponseEntity.ok(geospatialService.nearbyRequests(query));
    }

    @GetMapping("/my")
    public ResponseEntity<List<Map<String, Object>>> getMyRequests(@AuthenticationPrincipal User user) {
        List<HelpRequest> requests = requestService.getUserRequests(requireAuthenticatedUser(user));
        return ResponseEntity.ok(requests.stream().map(requestViewMapper::toRequestMap).toList());
    }

    @GetMapping("/volunteered")
    public ResponseEntity<List<Map<String, Object>>> getVolunteeredRequests(@AuthenticationPrincipal User user) {
        List<HelpRequest> requests = requestService.getVolunteerRequests(requireAuthenticatedUser(user));
        return ResponseEntity.ok(requests.stream().map(requestViewMapper::toRequestMap).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getRequest(@PathVariable String id,
                                        @AuthenticationPrincipal User user) {
            HelpRequest request = requestService.getRequestById(id, user);
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<?> acceptRequest(@PathVariable String id,
                                           @AuthenticationPrincipal User user) {
            HelpRequest request = requestService.acceptRequest(id, requireAuthenticatedUser(user));
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completeRequest(@PathVariable String id,
                                             @AuthenticationPrincipal User user) {
            HelpRequest request = requestService.completeRequest(id, requireAuthenticatedUser(user));
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @PostMapping("/{id}/progress")
    public ResponseEntity<?> updateProgress(@PathVariable String id,
                                            @RequestBody RequestProgressUpdateRequest request,
                                            @AuthenticationPrincipal User user) {
        String action = request.getAction() != null ? request.getAction() : request.getStatus();
        HelpRequest updated = requestService.updateProgress(id, requireAuthenticatedUser(user), action);
        return ResponseEntity.ok(requestViewMapper.toRequestMap(updated));
    }

    @PostMapping("/{id}/completion/request")
    public ResponseEntity<?> requestCompletion(@PathVariable String id,
                                               @AuthenticationPrincipal User user) {
        HelpRequest request = requestService.requestCompletion(id, requireAuthenticatedUser(user));
        return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @PostMapping("/{id}/completion/confirm")
    public ResponseEntity<?> confirmCompletion(@PathVariable String id,
                                               @AuthenticationPrincipal User user) {
        HelpRequest request = requestService.verifyRequestCompletion(id, requireAuthenticatedUser(user));
        return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @PostMapping("/{id}/completion/reject")
    public ResponseEntity<?> rejectCompletion(@PathVariable String id,
                                              @AuthenticationPrincipal User user) {
        HelpRequest request = requestService.rejectRequestCompletion(id, requireAuthenticatedUser(user));
        return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelRequest(@PathVariable String id,
                                           @AuthenticationPrincipal User user) {
            HelpRequest request = requestService.cancelRequest(id, requireAuthenticatedUser(user));
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @PostMapping("/{id}/status")
    public ResponseEntity<?> updateAvailability(@PathVariable String id,
                                                @RequestBody Map<String, String> body,
                                                @AuthenticationPrincipal User user) {
        HelpRequest request = requestService.updateRequesterAvailability(id, requireAuthenticatedUser(user), body.get("status"));
        return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> removeRequest(@PathVariable String id,
                                              @AuthenticationPrincipal User user) {
        requestService.removeOwnRequest(id, requireAuthenticatedUser(user));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/accepted")
    public ResponseEntity<Void> removeAcceptedRequest(@PathVariable String id,
                                                      @AuthenticationPrincipal User user) {
        requestService.removeAcceptedRequest(id, requireAuthenticatedUser(user));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/withdraw")
    public ResponseEntity<?> withdrawRequest(@PathVariable String id,
                                             @AuthenticationPrincipal User user) {
        HelpRequest request = requestService.withdraw(id, requireAuthenticatedUser(user));
        return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @PostMapping("/{id}/verify-complete")
    public ResponseEntity<?> verifyRequestCompletion(@PathVariable String id,
                                                      @AuthenticationPrincipal User user) {
            HelpRequest request = requestService.verifyRequestCompletion(id, requireAuthenticatedUser(user));
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @PostMapping("/{id}/reject-complete")
    public ResponseEntity<?> rejectRequestCompletion(@PathVariable String id,
                                                      @AuthenticationPrincipal User user) {
            HelpRequest request = requestService.rejectRequestCompletion(id, requireAuthenticatedUser(user));
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<?> getTimeline(@PathVariable String id) {
            HelpRequest request = requestService.getRequestById(id);
            return ResponseEntity.ok(request.getTimeline());
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<RequestComment>> getComments(@PathVariable String id) {
        return ResponseEntity.ok(requestService.getComments(id));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<RequestComment> addComment(@PathVariable String id,
                                                     @RequestBody RequestCommentCreateRequest request,
                                                     @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(requestService.addComment(id, requireAuthenticatedUser(user), request.getText()));
    }

    @DeleteMapping("/{id}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable String id,
                                              @PathVariable String commentId,
                                              @AuthenticationPrincipal User user) {
        requestService.deleteComment(id, commentId, requireAuthenticatedUser(user));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/public/{id}")
    public ResponseEntity<?> getPublicRequest(@PathVariable String id) {
            HelpRequest request = requestService.getPublicRequest(id);
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
    }

    private User requireAuthenticatedUser(User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user was not resolved");
        }
        return user;
    }
}
