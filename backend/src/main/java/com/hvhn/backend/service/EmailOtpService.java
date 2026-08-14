package com.hvhn.backend.service;

import com.hvhn.backend.dto.OtpStatusResponse;
import com.hvhn.backend.model.EmailOtpChallenge;
import com.hvhn.backend.repository.EmailOtpChallengeRepository;
import com.hvhn.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.function.Supplier;

@Service
public class EmailOtpService {

    private static final Logger log = LoggerFactory.getLogger(EmailOtpService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MAX_ATTEMPTS = 5;

    private final UserRepository userRepository;
    private final EmailOtpChallengeRepository challengeRepository;
    private final PasswordEncoder passwordEncoder;
    private final MailjetEmailService mailjetEmailService;
    private final String fromAddress;
    private final Duration otpLifetime;
    private final Duration resendCooldown;
    private final Duration requestWindow;
    private final int maxRequestsPerWindow;
    private final Supplier<String> otpSupplier;

    @Autowired
    public EmailOtpService(
            UserRepository userRepository,
            EmailOtpChallengeRepository challengeRepository,
            PasswordEncoder passwordEncoder,
            MailjetEmailService mailjetEmailService,
            @Value("${app.mail.from:}") String fromAddress,
            @Value("${app.otp.expiry-seconds:300}") long otpExpirySeconds,
            @Value("${app.otp.resend-cooldown-seconds:30}") long resendCooldownSeconds,
            @Value("${app.otp.rate-window-seconds:3600}") long requestWindowSeconds,
            @Value("${app.otp.max-requests-per-window:5}") int maxRequestsPerWindow
    ) {
        this(
                userRepository,
                challengeRepository,
                passwordEncoder,
                mailjetEmailService,
                fromAddress,
                otpExpirySeconds,
                resendCooldownSeconds,
                requestWindowSeconds,
                maxRequestsPerWindow,
                EmailOtpService::generateSecureOtp
        );
    }

    EmailOtpService(
            UserRepository userRepository,
            EmailOtpChallengeRepository challengeRepository,
            PasswordEncoder passwordEncoder,
            MailjetEmailService mailjetEmailService,
            String fromAddress,
            long otpExpirySeconds,
            long resendCooldownSeconds,
            long requestWindowSeconds,
            int maxRequestsPerWindow,
            Supplier<String> otpSupplier
    ) {
        this.userRepository = userRepository;
        this.challengeRepository = challengeRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailjetEmailService = mailjetEmailService;
        this.fromAddress = fromAddress;
        this.otpLifetime = Duration.ofSeconds(otpExpirySeconds);
        this.resendCooldown = Duration.ofSeconds(resendCooldownSeconds);
        this.requestWindow = Duration.ofSeconds(requestWindowSeconds);
        this.maxRequestsPerWindow = Math.max(1, maxRequestsPerWindow);
        this.otpSupplier = otpSupplier;
    }

    public OtpStatusResponse sendRegistrationOtp(String email, String requestIp, String userAgent) {
        String normalizedEmail = normalizeEmail(email);
        if (!StringUtils.hasText(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email is required.");
        }
        if (userRepository.existsByNormalizedEmail(normalizedEmail) || userRepository.existsByEmail(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists.");
        }

        Instant now = Instant.now();
        EmailOtpChallenge active = challengeRepository
                .findFirstByNormalizedEmailAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
                        normalizedEmail,
                        EmailOtpChallenge.PURPOSE_REGISTRATION
                )
                .orElse(null);
        if (active != null && active.getLastSentAt() != null) {
            Instant nextAllowed = active.getLastSentAt().plus(resendCooldown);
            if (now.isBefore(nextAllowed)) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Please wait before requesting another OTP.");
            }
        }

        long recentRequestCount = challengeRepository.countByNormalizedEmailAndPurposeAndCreatedAtAfter(
                normalizedEmail,
                EmailOtpChallenge.PURPOSE_REGISTRATION,
                now.minus(requestWindow)
        );
        if (recentRequestCount >= maxRequestsPerWindow) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many OTP requests. Try again later.");
        }

        invalidateActiveChallenges(normalizedEmail);

        String otp = otpSupplier.get();
        EmailOtpChallenge challenge = new EmailOtpChallenge();
        challenge.setNormalizedEmail(normalizedEmail);
        challenge.setPurpose(EmailOtpChallenge.PURPOSE_REGISTRATION);
        challenge.setOtpHash(passwordEncoder.encode(otp));
        challenge.setCreatedAt(now);
        challenge.setExpiresAt(now.plus(otpLifetime));
        challenge.setDeleteAfter(now.plus(otpLifetime).plus(Duration.ofHours(24)));
        challenge.setLastSentAt(now);
        challenge.setRequestIp(requestIp);
        challenge.setUserAgent(userAgent);
        challenge.setResendCount(active == null ? 0 : active.getResendCount() + 1);
        challengeRepository.save(challenge);

        trySendOtpEmail(normalizedEmail, otp);
        return new OtpStatusResponse(
                "If the email can receive Sahay registration codes, an OTP has been sent.",
                false,
                resendCooldown.toSeconds(),
                otpLifetime.toSeconds()
        );
    }

