package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.RequestVolunteerRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class MlIntelligenceServiceTest {

    @Mock
    private ObjectMapper objectMapper;
    @Mock
    private HelpRequestRepository requestRepository;
    @Mock
    private RequestVolunteerRepository requestVolunteerRepository;

    @Test
    void timeoutIsHonoredAndNotCappedAt5Seconds() throws Exception {
        // Given a configured timeout of 90 seconds
        int configuredTimeoutSeconds = 90;

        MlIntelligenceService service = new MlIntelligenceService(
                true,
                "http://localhost:8001",
                configuredTimeoutSeconds,
                objectMapper,
                requestRepository,
                requestVolunteerRepository
        );

        // Access the private requestTimeout field using reflection
        Field requestTimeoutField = MlIntelligenceService.class.getDeclaredField("requestTimeout");
        requestTimeoutField.setAccessible(true);
        Duration requestTimeout = (Duration) requestTimeoutField.get(service);

        // Then it should be precisely 90 seconds, not reduced to 5
        assertThat(requestTimeout).isEqualTo(Duration.ofSeconds(90));
    }

    @Test
    void timeoutIsSanitizedToMinimumOf1Second() throws Exception {
        // Given a configured timeout of 0 (or negative)
        int configuredTimeoutSeconds = 0;

        MlIntelligenceService service = new MlIntelligenceService(
                true,
                "http://localhost:8001",
                configuredTimeoutSeconds,
                objectMapper,
                requestRepository,
                requestVolunteerRepository
        );

        Field requestTimeoutField = MlIntelligenceService.class.getDeclaredField("requestTimeout");
        requestTimeoutField.setAccessible(true);
        Duration requestTimeout = (Duration) requestTimeoutField.get(service);

        // Then it should be sanitized to 1 second
        assertThat(requestTimeout).isEqualTo(Duration.ofSeconds(1));
    }
}
