package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.HelpRequestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Fake request detection and risk scoring service.
 * Combines rule-based signals with AI analysis to assign a risk score (0-100).
 */
@Service
public class RiskScoringService {

    private static final Logger logger = LoggerFactory.getLogger(RiskScoringService.class);

    private final GeminiService geminiService;
    private final HelpRequestRepository helpRequestRepository;

    public RiskScoringService(GeminiService geminiService,
                               HelpRequestRepository helpRequestRepository) {
        this.geminiService = geminiService;
        this.helpRequestRepository = helpRequestRepository;
    }

    /**
     * Calculate a risk score for a help request.
     * Returns a RiskAssessment with score (0-100), level, flags, and verification requirements.
     */
    public RiskAssessment assessRisk(HelpRequest request, User requester) {
        List<String> flags = new ArrayList<>();
        int ruleScore = 0;

        // === Rule-Based Signals ===

        // 1. Check request frequency (too many requests in 24h is suspicious)
        List<HelpRequest> recentRequests = helpRequestRepository.findByRequesterId(requester.getId())
                .stream()
                .filter(r -> r.getCreatedAt() != null &&
                        r.getCreatedAt().isAfter(LocalDateTime.now().minusHours(24)))
                .toList();

        if (recentRequests.size() >= 5) {
            ruleScore += 25;
            flags.add("HIGH_FREQUENCY: " + recentRequests.size() + " requests in last 24 hours");
        } else if (recentRequests.size() >= 3) {
            ruleScore += 10;
            flags.add("MODERATE_FREQUENCY: " + recentRequests.size() + " requests in last 24 hours");
        }

        // 2. Check for repeated/similar descriptions
        long duplicateCount = recentRequests.stream()
                .filter(r -> r.getDescription() != null && request.getDescription() != null)
                .filter(r -> similarText(r.getDescription(), request.getDescription()))
                .count();

        if (duplicateCount > 1) {
            ruleScore += 20;
            flags.add("DUPLICATE_CONTENT: Similar description found in " + duplicateCount + " recent requests");
        }

        // 3. New/unverified user
        if (!requester.isVerified()) {
            ruleScore += 15;
            flags.add("UNVERIFIED_USER: User email is not verified");
        }

        // 4. Low trust score (new users with few completed requests)
        if (requester.getRequestsHelped() == 0 && requester.getPoints() < 50) {
            ruleScore += 10;
            flags.add("LOW_TRUST: New user with no help history");
        }

        // 5. High-risk categories automatically get higher base scores
        String category = request.getCategory() != null ? request.getCategory().toUpperCase() : "";
        if (category.contains("BLOOD") || category.contains("MEDICAL")) {
            ruleScore += 10;
            flags.add("HIGH_RISK_CATEGORY: " + category + " requires verification");
        }

        // 6. Suspicious text patterns (Scams/Financial)
        String description = request.getDescription() != null ? request.getDescription().toLowerCase() : "";
        List<String> suspiciousKeywords = Arrays.asList(
            "send money", "bank account", "upi", "paytm", "gpay", "phonepe", 
            "transfer", "cash", "loan", "investment", "whatsapp me", "contact on",
            "urgent fund", "donation needed", "help money", "profit", "earn"
        );

        for (String keyword : suspiciousKeywords) {
            if (description.contains(keyword)) {
                ruleScore += 15;
                flags.add("SUSPICIOUS_KEYWORD: " + keyword);
                break; // Only add once for keywords
            }
        }
        
        // 7. Title quality check
        if (request.getTitle() != null) {
            String title = request.getTitle();
            if (title.length() < 10) {
                ruleScore += 5;
                flags.add("VAGUE_TITLE: Title is too short");
            }
            if (title.equals(title.toUpperCase()) && title.length() > 5) {
                ruleScore += 10;
                flags.add("ALL_CAPS_TITLE: Potential manipulation or attention-seeking");
            }
        }

        // === AI-Based Analysis ===
        int aiScore = 0;
        if (geminiService.isAvailable()) {
            try {
                aiScore = getAiRiskScore(request, requester, recentRequests.size());
                if (aiScore > 0) {
                    flags.add("AI_RISK_SIGNAL: Gemini flagged suspicious patterns (score: " + aiScore + ")");
                }
            } catch (Exception e) {
                logger.warn("AI risk analysis failed: {}", e.getMessage());
            }
        }

        // === Combine Scores ===
        int totalScore = Math.min(100, ruleScore + aiScore);
        String riskLevel = calculateRiskLevel(totalScore);

        // === Determine Verification Requirements ===
        List<String> verificationRequired = determineVerification(riskLevel, category);

        logger.info("Risk assessment for request by user {}: score={}, level={}, flags={}",
                requester.getId(), totalScore, riskLevel, flags.size());

        return new RiskAssessment(totalScore, riskLevel, flags, verificationRequired);
    }

