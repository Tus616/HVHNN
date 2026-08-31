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
import org.springframework.core.io.ResourceLoader;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.ZoneId;

@Configuration
public class FirebaseConfig {

    private static final Logger logger = LoggerFactory.getLogger(FirebaseConfig.class);
    private static final Object FIREBASE_INIT_MONITOR = new Object();

    private final String serviceAccountPath;
    private final ResourceLoader resourceLoader;

    public FirebaseConfig(
            @Value("${firebase.service-account.path:}")
            String serviceAccountPath,
            ResourceLoader resourceLoader
    ) {
        this.serviceAccountPath = serviceAccountPath;
        this.resourceLoader = resourceLoader;
    }

    @Bean
    public FirebaseApp firebaseApp() {
        synchronized (FIREBASE_INIT_MONITOR) {
            // FirebaseApp is a JVM-global singleton inside the Admin SDK, so we reuse it if another
            // Spring context or test already initialized the default app.
            if (!FirebaseApp.getApps().isEmpty()) {
                FirebaseApp existingApp = FirebaseApp.getInstance();
                logger.info(
                        "Reusing existing Firebase app '{}'. serverTimeUtc={} zoneId={}",
                        existingApp.getName(),
                        Instant.now(),
                        ZoneId.systemDefault()
                );
                return existingApp;
            }

            if (!StringUtils.hasText(serviceAccountPath)) {
                logger.warn("Firebase service account path is not configured. Bypassing Firebase initialization.");
                return null;
            }

            InputStream serviceAccountStream = null;
            String sourceDescription = null;

            try {
                java.nio.file.Path path = java.nio.file.Paths.get(serviceAccountPath);
                if (path.isAbsolute() && java.nio.file.Files.exists(path)) {
                    serviceAccountStream = java.nio.file.Files.newInputStream(path);
                    sourceDescription = "absolute file path [" + path.toAbsolutePath() + "]";
                }
            } catch (Exception e) {
                // Ignore InvalidPathException (e.g. for "classpath:...") and fall back to Spring ResourceLoader
            }

            if (serviceAccountStream == null) {
                Resource serviceAccountResource = resourceLoader.getResource(serviceAccountPath);
                if (serviceAccountResource.exists()) {
                    try {
                        serviceAccountStream = serviceAccountResource.getInputStream();
                        sourceDescription = serviceAccountResource.getDescription();
                    } catch (IOException e) {
                        logger.warn("Could not read Spring resource {}: {}", serviceAccountResource.getDescription(), e.getMessage());
                    }
                }
            }

            if (serviceAccountStream == null) {
                logger.warn(
                        "Firebase service account file was not found at [{}]. Bypassing Firebase initialization.",
                        serviceAccountPath
                );
                return null;
            }

            try (InputStream finalStream = serviceAccountStream) {
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(GoogleCredentials.fromStream(finalStream))
                        .build();

                FirebaseApp firebaseApp = FirebaseApp.initializeApp(options);
                logger.info(
                        "Initialized Firebase app '{}' using {}. serverTimeUtc={} zoneId={}",
                        firebaseApp.getName(),
                        sourceDescription,
                        Instant.now(),
                        ZoneId.systemDefault()
                );
                return firebaseApp;
            } catch (IOException exception) {
                throw new IllegalStateException(
                        "Failed to initialize Firebase from "
                                + sourceDescription
                                + ". Ensure the service account JSON is present and valid.",
                        exception
                );
            }
        }
    }

    @Bean
    public FirebaseAuth firebaseAuth(org.springframework.beans.factory.ObjectProvider<FirebaseApp> firebaseAppProvider) {
        FirebaseApp firebaseApp = firebaseAppProvider.getIfAvailable();
        if (firebaseApp == null) return null;
        logger.info("Creating FirebaseAuth client for app '{}'.", firebaseApp.getName());
        return FirebaseAuth.getInstance(firebaseApp);
    }

    @Bean
    public FirebaseMessaging firebaseMessaging(org.springframework.beans.factory.ObjectProvider<FirebaseApp> firebaseAppProvider) {
        FirebaseApp firebaseApp = firebaseAppProvider.getIfAvailable();
        if (firebaseApp == null) return null;
        logger.info("Creating FirebaseMessaging client for app '{}'.", firebaseApp.getName());
        return FirebaseMessaging.getInstance(firebaseApp);
    }
}
