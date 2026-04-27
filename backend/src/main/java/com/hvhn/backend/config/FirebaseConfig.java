package com.hvhn.backend.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.messaging.FirebaseMessaging;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.ZoneId;

@Configuration
public class FirebaseConfig {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseConfig.class);
    private static final Object FIREBASE_INIT_MONITOR = new Object();

    private final Resource serviceAccountResource;

    public FirebaseConfig(
            @Value("${firebase.service-account.path:classpath:firebase/serviceAccountKey.json}")
            Resource serviceAccountResource
    ) {
        this.serviceAccountResource = serviceAccountResource;
    }

    @Bean
    public FirebaseApp firebaseApp() {
        synchronized (FIREBASE_INIT_MONITOR) {
            // FirebaseApp is a JVM-global singleton inside the Admin SDK, so we reuse it if another
            // Spring context or test already initialized the default app.
            if (!FirebaseApp.getApps().isEmpty()) {
                FirebaseApp existingApp = FirebaseApp.getInstance();
                logger.info(
                        "Reusing existing Firebase app '{}' from {}. serverTimeUtc={} zoneId={}",
                        existingApp.getName(),
                        serviceAccountResource.getDescription(),
                        Instant.now(),
                        ZoneId.systemDefault()
                );
                return existingApp;
            }

            if (!serviceAccountResource.exists()) {
                throw new IllegalStateException(
                        "Firebase service account file was not found at "
                                + serviceAccountResource.getDescription()
                                + ". Set firebase.service-account.path to a valid classpath resource."
                );
            }

            try (InputStream serviceAccount = serviceAccountResource.getInputStream()) {
                // Loading from a Spring Resource keeps the same path working from the IDE and packaged JARs.
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .build();

                FirebaseApp firebaseApp = FirebaseApp.initializeApp(options);
                logger.info(
                        "Initialized Firebase app '{}' using {}. serverTimeUtc={} zoneId={}",
                        firebaseApp.getName(),
                        serviceAccountResource.getDescription(),
                        Instant.now(),
                        ZoneId.systemDefault()
                );
                return firebaseApp;
            } catch (IOException exception) {
                throw new IllegalStateException(
                        "Failed to initialize Firebase from "
                                + serviceAccountResource.getDescription()
                                + ". Ensure the service account JSON is present and valid.",
                        exception
                );
            }
        }
    }

    @Bean
    public FirebaseAuth firebaseAuth(FirebaseApp firebaseApp) {
        logger.info("Creating FirebaseAuth client for app '{}'.", firebaseApp.getName());
        return FirebaseAuth.getInstance(firebaseApp);
    }

    @Bean
    public FirebaseMessaging firebaseMessaging(FirebaseApp firebaseApp) {
        logger.info("Creating FirebaseMessaging client for app '{}'.", firebaseApp.getName());
        return FirebaseMessaging.getInstance(firebaseApp);
    }
}
