package com.hvhn.backend.service;

import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class ChatSessionRegistry {

    private final ConcurrentHashMap<String, String> sessionToUser = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> userToSessions = new ConcurrentHashMap<>();

    public boolean registerSession(String sessionId, String userId) {
        sessionToUser.put(sessionId, userId);
        Set<String> sessions = userToSessions.computeIfAbsent(userId, key -> ConcurrentHashMap.newKeySet());
        sessions.add(sessionId);
        return sessions.size() == 1;
    }

    public int getActiveSessionCount(String userId) {
        Set<String> sessions = userToSessions.get(userId);
        return sessions == null ? 0 : sessions.size();
    }

    public Optional<String> unregisterSession(String sessionId) {
        String userId = sessionToUser.remove(sessionId);
        if (userId == null) {
            return Optional.empty();
        }

        Set<String> sessions = userToSessions.get(userId);
        if (sessions == null) {
            return Optional.of(userId);
        }

        sessions.remove(sessionId);
        if (sessions.isEmpty()) {
            userToSessions.remove(userId);
        }

        return Optional.of(userId);
    }

    public boolean hasActiveSession(String userId) {
        Set<String> sessions = userToSessions.get(userId);
        return sessions != null && !sessions.isEmpty();
    }
}
