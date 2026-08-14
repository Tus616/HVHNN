package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hvhn.backend.model.EmailOtpChallenge;
import com.hvhn.backend.repository.EmailOtpChallengeRepository;
import com.hvhn.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class EmailOtpServiceTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final EmailOtpChallengeRepository challengeRepository = mock(EmailOtpChallengeRepository.class);
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final List<EmailOtpChallenge> savedChallenges = new ArrayList<>();
    private EmailOtpService service;

    @BeforeEach
    void setUp() {
        savedChallenges.clear();
        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.existsByNormalizedEmail(anyString())).thenReturn(false);
        when(challengeRepository.countByNormalizedEmailAndPurposeAndCreatedAtAfter(anyString(), anyString(), any()))
                .thenReturn(0L);
        when(challengeRepository.findFirstByNormalizedEmailAndPurposeAndConsumedFalseOrderByCreatedAtDesc(anyString(), anyString()))
                .thenAnswer(invocation -> savedChallenges.stream()
                        .filter(challenge -> !challenge.isConsumed())
                        .reduce((first, second) -> second));
        when(challengeRepository.findByNormalizedEmailAndPurposeAndConsumedFalse(anyString(), anyString()))
                .thenAnswer(invocation -> savedChallenges.stream()
                        .filter(challenge -> !challenge.isConsumed())
                        .toList());
        when(challengeRepository.save(any(EmailOtpChallenge.class))).thenAnswer(invocation -> {
            EmailOtpChallenge challenge = invocation.getArgument(0);
            savedChallenges.removeIf(existing -> existing == challenge);
            savedChallenges.add(challenge);
            return challenge;
        });
        when(challengeRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service = new EmailOtpService(
                userRepository,
                challengeRepository,
                passwordEncoder,
                emptyProvider(),
                "",
                300,
                30,
                3600,
                5,
                () -> "123456"
        );
    }

    @Test
    void otpIsStoredAsHashAndNotReturned() throws Exception {
        var response = service.sendRegistrationOtp("USER@Example.com", "127.0.0.1", "test");

        assertFalse(savedChallenges.isEmpty());
        assertEquals("user@example.com", savedChallenges.get(0).getNormalizedEmail());
        assertNotEquals("123456", savedChallenges.get(0).getOtpHash());
        assertTrue(passwordEncoder.matches("123456", savedChallenges.get(0).getOtpHash()));
        assertFalse(new ObjectMapper().writeValueAsString(response).contains("123456"));
    }

    @Test
    void correctOtpVerifiesAndConsumesChallenge() {
        service.sendRegistrationOtp("user@example.com", null, null);

        service.consumeRegistrationOtp("user@example.com", "123456");

        assertTrue(savedChallenges.get(0).isConsumed());
        assertNotNull(savedChallenges.get(0).getVerifiedAt());
    }

    @Test
    void incorrectOtpIncrementsAttempts() {
        service.sendRegistrationOtp("user@example.com", null, null);

        assertThrows(ResponseStatusException.class,
                () -> service.consumeRegistrationOtp("user@example.com", "000000"));

        assertEquals(1, savedChallenges.get(0).getFailedAttempts());
    }

    @Test
    void expiredOtpFails() {
        service.sendRegistrationOtp("user@example.com", null, null);
        savedChallenges.get(0).setExpiresAt(Instant.now().minusSeconds(1));

        assertThrows(ResponseStatusException.class,
                () -> service.consumeRegistrationOtp("user@example.com", "123456"));
        assertTrue(savedChallenges.get(0).isConsumed());
    }

    @Test
    void consumedOtpCannotBeReused() {
        service.sendRegistrationOtp("user@example.com", null, null);
        service.consumeRegistrationOtp("user@example.com", "123456");

        assertThrows(ResponseStatusException.class,
                () -> service.consumeRegistrationOtp("user@example.com", "123456"));
    }

    @Test
    void maximumAttemptsAreEnforced() {
        service.sendRegistrationOtp("user@example.com", null, null);
        savedChallenges.get(0).setFailedAttempts(5);

        assertThrows(ResponseStatusException.class,
                () -> service.consumeRegistrationOtp("user@example.com", "123456"));
    }

    @Test
    void resendCooldownIsEnforced() {
        service.sendRegistrationOtp("user@example.com", null, null);

        assertThrows(ResponseStatusException.class,
                () -> service.sendRegistrationOtp("user@example.com", null, null));
    }

    @Test
    void olderOtpIsInvalidatedAfterResend() {
        service.sendRegistrationOtp("user@example.com", null, null);
        EmailOtpChallenge first = savedChallenges.get(0);
        first.setLastSentAt(Instant.now().minusSeconds(60));

        service.sendRegistrationOtp("user@example.com", null, null);

        assertTrue(first.isConsumed());
        assertEquals(2, savedChallenges.size());
    }

    @Test
    void rateLimitIsEnforced() {
        when(challengeRepository.countByNormalizedEmailAndPurposeAndCreatedAtAfter(anyString(), anyString(), any()))
                .thenReturn(5L);

        assertThrows(ResponseStatusException.class,
                () -> service.sendRegistrationOtp("user@example.com", null, null));
    }

    private ObjectProvider<org.springframework.mail.javamail.JavaMailSender> emptyProvider() {
        return new ObjectProvider<>() {
            @Override
            public org.springframework.mail.javamail.JavaMailSender getObject(Object... args) {
                return null;
            }

            @Override
            public org.springframework.mail.javamail.JavaMailSender getIfAvailable() {
                return null;
            }

            @Override
            public org.springframework.mail.javamail.JavaMailSender getIfUnique() {
                return null;
            }

            @Override
            public org.springframework.mail.javamail.JavaMailSender getObject() {
                return null;
            }
        };
    }
}