    public OtpStatusResponse sendOtp(String email) {
        return sendRegistrationOtp(email, null, null);
    }

    public OtpStatusResponse verifyOtp(String email, String otp) {
        consumeRegistrationOtp(email, otp);
        return new OtpStatusResponse("Email verified successfully.", true);
    }

    public void consumeRegistrationOtp(String email, String otp) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedOtp = otp == null ? "" : otp.trim();
        Instant now = Instant.now();

        EmailOtpChallenge challenge = challengeRepository
                .findFirstByNormalizedEmailAndPurposeAndConsumedFalseOrderByCreatedAtDesc(
                        normalizedEmail,
                        EmailOtpChallenge.PURPOSE_REGISTRATION
                )
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "OTP verification could not be completed. Request a new OTP."));

        if (challenge.getVerifiedAt() != null || challenge.isConsumed()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "This OTP has already been used.");
        }
        if (challenge.getExpiresAt() == null || now.isAfter(challenge.getExpiresAt())) {
            challenge.setConsumed(true);
            challengeRepository.save(challenge);
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "OTP has expired. Request a new OTP.");
        }
        if (challenge.getFailedAttempts() >= MAX_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many incorrect OTP attempts. Request a new OTP.");
        }
        if (!passwordEncoder.matches(normalizedOtp, challenge.getOtpHash())) {
            challenge.setFailedAttempts(challenge.getFailedAttempts() + 1);
            challengeRepository.save(challenge);
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid OTP.");
        }

        challenge.setVerifiedAt(now);
        challenge.setConsumed(true);
        challengeRepository.save(challenge);
    }

    public boolean consumeVerifiedEmail(String email) {
        return false;
    }

    private void invalidateActiveChallenges(String normalizedEmail) {
        List<EmailOtpChallenge> activeChallenges = challengeRepository.findByNormalizedEmailAndPurposeAndConsumedFalse(
                normalizedEmail,
                EmailOtpChallenge.PURPOSE_REGISTRATION
        );
        Instant now = Instant.now();
        for (EmailOtpChallenge challenge : activeChallenges) {
            challenge.setConsumed(true);
            if (challenge.getDeleteAfter() == null) {
                challenge.setDeleteAfter(now.plus(Duration.ofHours(24)));
            }
        }
        challengeRepository.saveAll(activeChallenges);
    }

    private void trySendOtpEmail(String recipientEmail, String otp) {
        if (!mailjetEmailService.isConfigured()) {
            log.warn("[email] OTP email delivery skipped — Mailjet is not configured (MAILJET_API_KEY/SECRET/MAIL_FROM absent).");
            return;
        }
        try {
            mailjetEmailService.sendEmail(
                    recipientEmail,
                    "Sahay verification code",
                    buildOtpEmailBody(otp)
            );
        } catch (MailjetEmailService.EmailDeliveryException exception) {
            log.error("[email] Failed to send OTP email. provider=Mailjet error=DELIVERY_FAILURE to=[redacted]");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Could not send the OTP email. Try again later.");
        }
    }

    private String buildOtpEmailBody(String otp) {
        return """
                Your Sahay verification code is: %s.

                It expires in %d minutes.

                If you did not request this code, you can ignore this email.
                """.formatted(otp, Math.max(1, otpLifetime.toMinutes()));
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private static String generateSecureOtp() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }
}
