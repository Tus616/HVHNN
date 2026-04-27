package com.hvhn.backend.controller;

import com.hvhn.backend.model.EmergencyContact;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.enums.VolunteerSkill;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.service.UserViewMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final UserViewMapper userViewMapper;

    public UserController(UserRepository userRepository, UserViewMapper userViewMapper) {
        this.userRepository = userRepository;
        this.userViewMapper = userViewMapper;
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getProfile(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(userViewMapper.toUserMap(requireAuthenticatedUser(user)));
    }

    @PutMapping("/me")
    public ResponseEntity<Map<String, Object>> updateProfile(
            @RequestBody com.hvhn.backend.dto.ProfileUpdateRequest request,
            @AuthenticationPrincipal User user) {
        User authenticatedUser = requireAuthenticatedUser(user);
        
        if (request.getFullName() != null) authenticatedUser.setFullName(request.getFullName());
        if (request.getPhone() != null) authenticatedUser.setPhone(request.getPhone());
        if (request.getAddress() != null) authenticatedUser.setAddress(request.getAddress());
        if (request.getBio() != null) authenticatedUser.setBio(request.getBio());
        
        authenticatedUser.setBloodGroup(request.getBloodGroup());
        authenticatedUser.setBloodDonor(request.getIsBloodDonor());
        
        userRepository.save(authenticatedUser);
        return ResponseEntity.ok(userViewMapper.toUserMap(authenticatedUser));
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

    private User requireAuthenticatedUser(User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user was not resolved");
        }
        return user;
    }
}
