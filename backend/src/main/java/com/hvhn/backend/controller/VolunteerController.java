package com.hvhn.backend.controller;

import com.hvhn.backend.dto.VolunteerAvailabilityRequest;
import com.hvhn.backend.dto.VolunteerCategoriesRequest;
import com.hvhn.backend.dto.VolunteerLocationRequest;
import com.hvhn.backend.dto.VolunteerRatingRequest;
import com.hvhn.backend.dto.VolunteerRequestStatusUpdateRequest;
import com.hvhn.backend.dto.VolunteerToggleRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.service.VolunteerService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/volunteer")
public class VolunteerController {

    private final VolunteerService volunteerService;

    public VolunteerController(VolunteerService volunteerService) {
        this.volunteerService = volunteerService;
    }

    @PutMapping("/toggle")
    public ResponseEntity<Map<String, Object>> toggleVolunteer(@RequestBody VolunteerToggleRequest request,
                                                               @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.toggleVolunteer(requireAuthenticatedUser(user), request.isVolunteer()));
    }

    @PutMapping("/status")
    public ResponseEntity<Map<String, Object>> updateVolunteerAvailability(@RequestBody VolunteerAvailabilityRequest request,
                                                                           @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.updateVolunteerStatus(requireAuthenticatedUser(user), request.getStatus()));
    }

    @PutMapping("/categories")
    public ResponseEntity<Map<String, Object>> updateVolunteerCategories(@RequestBody VolunteerCategoriesRequest request,
                                                                         @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.updateVolunteerCategories(requireAuthenticatedUser(user), request.getCategories()));
    }

    @PutMapping("/location")
    public ResponseEntity<Map<String, Object>> updateVolunteerLocation(@RequestBody VolunteerLocationRequest request,
                                                                       @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.updateVolunteerLocation(
                requireAuthenticatedUser(user),
                request.getLatitude(),
                request.getLongitude()
        ));
    }

    @GetMapping("/nearby")
    public ResponseEntity<List<Map<String, Object>>> getNearbyVolunteers(@RequestParam String requestId) {
        return ResponseEntity.ok(volunteerService.getNearbyVolunteers(requestId));
    }

    @GetMapping("/blood-match")
    public ResponseEntity<List<Map<String, Object>>> getBloodMatches(@RequestParam String bloodGroup, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.getBloodMatches(bloodGroup, requireAuthenticatedUser(user)));
    }

    @GetMapping("/incoming")
    public ResponseEntity<List<Map<String, Object>>> getIncomingRequests(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.getIncomingRequests(requireAuthenticatedUser(user)));
    }

    @GetMapping("/active")
    public ResponseEntity<List<Map<String, Object>>> getActiveRequests(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.getActiveRequests(requireAuthenticatedUser(user)));
    }

    @GetMapping("/completed")
    public ResponseEntity<List<Map<String, Object>>> getCompletedRequests(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.getCompletedRequests(requireAuthenticatedUser(user)));
    }

    @PutMapping("/accept/{requestId}")
    public ResponseEntity<Map<String, Object>> acceptRequest(@PathVariable String requestId,
                                                             @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.acceptRequest(requestId, requireAuthenticatedUser(user)));
    }

    @PutMapping("/decline/{requestId}")
    public ResponseEntity<Map<String, Object>> declineRequest(@PathVariable String requestId,
                                                              @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.declineRequest(requestId, requireAuthenticatedUser(user)));
    }

    @PutMapping("/status/{requestId}")
    public ResponseEntity<Map<String, Object>> updateRequestStatus(@PathVariable String requestId,
                                                                   @RequestBody VolunteerRequestStatusUpdateRequest request,
                                                                   @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.updateRequestProgress(requestId, requireAuthenticatedUser(user), request.getStatus()));
    }

    @PostMapping("/rate")
    public ResponseEntity<Map<String, Object>> rateVolunteer(@RequestBody VolunteerRatingRequest request,
                                                             @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.rateVolunteer(
                requireAuthenticatedUser(user),
                request.getRequestId(),
                request.getVolunteerId(),
                request.getRating(),
                request.getFeedback()
        ));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getVolunteerStats(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(volunteerService.getVolunteerStats(requireAuthenticatedUser(user)));
    }

    private User requireAuthenticatedUser(User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user was not resolved");
        }
        return user;
    }
}
