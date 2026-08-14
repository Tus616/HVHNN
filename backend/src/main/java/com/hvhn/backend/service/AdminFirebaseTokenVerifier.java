package com.hvhn.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.ErrorCode;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.hvhn.backend.dto.FirebaseUserDto;
import com.hvhn.backend.exception.FirebaseAuthenticationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Map;

@Service
public class AdminFirebaseTokenVerifier implements FirebaseTokenVerifier {

    private static final Logger logger = LoggerFactory.getLogger(AdminFirebaseTokenVerifier.class);

    private final FirebaseAuth firebaseAuth;
    private final int verificationRetryAttempts;
    private final long verificationRetryDelayMs;
    private final boolean productionProfile;

    public AdminFirebaseTokenVerifier(
            ObjectProvider<FirebaseAuth> firebaseAuthProvider,
            Environment environment,
            @Value("${firebase.auth.retry-attempts:2}") int verificationRetryAttempts,
            @Value("${firebase.auth.retry-delay-ms:250}") long verificationRetryDelayMs
    ) {
        this.firebaseAuth = firebaseAuthProvider.getIfAvailable();
        this.verificationRetryAttempts = Math.max(1, verificationRetryAttempts);
        this.verificationRetryDelayMs = Math.max(0L, verificationRetryDelayMs);
        this.productionProfile = java.util.Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> profile.equalsIgnoreCase("prod") || profile.equalsIgnoreCase("production"));
    }

    @Override
    public FirebaseUserDto verify(String idToken) {
        if (!StringUtils.hasText(idToken)) {
            logger.warn("Firebase token verification failed because the ID token was missing.");
            throw new FirebaseAuthenticationException("Missing Firebase ID token");
        }

        String sanitizedToken = idToken.trim();
        if (firebaseAuth == null) {
            if (productionProfile) {
                throw new IllegalStateException("Firebase authentication is not configured.");
            }
            logger.warn("Firebase is not configured on the backend. Performing unsafe local decoding of the token for development purposes.");
            return decodeTokenUnsafe(sanitizedToken);
        }

        for (int attempt = 1; attempt <= verificationRetryAttempts; attempt++) {
            try {
                FirebaseToken decodedToken = firebaseAuth.verifyIdToken(sanitizedToken);
                logger.info("Firebase token verified successfully on attempt {} for uid={}, email={}",
                        attempt, decodedToken.getUid(), decodedToken.getEmail());
                return new FirebaseUserDto(
                        decodedToken.getEmail(),
                        decodedToken.getName(),
                        decodedToken.getUid(),
                        Boolean.TRUE.equals(decodedToken.isEmailVerified())
                );
            } catch (FirebaseAuthException exception) {
                if (isTransientFailure(exception) && attempt < verificationRetryAttempts) {
                    logger.warn("Transient Firebase token verification failure on attempt {}/{}. authErrorCode={} errorCode={} message={}",
                            attempt, verificationRetryAttempts, exception.getAuthErrorCode(),
                            exception.getErrorCode(), exception.getMessage());
                    sleepBeforeRetry();
                    continue;
                }
                throw mapVerificationFailure(exception);
            } catch (RuntimeException exception) {
                logger.error("Unexpected Firebase runtime failure while verifying token. serverTimeUtc={} zoneId={}",
                        Instant.now(), ZoneId.systemDefault(), exception);
                throw new IllegalStateException("Firebase authentication service is unavailable", exception);
            }
        }

        throw new IllegalStateException("Firebase authentication service is unavailable");
    }

    private RuntimeException mapVerificationFailure(FirebaseAuthException exception) {
        AuthErrorCode authErrorCode = exception.getAuthErrorCode();
        ErrorCode errorCode = exception.getErrorCode();

        if (authErrorCode == AuthErrorCode.EXPIRED_ID_TOKEN) {
            logClockDiagnostic("expired Firebase ID token", exception);
            throw new FirebaseAuthenticationException("Firebase ID token has expired. Sign in again.", exception);
        }
        if (authErrorCode == AuthErrorCode.INVALID_ID_TOKEN) {
            logger.warn("Firebase token verification failed because the token was invalid: {}", exception.getMessage());
            throw new FirebaseAuthenticationException("Firebase ID token is invalid.", exception);
        }
        if (authErrorCode == AuthErrorCode.REVOKED_ID_TOKEN) {
            logger.warn("Firebase token verification failed because the token was revoked.");
            throw new FirebaseAuthenticationException("Firebase ID token has been revoked. Sign in again.", exception);
        }
        if (authErrorCode == AuthErrorCode.USER_DISABLED) {
            logger.warn("Firebase token verification failed because the Firebase user is disabled.");
            throw new FirebaseAuthenticationException("The Firebase user account is disabled.", exception);
        }
        if (authErrorCode == AuthErrorCode.CERTIFICATE_FETCH_FAILED || isTransientErrorCode(errorCode)) {
            logClockDiagnostic("transient Firebase verification failure", exception);
            throw new IllegalStateException("Firebase authentication service is temporarily unavailable. Please retry.", exception);
        }

        logger.warn("Firebase token verification failed. authErrorCode={} errorCode={} message={}",
                authErrorCode, errorCode, exception.getMessage());
        throw new FirebaseAuthenticationException("Firebase ID token could not be verified.", exception);
    }

    private boolean isTransientFailure(FirebaseAuthException exception) {
        return exception.getAuthErrorCode() == AuthErrorCode.CERTIFICATE_FETCH_FAILED
                || isTransientErrorCode(exception.getErrorCode());
    }

    private boolean isTransientErrorCode(ErrorCode errorCode) {
        return errorCode == ErrorCode.UNAVAILABLE
                || errorCode == ErrorCode.INTERNAL
                || errorCode == ErrorCode.DEADLINE_EXCEEDED
                || errorCode == ErrorCode.UNKNOWN;
    }

    private void sleepBeforeRetry() {
        if (verificationRetryDelayMs <= 0) {
            return;
        }
        try {
            Thread.sleep(verificationRetryDelayMs);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Firebase token verification retry was interrupted", exception);
        }
    }

    private void logClockDiagnostic(String reason, FirebaseAuthException exception) {
        logger.warn("Firebase verification failed due to {}. serverTimeUtc={} epochMillis={} zoneId={} authErrorCode={} errorCode={}",
                reason, Instant.now(), System.currentTimeMillis(), ZoneId.systemDefault(),
                exception.getAuthErrorCode(), exception.getErrorCode(), exception);
    }

    private FirebaseUserDto decodeTokenUnsafe(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                throw new IllegalArgumentException("Invalid JWT token format. Expected 3 parts but got " + parts.length);
            }

            byte[] payloadBytes = Base64.getUrlDecoder().decode(parts[1]);
            String payloadStr = new String(payloadBytes, StandardCharsets.UTF_8);
            Map<String, Object> claims = new ObjectMapper().readValue(payloadStr, new TypeReference<>() {});

            String email = (String) claims.get("email");
            String name = (String) claims.get("name");
            String uid = (String) claims.get("user_id");
            if (uid == null) uid = (String) claims.get("sub");

            Object emailVerifiedClaim = claims.get("email_verified");
            boolean emailVerified = emailVerifiedClaim instanceof Boolean
                    ? (Boolean) emailVerifiedClaim
                    : Boolean.parseBoolean(String.valueOf(emailVerifiedClaim));

            return new FirebaseUserDto(email, name, uid, emailVerified);
        } catch (Exception exception) {
            logger.error("Failed to decode mock Firebase token.", exception);
            throw new FirebaseAuthenticationException("Failed to decode mock Firebase token.", exception);
        }
    }
}
