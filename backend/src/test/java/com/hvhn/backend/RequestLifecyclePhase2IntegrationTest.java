package com.hvhn.backend;

import com.hvhn.backend.dto.HelpRequestDTO;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.RequestAcceptance;
import com.hvhn.backend.model.RequestComment;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.RequestAcceptanceRepository;
import com.hvhn.backend.repository.RequestCommentRepository;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.service.HelpRequestService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class RequestLifecyclePhase2IntegrationTest {

    @Autowired
    HelpRequestService requestService;

    @Autowired
    HelpRequestRepository requestRepository;

    @Autowired
    RequestAcceptanceRepository acceptanceRepository;

    @Autowired
    RequestCommentRepository commentRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    MongoTemplate mongoTemplate;

    @BeforeEach
    void resetData() {
        guardTestDatabase();
        mongoTemplate.dropCollection(HelpRequest.class);
        mongoTemplate.dropCollection(RequestAcceptance.class);
        mongoTemplate.dropCollection(RequestComment.class);
        mongoTemplate.dropCollection(User.class);
        mongoTemplate.dropCollection("help_requests_general");
    }

    @AfterEach
    void cleanupExecutors() {
        // No shared executor state.
    }

    @Test
    void requestLifecycleRequiresRequesterConfirmationAndPersistsComments() {
        User requester = saveRequester("requester");
        User volunteer = saveVolunteer("volunteer");
        User otherVolunteer = saveVolunteer("other-volunteer");
        User nonVolunteer = saveRequester("not-a-volunteer");

        HelpRequest created = requestService.createRequest(validDto("Need grocery pickup for elderly neighbor"), requester);

        assertThat(created.getStatus()).isEqualTo("OPEN");
        assertThat(created.getRequesterId()).isEqualTo(requester.getId());
        assertThat(requestRepository.findByStatus("OPEN")).extracting(HelpRequest::getId).contains(created.getId());
        assertThat(mongoTemplate.collectionExists("help_requests_general")).isFalse();
        assertThat(created.getTimeline()).extracting("event").contains("REQUEST_CREATED");

        assertThatThrownBy(() -> requestService.acceptRequest(created.getId(), requester))
                .isInstanceOf(ResponseStatusException.class)
                .extracting("statusCode")
                .isEqualTo(HttpStatus.FORBIDDEN);

        assertThatThrownBy(() -> requestService.acceptRequest(created.getId(), nonVolunteer))
                .isInstanceOf(ResponseStatusException.class)
                .extracting("statusCode")
                .isEqualTo(HttpStatus.FORBIDDEN);

        HelpRequest accepted = requestService.acceptRequest(created.getId(), volunteer);
        assertThat(accepted.getStatus()).isEqualTo("ASSIGNED");
        assertThat(accepted.getVolunteerProgressStatus()).isEqualTo("ACCEPTED");
        assertThat(accepted.getVolunteerId()).isEqualTo(volunteer.getId());
        assertThat(acceptanceRepository.findByHelpRequestIdAndVolunteerId(created.getId(), volunteer.getId()))
                .map(RequestAcceptance::getStatus)
                .contains("ACCEPTED");

        assertThatThrownBy(() -> requestService.acceptRequest(created.getId(), otherVolunteer))
                .isInstanceOf(ResponseStatusException.class)
                .extracting("statusCode")
                .isEqualTo(HttpStatus.CONFLICT);
        assertThat(requestService.getFeedRequests()).extracting(HelpRequest::getId).doesNotContain(created.getId());

        HelpRequest onTheWay = requestService.updateProgress(created.getId(), volunteer, "ON_THE_WAY");
        assertThat(onTheWay.getStatus()).isEqualTo("IN_PROGRESS");
        assertThat(onTheWay.getVolunteerProgressStatus()).isEqualTo("ON_THE_WAY");

        HelpRequest reached = requestService.updateProgress(created.getId(), volunteer, "REACHED");
        assertThat(reached.getVolunteerProgressStatus()).isEqualTo("REACHED");

        HelpRequest helping = requestService.updateProgress(created.getId(), volunteer, "HELPING");
        assertThat(helping.getVolunteerProgressStatus()).isEqualTo("HELPING");

        assertThatThrownBy(() -> requestService.updateProgress(created.getId(), otherVolunteer, "ON_THE_WAY"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting("statusCode")
                .isEqualTo(HttpStatus.FORBIDDEN);

        HelpRequest completionRequested = requestService.requestCompletion(created.getId(), volunteer);
        assertThat(completionRequested.getStatus()).isEqualTo("COMPLETION_REQUESTED");
        assertThat(completionRequested.getVolunteerProgressStatus()).isEqualTo("COMPLETION_REQUESTED");

        assertThatThrownBy(() -> requestService.verifyRequestCompletion(created.getId(), volunteer))
                .isInstanceOf(ResponseStatusException.class)
                .extracting("statusCode")
                .isEqualTo(HttpStatus.FORBIDDEN);

        HelpRequest rejected = requestService.rejectRequestCompletion(created.getId(), requester);
        assertThat(rejected.getStatus()).isEqualTo("IN_PROGRESS");
        assertThat(rejected.getVolunteerProgressStatus()).isEqualTo("HELPING");

        HelpRequest secondCompletionRequest = requestService.requestCompletion(created.getId(), volunteer);
        assertThat(secondCompletionRequest.getStatus()).isEqualTo("COMPLETION_REQUESTED");

        RequestComment comment = requestService.addComment(created.getId(), requester, "I will keep the gate open.");
        assertThat(comment.getAuthorId()).isEqualTo(requester.getId());
        assertThat(requestService.getComments(created.getId()))
                .extracting(RequestComment::getText)
                .containsExactly("I will keep the gate open.");

        HelpRequest completed = requestService.verifyRequestCompletion(created.getId(), requester);
        assertThat(completed.getStatus()).isEqualTo("COMPLETED");
        assertThat(completed.getVolunteerProgressStatus()).isEqualTo("COMPLETED");
        assertThat(completed.isRequesterRatingPending()).isTrue();
        assertThat(acceptanceRepository.findByHelpRequestIdAndVolunteerId(created.getId(), volunteer.getId()))
                .map(RequestAcceptance::getStatus)
                .contains("COMPLETED");
        assertThat(completed.getTimeline()).extracting("event")
                .contains("REQUEST_CREATED", "REQUEST_ACCEPTED", "VOLUNTEER_ON_THE_WAY",
                        "VOLUNTEER_REACHED", "HELP_STARTED", "COMPLETION_REQUESTED",
                        "COMPLETION_REJECTED", "REQUEST_COMPLETED");

        assertThatThrownBy(() -> requestService.cancelRequest(created.getId(), requester))
                .isInstanceOf(ResponseStatusException.class)
                .extracting("statusCode")
                .isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    }

    @Test
    void withdrawReopensRequestAndRequesterCanCancelOpenRequest() {
        User requester = saveRequester("withdraw-requester");
        User volunteer = saveVolunteer("withdraw-volunteer");
        User nextVolunteer = saveVolunteer("withdraw-next-volunteer");

        HelpRequest request = requestService.createRequest(validDto("Need medicine pickup before evening"), requester);
        requestService.acceptRequest(request.getId(), volunteer);

        HelpRequest reopened = requestService.withdraw(request.getId(), volunteer);
        assertThat(reopened.getStatus()).isEqualTo("OPEN");
        assertThat(reopened.getVolunteerId()).isNull();
        assertThat(reopened.getVolunteerProgressStatus()).isNull();
        assertThat(acceptanceRepository.findByHelpRequestIdAndVolunteerId(request.getId(), volunteer.getId()))
                .map(RequestAcceptance::getStatus)
                .contains("CANCELLED");

        HelpRequest acceptedAgain = requestService.acceptRequest(request.getId(), nextVolunteer);
        assertThat(acceptedAgain.getStatus()).isEqualTo("ASSIGNED");
        assertThat(acceptedAgain.getVolunteerId()).isEqualTo(nextVolunteer.getId());

        HelpRequest secondRequest = requestService.createRequest(validDto("Need help carrying water cans upstairs"), requester);
        HelpRequest cancelled = requestService.cancelRequest(secondRequest.getId(), requester);
        assertThat(cancelled.getStatus()).isEqualTo("CANCELLED");
        assertThat(cancelled.getVolunteerProgressStatus()).isEqualTo("CANCELLED");
    }

    @Test
    void concurrentAcceptanceHasExactlyOneWinner() throws Exception {
        User requester = saveRequester("race-requester");
        User firstVolunteer = saveVolunteer("race-first-volunteer");
        User secondVolunteer = saveVolunteer("race-second-volunteer");
        HelpRequest request = requestService.createRequest(validDto("Need transport coordination for clinic visit"), requester);

        var executor = Executors.newFixedThreadPool(2);
        try {
            Callable<String> first = () -> acceptOutcome(request.getId(), firstVolunteer);
            Callable<String> second = () -> acceptOutcome(request.getId(), secondVolunteer);

            List<String> outcomes = executor.invokeAll(List.of(first, second)).stream()
                    .map(future -> {
                        try {
                            return future.get();
                        } catch (Exception exception) {
                            throw new AssertionError(exception);
                        }
                    })
                    .toList();

            assertThat(outcomes).containsExactlyInAnyOrder("SUCCESS", "CONFLICT");
            HelpRequest assigned = requestRepository.findById(request.getId()).orElseThrow();
            assertThat(assigned.getStatus()).isEqualTo("ASSIGNED");
            assertThat(assigned.getVolunteerId()).isIn(firstVolunteer.getId(), secondVolunteer.getId());
            assertThat(acceptanceRepository.findAll().stream()
                    .filter(acceptance -> request.getId().equals(acceptance.getHelpRequestId()))
                    .filter(acceptance -> "ACCEPTED".equals(acceptance.getStatus()))
                    .count()).isEqualTo(1);
        } finally {
            executor.shutdownNow();
            assertThat(executor.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
    }

    private String acceptOutcome(String requestId, User volunteer) {
        try {
            requestService.acceptRequest(requestId, volunteer);
            return "SUCCESS";
        } catch (ResponseStatusException exception) {
            if (HttpStatus.CONFLICT.equals(exception.getStatusCode())) {
                return "CONFLICT";
            }
            throw exception;
        }
    }

    private HelpRequestDTO validDto(String title) {
        HelpRequestDTO dto = new HelpRequestDTO();
        dto.setTitle(title);
        dto.setDescription("This is a meaningful request description with enough context for a real local helper.");
        dto.setCategory("GENERAL");
        dto.setUrgency("HIGH");
        dto.setAddress("Test Street");
        dto.setLatitude(28.6139);
        dto.setLongitude(77.2090);
        dto.setContactPhone("9999999999");
        return dto;
    }

    private User saveRequester(String prefix) {
        User user = baseUser(prefix);
        user.setVolunteer(false);
        user.setVolunteerCategories(List.of());
        return userRepository.save(user);
    }

    private User saveVolunteer(String prefix) {
        User user = baseUser(prefix);
        user.setVolunteer(true);
        user.setVolunteerCategories(List.of("GENERAL"));
        user.setVolunteerStatus("ONLINE");
        user.setVolunteerSetupCompletedAt(LocalDateTime.now());
        user.setLatitude(28.6139);
        user.setLongitude(77.2090);
        return userRepository.save(user);
    }

    private User baseUser(String prefix) {
        String email = prefix + "-" + System.nanoTime() + "@hvhn.test";
        User user = new User(email, "encoded-password", prefix);
        user.setNormalizedEmail(email);
        user.setFullName(prefix + " User");
        user.setPhone("9999999999");
        user.setVerified(true);
        user.setEmailVerified(true);
        user.setOnboardingCompleted(true);
        user.setOnboardingCompletedAt(LocalDateTime.now());
        return user;
    }

    private void guardTestDatabase() {
        assertThat(mongoTemplate.getDb().getName()).containsIgnoringCase("test");
    }
}
