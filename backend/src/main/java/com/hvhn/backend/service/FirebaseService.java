package com.hvhn.backend.service;

import com.google.firebase.ErrorCode;
import com.google.firebase.auth.AuthErrorCode;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.hvhn.backend.dto.FirebaseTokenResponse;
import com.hvhn.backend.dto.FirebaseUserDto;
import com.hvhn.backend.exception.FirebaseAuthenticationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

@Service
public class FirebaseService {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseService.class);

    private final FirebaseAuth firebaseAuth;
    private final FirebaseMessaging firebaseMessaging;
    private final int verificationRetryAttempts;
    private final long verificationRetryDelayMs;

    public FirebaseService(
            org.springframework.beans.factory.ObjectProvider<FirebaseAuth> firebaseAuthProvider,
            org.springframework.beans.factory.ObjectProvider<FirebaseMessaging> firebaseMessagingProvider,
            @Value("${firebase.auth.retry-attempts:2}") int verificationRetryAttempts,
            @Value("${firebase.auth.retry-delay-ms:250}") long verificationRetryDelayMs
    ) {
        this.firebaseAuth = firebaseAuthProvider.getIfAvailable();
        this.firebaseMessaging = firebaseMessagingProvider.getIfAvailable();
        this.verificationRetryAttempts = Math.max(1, verificationRetryAttempts);
        this.verificationRetryDelayMs = Math.max(0L, verificationRetryDelayMs);
    }

    public FirebaseUserDto verifyAndDecodeIdToken(String idToken) {
        if (!StringUtils.hasText(idToken)) {
            logger.warn("Firebase token verification failed because the ID token was missing.");
            throw new FirebaseAuthenticationException("Missing Firebase ID token");
        }

        String sanitizedToken = idToken.trim();

        if (firebaseAuth == null) {
            logger.warn("Firebase is not configured on the backend. Performing unsafe local decoding of the token for development purposes.");
            return decodeTokenUnsafe(sanitizedToken);
        }

        for (int attempt = 1; attempt <= verificationRetryAttempts; attempt++) {
            try {
                FirebaseToken decodedToken = firebaseAuth.verifyIdToken(sanitizedToken);
                logger.info(
                        "Firebase token verified successfully on attempt {} for uid={}, email={}",
                        attempt,
                        decodedToken.getUid(),
                        decodedToken.getEmail()
                );
                return new FirebaseUserDto(
                    decodedToken.getEmail(),
                    decodedToken.getName(),
                    decodedToken.getUid(),
                    Boolean.TRUE.equals(decodedToken.isEmailVerified())
                );
            } catch (FirebaseAuthException exception) {
                // Only retry failures that come from Firebase certificate fetch or transient backend issues.
                if (isTransientFailure(exception) && attempt < verificationRetryAttempts) {
                    logger.warn(
                            "Transient Firebase token verification failure on attempt {}/{}. authErrorCode={} errorCode={} message={}",
                            attempt,
                            verificationRetryAttempts,
                            exception.getAuthErrorCode(),
                            exception.getErrorCode(),
                            exception.getMessage()
                    );
                    sleepBeforeRetry();
                    continue;
                }

                throw mapVerificationFailure(exception);
            } catch (RuntimeException exception) {
                logger.error(
                        "Unexpected Firebase runtime failure while verifying token. serverTimeUtc={} zoneId={}",
                        Instant.now(),
                        ZoneId.systemDefault(),
                        exception
                );
                throw new IllegalStateException("Firebase authentication service is unavailable", exception);
            }
        }

        throw new IllegalStateException("Firebase authentication service is unavailable");
    }

    public FirebaseTokenResponse verifyIdToken(String idToken) {
        FirebaseUserDto decodedToken = verifyAndDecodeIdToken(idToken);

        return new FirebaseTokenResponse(
                true,
                "Firebase ID token is valid",
                decodedToken.getUid(),
                decodedToken.getEmail(),
                decodedToken.isEmailVerified()
        );
    }

    public void sendNotification(String token, String title, String body) {
        if (!StringUtils.hasText(token) || !StringUtils.hasText(title) || !StringUtils.hasText(body)) {
            throw new IllegalArgumentException("Notification token, title, and body must all be provided");
        }

        Message message = Message.builder()
                .setToken(token)
                .setNotification(Notification.builder()
                        .setTitle(title)
                        .setBody(body)
                        .build())
                .build();

        try {
            String messageId = firebaseMessaging.send(message);
            logger.info(
                    "Firebase notification sent successfully. messageId={}, tokenSuffix={}",
                    messageId,
                    maskToken(token)
            );
        } catch (FirebaseMessagingException exception) {
            logger.error(
                    "Failed to send Firebase notification to tokenSuffix={}.",
                    maskToken(token),
                    exception
            );
            throw new IllegalStateException("Failed to send Firebase notification", exception);
        }
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

        logger.warn(
                "Firebase token verification failed. authErrorCode={} errorCode={} message={}",
                authErrorCode,
                errorCode,
                exception.getMessage()
        );
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
        logger.warn(
                "Firebase verification failed due to {}. serverTimeUtc={} epochMillis={} zoneId={} authErrorCode={} errorCode={}",
                reason,
                Instant.now(),
                System.currentTimeMillis(),
                ZoneId.systemDefault(),
                exception.getAuthErrorCode(),
                exception.getErrorCode(),
                exception
        );
    }

    private String maskToken(String token) {
        int visibleCharacters = Math.min(6, token.length());
        return token.substring(token.length() - visibleCharacters);
    }

    private FirebaseUserDto decodeTokenUnsafe(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                throw new IllegalArgumentException("Invalid JWT token format. Expected 3 parts but got " + parts.length);
            }
            
            // JWT payload is the second part, using URL-safe base64 encoding (without padding)
            byte[] payloadBytes = Base64.getUrlDecoder().decode(parts[1]);
            String payloadStr = new String(payloadBytes, StandardCharsets.UTF_8);
            
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> claims = mapper.readValue(payloadStr, new TypeReference<Map<String, Object>>() {});
            
            String email = (String) claims.get("email");
            String name = (String) claims.get("name");
            String uid = (String) claims.get("user_id");
            if (uid == null) uid = (String) claims.get("sub");
            
            Object ev = claims.get("email_verified");
            boolean emailVerified = false;
            if (ev instanceof Boolean) {
                emailVerified = (Boolean) ev;
            } else if (ev != null) {
                emailVerified = Boolean.parseBoolean(ev.toString());
            }
            
            return new FirebaseUserDto(email, name, uid, emailVerified);
        } catch (Exception e) {
            logger.error("Failed to decode mock Firebase token: {}", maskToken(token), e);
            throw new FirebaseAuthenticationException("Failed to decode mock Firebase token: " + e.getMessage(), e);
        }
    }
}