    private int getAiRiskScore(HelpRequest request, User requester, int recentCount) {
        String prompt = String.format("""
                You are a fraud detection AI for a help network platform in India.
                Analyze this help request and return a JSON object with:
                - "riskScore": integer 0-30 (0 = safe, 30 = very suspicious)
                - "reason": brief explanation

                Request details:
                Title: %s
                Description: %s
                Category: %s
                Urgency: %s

                User profile:
                Verified: %s
                Total requests created: %d
                Requests in last 24h: %d
                Points: %d
                Rating: %.1f

                Look for:
                - Fake emergencies (e.g., "dying right now" but description is vague).
                - Emotional manipulation (overuse of "pleeease", "god bless you").
                - Scam patterns (asking for money, direct transfers, or sharing contact info early).
                - Inconsistent details (e.g., location in text doesn't match provided address).
                - Unrealistic claims (e.g., "needs 50 units of blood").
                - Financial solicitation or investment scams.

                Indian Context: Look for mentions of specific payment apps (Paytm, PhonePe) or "urgent cash" needs which are often scams on help platforms.
                Be fair — most requests are genuine. Only flag truly suspicious ones.

                Respond ONLY with valid JSON.
                """,
                request.getTitle(), request.getDescription(),
                request.getCategory(), request.getUrgency(),
                requester.isVerified(), requester.getRequestsCreated(),
                recentCount, requester.getPoints(), requester.getRating());

        String response = geminiService.generateText(prompt);
        JsonNode json = geminiService.parseJsonResponse(response);

        if (json != null) {
            return json.path("riskScore").asInt(0);
        }
        return 0;
    }

    private String calculateRiskLevel(int score) {
        if (score >= 50) return "HIGH";
        if (score >= 25) return "MEDIUM";
        return "LOW";
    }

    private List<String> determineVerification(String riskLevel, String category) {
        List<String> requirements = new ArrayList<>();
        requirements.add("OTP_VERIFICATION"); // Always required

        if ("MEDIUM".equals(riskLevel)) {
            requirements.add("COMMUNITY_ENDORSEMENT");
        }

        if ("HIGH".equals(riskLevel)) {
            requirements.add("DOCUMENT_UPLOAD");
            requirements.add("ADMIN_REVIEW");
        }

        // Category-specific requirements
        if (category.contains("BLOOD") || category.contains("MEDICAL")) {
            if (!requirements.contains("DOCUMENT_UPLOAD")) {
                requirements.add("DOCUMENT_UPLOAD");
            }
        }

        return requirements;
    }

    private boolean similarText(String a, String b) {
        if (a == null || b == null) return false;
        String cleanA = a.toLowerCase().replaceAll("[^a-z0-9 ]", "").trim();
        String cleanB = b.toLowerCase().replaceAll("[^a-z0-9 ]", "").trim();
        if (cleanA.equals(cleanB)) return true;
        // Simple Jaccard similarity on words
        Set<String> wordsA = new HashSet<>(Arrays.asList(cleanA.split("\\s+")));
        Set<String> wordsB = new HashSet<>(Arrays.asList(cleanB.split("\\s+")));
        Set<String> intersection = new HashSet<>(wordsA);
        intersection.retainAll(wordsB);
        Set<String> union = new HashSet<>(wordsA);
        union.addAll(wordsB);
        return union.isEmpty() ? false : (double) intersection.size() / union.size() > 0.7;
    }

    /**
     * Risk assessment result.
     */
    public static class RiskAssessment {
        private int riskScore;
        private String riskLevel;
        private final List<String> flags;
        private final List<String> verificationRequired;

        public RiskAssessment(int riskScore, String riskLevel, List<String> flags,
                              List<String> verificationRequired) {
            this.riskScore = riskScore;
            this.riskLevel = riskLevel;
            this.flags = flags;
            this.verificationRequired = verificationRequired;
        }

        public int getRiskScore() { return riskScore; }
        public void setRiskScore(int riskScore) { this.riskScore = riskScore; }
        
        public String getRiskLevel() { return riskLevel; }
        public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }

        public List<String> getFlags() { return flags; }
        public List<String> getVerificationRequired() { return verificationRequired; }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("riskScore", riskScore);
            map.put("riskLevel", riskLevel);
            map.put("flags", flags);
            map.put("verificationRequired", verificationRequired);
            return map;
        }
    }
}
