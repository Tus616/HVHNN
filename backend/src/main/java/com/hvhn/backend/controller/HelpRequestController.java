package com.hvhn.backend.controller;

import com.hvhn.backend.dto.HelpRequestDTO;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.service.HelpRequestService;
import com.hvhn.backend.service.RequestViewMapper;
import com.hvhn.backend.service.VolunteerService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin(
        origins = {"http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"},
        allowCredentials = "true"
)
@RequestMapping("/api/requests")
public class HelpRequestController {

    private final HelpRequestService requestService;
    private final VolunteerService volunteerService;
    private final RequestViewMapper requestViewMapper;
    private final com.hvhn.backend.service.RequestParsingService parsingService;

    public HelpRequestController(HelpRequestService requestService,
                                 VolunteerService volunteerService,
                                 RequestViewMapper requestViewMapper,
                                 com.hvhn.backend.service.RequestParsingService parsingService) {
        this.requestService = requestService;
        this.volunteerService = volunteerService;
        this.requestViewMapper = requestViewMapper;
        this.parsingService = parsingService;
    }

    @PostMapping
    public ResponseEntity<?> createRequest(@RequestBody HelpRequestDTO dto,
                                           @AuthenticationPrincipal User user) {
        try {
            HelpRequest request = requestService.createRequest(dto, requireAuthenticatedUser(user));
            volunteerService.notifyNearbyVolunteersForRequest(request);
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
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
    public ResponseEntity<?> getRequest(@PathVariable String id) {
        try {
            HelpRequest request = requestService.getRequestById(id);
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<?> acceptRequest(@PathVariable String id,
                                           @AuthenticationPrincipal User user) {
        try {
            HelpRequest request = requestService.acceptRequest(id, requireAuthenticatedUser(user));
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
        } catch (IllegalArgumentException e) {
            System.err.println("[DEBUG 400 BAD REQUEST] - API: /api/requests/" + id + "/accept - Reason: " + e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            System.err.println("[DEBUG SERVER ERROR] - API: /api/requests/" + id + "/accept");
            e.printStackTrace();
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<?> completeRequest(@PathVariable String id,
                                             @AuthenticationPrincipal User user) {
        try {
            HelpRequest request = requestService.completeRequest(id, requireAuthenticatedUser(user));
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelRequest(@PathVariable String id,
                                           @AuthenticationPrincipal User user) {
        try {
            HelpRequest request = requestService.cancelRequest(id, requireAuthenticatedUser(user));
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/verify-complete")
    public ResponseEntity<?> verifyRequestCompletion(@PathVariable String id,
                                                      @AuthenticationPrincipal User user) {
        try {
            HelpRequest request = requestService.verifyRequestCompletion(id, requireAuthenticatedUser(user));
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/reject-complete")
    public ResponseEntity<?> rejectRequestCompletion(@PathVariable String id,
                                                      @AuthenticationPrincipal User user) {
        try {
            HelpRequest request = requestService.rejectRequestCompletion(id, requireAuthenticatedUser(user));
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/timeline")
    public ResponseEntity<?> getTimeline(@PathVariable String id) {
        try {
            HelpRequest request = requestService.getRequestById(id);
            return ResponseEntity.ok(request.getTimeline());
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/public/{id}")
    public ResponseEntity<?> getPublicRequest(@PathVariable String id) {
        try {
            HelpRequest request = requestService.getPublicRequest(id);
            return ResponseEntity.ok(requestViewMapper.toRequestMap(request));
        } catch (Exception e) {
            return ResponseEntity.notFound().build();
        }
    }

    private User requireAuthenticatedUser(User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user was not resolved");
        }
        return user;
    }
}
