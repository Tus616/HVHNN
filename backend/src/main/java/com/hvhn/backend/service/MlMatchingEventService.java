package com.hvhn.backend.service;

import com.hvhn.backend.model.MlMatchingEvent;
import com.hvhn.backend.repository.MlMatchingEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class MlMatchingEventService {
    private final MlMatchingEventRepository repository;

    public MlMatchingEventService(MlMatchingEventRepository repository) {
        this.repository = repository;
    }

    public void recordRanking(String requestId, List<Map<String, Object>> ranked, String modelVersion, String rankingMode) {
        if (!StringUtils.hasText(requestId) || ranked == null) return;
        for (Map<String, Object> item : ranked) {
            String userId = String.valueOf(item.getOrDefault("userId", ""));
            if (!StringUtils.hasText(userId)) continue;
            MlMatchingEvent event = repository.findByRequestIdAndCandidateUserId(requestId, userId).orElseGet(MlMatchingEvent::new);
            event.setRequestId(requestId);
            event.setCandidateUserId(userId);
            event.setModelVersion(StringUtils.hasText(modelVersion) ? modelVersion : "phase10-volunteer-ranker-v1");
            event.setRankingMode(StringUtils.hasText(rankingMode) ? rankingMode : "BOOTSTRAP_RANKING");
            event.setRank(number(item.get("rank"), 0).intValue());
            event.setScore(number(item.get("score"), 0.0).doubleValue());
            if (event.getCreatedAt() == null) event.setCreatedAt(LocalDateTime.now());
            event.setUpdatedAt(LocalDateTime.now());
            repository.save(event);
        }
    }

    public void markAccepted(String requestId, String userId) {
        if (!StringUtils.hasText(requestId) || !StringUtils.hasText(userId)) return;
        repository.findByRequestIdAndCandidateUserId(requestId, userId).ifPresent(event -> {
            event.setAccepted(true);
            event.setAcceptedAt(LocalDateTime.now());
            event.setUpdatedAt(LocalDateTime.now());
            repository.save(event);
        });
    }

    public void markCompleted(String requestId, String userId) {
        if (!StringUtils.hasText(requestId) || !StringUtils.hasText(userId)) return;
        repository.findByRequestIdAndCandidateUserId(requestId, userId).ifPresent(event -> {
            event.setCompleted(true);
            event.setCompletedAt(LocalDateTime.now());
            event.setUpdatedAt(LocalDateTime.now());
            repository.save(event);
        });
    }

    private Number number(Object value, double fallback) {
        if (value instanceof Number n) return n;
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (RuntimeException ignored) {
            return fallback;
        }
    }
}
