package com.hvhn.backend.service;

import com.hvhn.backend.model.MlMatchingEvent;
import com.hvhn.backend.repository.MlMatchingEventRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MlMatchingEventServiceTest {

    private final MlMatchingEventRepository repository = mock(MlMatchingEventRepository.class);
    private final MlMatchingEventService service = new MlMatchingEventService(repository);

    @Test
    void recordsRankingWithModeAndScore() {
        when(repository.findByRequestIdAndCandidateUserId("r1", "u1")).thenReturn(Optional.empty());

        service.recordRanking("r1", List.of(Map.of("userId", "u1", "rank", 1, "score", 0.86)), "phase10", "BOOTSTRAP_RANKING");

        ArgumentCaptor<MlMatchingEvent> captor = ArgumentCaptor.forClass(MlMatchingEvent.class);
        verify(repository).save(captor.capture());
        MlMatchingEvent event = captor.getValue();
        assertThat(event.getRequestId()).isEqualTo("r1");
        assertThat(event.getCandidateUserId()).isEqualTo("u1");
        assertThat(event.getRankingMode()).isEqualTo("BOOTSTRAP_RANKING");
        assertThat(event.getScore()).isEqualTo(0.86);
        assertThat(event.getUpdatedAt()).isNotNull();
    }

    @Test
    void acceptedAndCompletedFlagsUpdateExistingEvent() {
        MlMatchingEvent event = new MlMatchingEvent();
        when(repository.findByRequestIdAndCandidateUserId("r1", "u1")).thenReturn(Optional.of(event));

        service.markAccepted("r1", "u1");
        service.markCompleted("r1", "u1");

        assertThat(event.isAccepted()).isTrue();
        assertThat(event.isCompleted()).isTrue();
        assertThat(event.getAcceptedAt()).isNotNull();
        assertThat(event.getCompletedAt()).isNotNull();
    }
}
