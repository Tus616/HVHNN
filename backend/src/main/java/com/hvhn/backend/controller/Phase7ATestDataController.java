package com.hvhn.backend.controller;

import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.RequestAcceptance;
import com.hvhn.backend.model.RequestComment;
import com.hvhn.backend.model.TimelineEntry;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.RequestAcceptanceRepository;
import com.hvhn.backend.repository.RequestCommentRepository;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.security.JwtUtil;
import org.springframework.context.annotation.Profile;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@Profile("test")
@RequestMapping("/api/test/phase7a")
public class Phase7ATestDataController {

    private static final String PASSWORD = "Phase7A!Pass123";

    private final UserRepository userRepository;
    private final HelpRequestRepository requestRepository;
    private final RequestAcceptanceRepository acceptanceRepository;
    private final RequestCommentRepository commentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public Phase7ATestDataController(
            UserRepository userRepository,
            HelpRequestRepository requestRepository,
            RequestAcceptanceRepository acceptanceRepository,
            RequestCommentRepository commentRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil
    ) {
        this.userRepository = userRepository;
        this.requestRepository = requestRepository;
        this.acceptanceRepository = acceptanceRepository;
        this.commentRepository = commentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/seed")
    public ResponseEntity<Map<String, Object>> seed() {
        String run = "phase7a-browser";
        deleteByEmail(run + "-requester@hvhn.test");
        deleteByEmail(run + "-volunteer@hvhn.test");

        User requester = user(run + "-requester@hvhn.test", "Requester A", false);
        User volunteer = user(run + "-volunteer@hvhn.test", "Volunteer B", true);
        requester = userRepository.save(requester);
        volunteer = userRepository.save(volunteer);

        HelpRequest open = request(
                "Test medical request near clinic",
                "Please pick up prescribed medicine from the clinic desk and bring it to the main gate.",
                "OPEN",
                requester
        );
        open = requestRepository.save(open);

        HelpRequest assigned = request(
                "Assigned test food support",
                "A verified volunteer is bringing a food packet to the community desk.",
                "ASSIGNED",
                requester
        );
        assigned.setVolunteerId(volunteer.getId());
        assigned.setVolunteerName(volunteer.getFullName());
        assigned.setAcceptedAt(LocalDateTime.now().minusMinutes(35));
        assigned.setVolunteerProgressStatus("ON_THE_WAY");
        assigned.setTimeline(new ArrayList<>(assigned.getTimeline()));
        assigned.getTimeline().add(new TimelineEntry("VOLUNTEER_ACCEPTED", volunteer.getFullName(), volunteer.getId()));
        assigned.getTimeline().add(new TimelineEntry("ON_THE_WAY", volunteer.getFullName(), volunteer.getId()));
        assigned = requestRepository.save(assigned);
        acceptanceRepository.save(acceptance(assigned, volunteer));

        HelpRequest completion = request(
                "Completion requested transport help",
                "The volunteer has completed transport coordination and is awaiting requester confirmation.",
                "PENDING_COMPLETION",
                requester
        );
        completion.setVolunteerId(volunteer.getId());
        completion.setVolunteerName(volunteer.getFullName());
        completion.setAcceptedAt(LocalDateTime.now().minusHours(1));
        completion.setVolunteerProgressStatus("PENDING_COMPLETION");
        completion.setTimeline(new ArrayList<>(completion.getTimeline()));
        completion.getTimeline().add(new TimelineEntry("VOLUNTEER_ACCEPTED", volunteer.getFullName(), volunteer.getId()));
        completion.getTimeline().add(new TimelineEntry("HELP_STARTED", volunteer.getFullName(), volunteer.getId()));
        completion.getTimeline().add(new TimelineEntry("COMPLETION_REQUESTED", volunteer.getFullName(), volunteer.getId()));
        completion = requestRepository.save(completion);
        acceptanceRepository.save(acceptance(completion, volunteer));

        RequestComment comment = new RequestComment();
        comment.setRequestId(open.getId());
        comment.setAuthorId(volunteer.getId());
        comment.setAuthorName(volunteer.getFullName());
        comment.setText("I can reach the clinic in about 15 minutes.");
        comment.setCreatedAt(LocalDateTime.now().minusMinutes(8));
        comment.setDeleted(false);
        commentRepository.save(comment);

        return ResponseEntity.ok(Map.of(
                "requester", Map.of("id", requester.getId(), "token", jwtUtil.generateToken(requester), "email", requester.getEmail()),
                "volunteer", Map.of("id", volunteer.getId(), "token", jwtUtil.generateToken(volunteer), "email", volunteer.getEmail()),
                "password", PASSWORD,
                "requests", Map.of(
                        "open", open.getId(),
                        "assigned", assigned.getId(),
                        "completionRequested", completion.getId()
                )
        ));
    }

    private void deleteByEmail(String email) {
        userRepository.findByNormalizedEmail(email).ifPresent(user -> {
            requestRepository.findByRequesterId(user.getId()).forEach(request -> {
                commentRepository.findByRequestIdAndDeletedFalseOrderByCreatedAtAsc(request.getId())
                        .forEach(commentRepository::delete);
                acceptanceRepository.findByHelpRequestId(request.getId()).forEach(acceptanceRepository::delete);
                requestRepository.delete(request);
            });
            requestRepository.findByVolunteerId(user.getId()).forEach(request -> {
                acceptanceRepository.findByHelpRequestId(request.getId()).forEach(acceptanceRepository::delete);
                requestRepository.delete(request);
            });
            userRepository.delete(user);
        });
    }

    private User user(String email, String name, boolean volunteer) {
        User user = new User(email, passwordEncoder.encode(PASSWORD), name);
        user.setNormalizedEmail(email);
        user.setPhone("9999999999");
        user.setVerified(true);
        user.setEmailVerified(true);
        user.setOnboardingCompleted(true);
        user.setOnboardingCompletedAt(LocalDateTime.now().minusDays(1));
        user.setAddress("Phase 7A Test Clinic, New Delhi");
        user.setCity("Delhi");
        user.setDistrict("New Delhi");
        user.setState("Delhi");
        user.setPostalCode("110001");
        user.setLatitude(28.6139);
        user.setLongitude(77.2090);
        user.setLocation(new GeoJsonPoint(77.2090, 28.6139));
        user.setLocationSource("TEST_SEED");
        user.setLocationUpdatedAt(LocalDateTime.now().minusDays(1));
        user.setVolunteer(volunteer);
        user.setVolunteerStatus(volunteer ? "AVAILABLE" : "OFFLINE");
        user.setVolunteerCategories(volunteer ? List.of("MEDICAL", "FOOD", "TRANSPORT") : List.of());
        user.setRating(volunteer ? 4.9 : 4.7);
        user.setRatingCount(12);
        return user;
    }

    private HelpRequest request(String title, String description, String status, User requester) {
        HelpRequest request = new HelpRequest();
        request.setTitle(title);
        request.setDescription(description);
        request.setCategory(status.equals("ASSIGNED") ? "FOOD" : status.equals("PENDING_COMPLETION") ? "TRANSPORT" : "MEDICAL");
        request.setUrgency(status.equals("OPEN") ? "HIGH" : "MEDIUM");
        request.setStatus(status);
        request.setScope("GLOBAL");
        request.setAddress("Phase 7A Test Clinic, New Delhi");
        request.setCity("Delhi");
        request.setDistrict("New Delhi");
        request.setState("Delhi");
        request.setPostalCode("110001");
        request.setLatitude(28.6139);
        request.setLongitude(77.2090);
        request.setGeoLocation(new GeoJsonPoint(77.2090, 28.6139));
        request.setLocationSource("TEST_SEED");
        request.setLocationUpdatedAt(LocalDateTime.now().minusHours(2));
        request.setContactPhone("9999999999");
        request.setRequesterId(requester.getId());
        request.setRequesterName(requester.getFullName());
        request.setViewCount(12);
        request.setResponseCount(status.equals("OPEN") ? 1 : 2);
        request.setCreatedAt(LocalDateTime.now().minusMinutes(45));
        request.setUpdatedAt(LocalDateTime.now().minusMinutes(10));
        request.setVerificationStatus("VERIFIED");
        request.setTimeline(new ArrayList<>(List.of(new TimelineEntry("REQUEST_RAISED", requester.getFullName(), requester.getId()))));
        return request;
    }

    private RequestAcceptance acceptance(HelpRequest request, User volunteer) {
        RequestAcceptance acceptance = new RequestAcceptance();
        acceptance.setHelpRequestId(request.getId());
        acceptance.setVolunteerId(volunteer.getId());
        acceptance.setStatus("ACCEPTED");
        acceptance.setCreatedAt(LocalDateTime.now().minusMinutes(30));
        return acceptance;
    }
}
