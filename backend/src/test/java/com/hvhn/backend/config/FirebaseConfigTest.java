package com.hvhn.backend.config;

import com.google.firebase.FirebaseApp;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.ResourceLoader;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FirebaseConfigTest {

    private final ResourceLoader resourceLoader = new DefaultResourceLoader();

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        // Clear apps before tests to avoid contamination if previous tests left something
        for (FirebaseApp app : FirebaseApp.getApps()) {
            app.delete();
        }
    }

    @AfterEach
    void tearDown() {
        for (FirebaseApp app : FirebaseApp.getApps()) {
            app.delete();
        }
    }

    @Test
    void firebaseApp_bypassed_whenPathIsBlank() {
        FirebaseConfig config = new FirebaseConfig("", resourceLoader);
        FirebaseApp app = config.firebaseApp();
        assertThat(app).isNull();
    }

    @Test
    void firebaseApp_bypassed_whenFileIsMissing() {
        FirebaseConfig config = new FirebaseConfig("/some/missing/file.json", resourceLoader);
        FirebaseApp app = config.firebaseApp();
        assertThat(app).isNull();
    }

    @Test
    void firebaseApp_throwsException_whenInvalidJsonFileProvidedAsAbsoluteFile() throws Exception {
        // We write an invalid json to an absolute path.
        // It should attempt to load and throw an exception because the credentials fail to parse.
        Path serviceAccountFile = tempDir.resolve("invalid-service-account.json");
        Files.writeString(serviceAccountFile, "invalid json");

        FirebaseConfig config = new FirebaseConfig(serviceAccountFile.toAbsolutePath().toString(), resourceLoader);
        assertThatThrownBy(config::firebaseApp)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to initialize Firebase from absolute file path")
                .hasMessageContaining(serviceAccountFile.toAbsolutePath().toString());
    }

    @Test
    void firebaseApp_throwsException_whenInvalidJsonFileProvidedAsClasspath() throws Exception {
        // It falls back to ResourceLoader if the path is not absolute or doesn't exist on standard filesystem.
        // For testing we will use a known existing resource, but in test classpath, that is not a json.
        // Let's use application-test.properties for example.
        FirebaseConfig config = new FirebaseConfig("classpath:application-test.properties", resourceLoader);
        assertThatThrownBy(config::firebaseApp)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to initialize Firebase from class path resource [application-test.properties]");
    }
}
