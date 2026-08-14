package com.hvhn.backend.repository;

import com.hvhn.backend.model.EmailOtpChallenge;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface EmailOtpChallengeRepository extends MongoRepository<EmailOtpChallenge, String> {
    Optional<EmailOtpChallenge> findFirstByNormalizedEmailAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
            String normalizedEmail,
            String purpose
    );

    List<EmailOtpChallenge> findByNormalizedEmailAndPurposeAndConsumedFalse(String normalizedEmail, String purpose);

    long countByNormalizedEmailAndPurposeAndCreatedAtAfter(String normalizedEmail, String purpose, Instant createdAt);
}
