package com.hvhn.backend.service;

import com.hvhn.backend.dto.OtpStatusResponse;
import com.hvhn.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class EmailOtpService {

    private static final Logger log = LoggerFactory.getLogger(EmailOtpService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String fromAddress;
    private final Duration otpLifetime;
    private final Duration verificationLifetime;
    private final Duration resendCooldown;
    private final boolean debugReturnOtp;

    private final ConcurrentMap<String, PendingOtp> pendingOtps = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Instant> verifiedEmails = new ConcurrentHashMap<>();

    public EmailOtpService(
            UserRepository userRepository,
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.from:${spring.mail.username:}}") String fromAddress,
            @Value("${app.otp.expiry-seconds:300}") long otpExpirySeconds,
            @Value("${app.otp.verification-window-seconds:900}") long verificationWindowSeconds,
            @Value("${app.otp.resend-cooldown-seconds:30}") long resendCooldownSeconds,
            @Value("${app.otp.debug-return-otp:true}") boolean debugReturnOtp
    ) {
        this.userRepository = userRepository;
        this.mailSenderProvider = mailSenderProvider;
        this.fromAddress = fromAddress;
        this.otpLifetime = Duration.ofSeconds(otpExpirySeconds);
        this.verificationLifetime = Duration.ofSeconds(verificationWindowSeconds);
        this.resendCooldown = Duration.ofSeconds(resendCooldownSeconds);
        this.debugReturnOtp = debugReturnOtp;
    }

    public OtpStatusResponse sendOtp(String email) {
        String normalizedEmail = normalizeEmail(email);

        if (!StringUtils.hasText(normalizedEmail)) {
            throw new IllegalArgumentException("Email is required.");
        }
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("An account with this email already exists. Try signing in instead.");
        }

        Instant now = Instant.now();
        clearExpiredState(normalizedEmail, now);

        PendingOtp existingOtp = pendingOtps.get(normalizedEmail);
        if (existingOtp != null) {
            Instant nextAllowedSendTime = existingOtp.sentAt().plus(resendCooldown);
            if (now.isBefore(nextAllowedSendTime)) {
                long waitSeconds = Math.max(1, Duration.between(now, nextAllowedSendTime).toSeconds());
                throw new IllegalArgumentException(
                        "Please wait " + waitSeconds + " seconds before requesting another OTP."
                );
            }
        }

        String otp = generateOtp();
        boolean emailSent = trySendOtpEmail(normalizedEmail, otp);

        pendingOtps.put(normalizedEmail, new PendingOtp(otp, now.plus(otpLifetime), now));
        verifiedEmails.remove(normalizedEmail);

        String message = emailSent
                ? "OTP sent to " + normalizedEmail + ". Check your inbox and spam folder."
                : "SMTP is not configured yet, so the OTP could not be emailed. The code is available below for local development.";

        return new OtpStatusResponse(message, debugReturnOtp ? otp : null, false);
    }

    public OtpStatusResponse verifyOtp(String email, String otp) {
        String normalizedEmail = normalizeEmail(email);
        String normalizedOtp = otp == null ? "" : otp.trim();
        Instant now = Instant.now();

        clearExpiredState(normalizedEmail, now);

        PendingOtp pendingOtp = pendingOtps.get(normalizedEmail);
        if (pendingOtp == null) {
            throw new IllegalArgumentException("No OTP request was found for this email. Request a new OTP.");
        }
        if (!pendingOtp.code().equals(normalizedOtp)) {
            throw new IllegalArgumentException("Invalid OTP. Please try again.");
        }

        pendingOtps.remove(normalizedEmail);
        verifiedEmails.put(normalizedEmail, now.plus(verificationLifetime));

        return new OtpStatusResponse(
                "Email verified successfully. You can finish creating your account now.",
                null,
                true
        );
    }

    public boolean consumeVerifiedEmail(String email) {
        String normalizedEmail = normalizeEmail(email);
        Instant expiresAt = verifiedEmails.remove(normalizedEmail);
        return expiresAt != null && Instant.now().isBefore(expiresAt);
    }

    private boolean trySendOtpEmail(String recipientEmail, String otp) {
        if (!StringUtils.hasText(fromAddress)) {
            log.warn("OTP email delivery is not configured because no from-address is set.");
            return false;
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("OTP email delivery is not configured because JavaMailSender is unavailable.");
            return false;
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(recipientEmail);
        message.setSubject("HVHN verification code");
        message.setText(buildOtpEmailBody(otp));

        try {
            mailSender.send(message);
            return true;
        } catch (MailException exception) {
            log.error("Failed to send OTP email to {}", recipientEmail, exception);
            if (!debugReturnOtp) {
                throw new IllegalStateException(
                        "Could not send the OTP email. Check the backend SMTP settings and try again."
                );
            }
            return false;
        }
    }

    private String buildOtpEmailBody(String otp) {
        return """
                Your HVHN verification code is %s.

                It expires in %d minutes.

                If you did not request this code, you can ignore this email.
                """.formatted(otp, Math.max(1, otpLifetime.toMinutes()));
    }

    private void clearExpiredState(String email, Instant now) {
        PendingOtp pendingOtp = pendingOtps.get(email);
        if (pendingOtp != null && now.isAfter(pendingOtp.expiresAt())) {
            pendingOtps.remove(email);
        }

        Instant verifiedUntil = verifiedEmails.get(email);
        if (verifiedUntil != null && now.isAfter(verifiedUntil)) {
            verifiedEmails.remove(email);
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private String generateOtp() {
        return String.format("%06d", RANDOM.nextInt(1_000_000));
    }

    private record PendingOtp(String code, Instant expiresAt, Instant sentAt) {
    }
}
