package com.hvhn.backend.service;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.hvhn.backend.dto.FirebaseTokenResponse;
import com.hvhn.backend.dto.FirebaseUserDto;
import com.hvhn.backend.exception.FirebaseAuthenticationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Map;

@Service
public class FirebaseService {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseService.class);

    private final FirebaseMessaging firebaseMessaging;
    private final FirebaseTokenVerifier firebaseTokenVerifier;

    public FirebaseService(
            org.springframework.beans.factory.ObjectProvider<FirebaseMessaging> firebaseMessagingProvider,
            FirebaseTokenVerifier firebaseTokenVerifier
    ) {
        this.firebaseMessaging = firebaseMessagingProvider.getIfAvailable();
        this.firebaseTokenVerifier = firebaseTokenVerifier;
    }

    public FirebaseUserDto verifyAndDecodeIdToken(String idToken) {
        return firebaseTokenVerifier.verify(idToken);
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
        sendNotification(token, title, body, Map.of());
    }

    public String sendNotification(String token, String title, String body, Map<String, String> data) {
        if (!StringUtils.hasText(token) || !StringUtils.hasText(title) || !StringUtils.hasText(body)) {
            throw new IllegalArgumentException("Notification token, title, and body must all be provided");
        }
        if (firebaseMessaging == null) {
            throw new IllegalStateException("Firebase notification provider unavailable");
        }

        Message.Builder messageBuilder = Message.builder()
                .setToken(token)
                .setNotification(Notification.builder()
                        .setTitle(title)
                        .setBody(body)
                        .build());
        if (data != null && !data.isEmpty()) {
            messageBuilder.putAllData(data);
        }
        Message message = messageBuilder.build();

        try {
            String messageId = firebaseMessaging.send(message);
            logger.info(
                    "Firebase notification sent successfully. messageId={}, tokenSuffix={}",
                    messageId,
                    maskToken(token)
            );
            return messageId;
        } catch (FirebaseMessagingException exception) {
            logger.error(
                    "Failed to send Firebase notification to tokenSuffix={}.",
                    maskToken(token),
                    exception
            );
            throw new IllegalStateException("Failed to send Firebase notification", exception);
        }
    }

    private String maskToken(String token) {
        int visibleCharacters = Math.min(6, token.length());
        return token.substring(token.length() - visibleCharacters);
    }
}
