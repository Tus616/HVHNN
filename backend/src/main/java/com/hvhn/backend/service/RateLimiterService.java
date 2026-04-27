package com.hvhn.backend.service;

import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class RateLimiterService {
    private final Map<String, UserRateLimit> rateLimits = new ConcurrentHashMap<>();

    public void checkRateLimit(String userId, int maxRequests, int windowSeconds) {
        long now = System.currentTimeMillis();
        long windowMs = windowSeconds * 1000L;
        
        UserRateLimit limit = rateLimits.computeIfAbsent(userId, k -> new UserRateLimit(now));
        
        if (now - limit.windowStart > windowMs) {
            limit.reset(now);
        }
        
        if (limit.count >= maxRequests) {
            throw new RuntimeException("Rate limit exceeded: " + maxRequests + " requests per " + windowSeconds + " seconds allowed.");
        }
        
        limit.count++;
    }

    private static class UserRateLimit {
        long windowStart;
        int count;

        UserRateLimit(long now) {
            this.windowStart = now;
            this.count = 0;
        }

        void reset(long now) {
            this.windowStart = now;
            this.count = 0;
        }
    }
}
