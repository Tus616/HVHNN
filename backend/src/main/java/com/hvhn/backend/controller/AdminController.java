package com.hvhn.backend.controller;

import com.hvhn.backend.dto.DashboardStats;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.security.SecurityUtils;
import com.hvhn.backend.service.AdminService;
import com.hvhn.backend.service.HelpRequestService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import java.util.HashMap;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;
    private final HelpRequestService requestService;
    private final UserRepository userRepository;

    public AdminController(AdminService adminService, HelpRequestService requestService,
                           UserRepository userRepository) {
        this.adminService = adminService;
        this.requestService = requestService;
        this.userRepository = userRepository;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardStats> getDashboard() {
        return ResponseEntity.ok(adminService.getDashboardStats());
    }

    @GetMapping("/requests")
    public ResponseEntity<List<Map<String, Object>>> getAllRequests() {
        List<HelpRequest> requests = requestService.getAllRequests();
        List<Map<String, Object>> result = requests.stream().map(r -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", r.getId());
            map.put("title", r.getTitle());
            map.put("category", r.getCategory());
            map.put("urgency", r.getUrgency());
            map.put("status", r.getStatus());
            map.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : null);
            if (r.getRequesterName() != null) {
                map.put("requesterName", r.getRequesterName());
            }
            if (r.getVolunteerName() != null) {
                map.put("volunteerName", r.getVolunteerName());
            }
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getAllUsers() {
        List<User> users = userRepository.findAll();
        List<Map<String, Object>> result = users.stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("fullName", u.getFullName());
            map.put("email", u.getEmail());
            map.put("role", u.getRole());
            map.put("points", u.getPoints());
            map.put("requestsHelped", u.getRequestsHelped());
            map.put("verified", u.isVerified());
            map.put("verificationLevel", u.getVerificationLevel());
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/pending-trusted")
    public ResponseEntity<List<User>> getPendingTrusted() {
        // Simple heuristic: users who are VERIFIED but not yet TRUSTED
        return ResponseEntity.ok(userRepository.findAll().stream()
                .filter(u -> u.getVerificationLevel() == com.hvhn.backend.model.enums.VerificationLevel.VERIFIED)
                .toList());
    }

    @PutMapping("/users/{id}/verify-trusted")
    public ResponseEntity<User> verifyTrusted(@PathVariable String id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new java.util.NoSuchElementException("User not found"));
        user.setVerificationLevel(com.hvhn.backend.model.enums.VerificationLevel.TRUSTED);
        return ResponseEntity.ok(userRepository.save(user));
    }

    @GetMapping("/flagged")
    public ResponseEntity<List<HelpRequest>> getFlaggedRequests() {
        return ResponseEntity.ok(adminService.getFlaggedRequests());
    }

    @PutMapping("/requests/{id}/review")
    public ResponseEntity<HelpRequest> reviewRequest(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        
        String status = body.get("status"); // VERIFIED or REJECTED
        User admin = SecurityUtils.getCurrentUser();
        
        if (admin == null) {
            return ResponseEntity.status(401).build();
        }
        
        return ResponseEntity.ok(adminService.reviewRequest(id, status, admin.getId(), admin.getFullName()));
    }
}
