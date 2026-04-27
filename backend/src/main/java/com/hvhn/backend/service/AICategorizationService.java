package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.HashMap;

/**
 * AI-powered categorization service for help requests.
 * Uses Google Gemini LLM for intelligent categorization when available,
 * with automatic fallback to keyword-based analysis.
 */
@Service
public class AICategorizationService {

    private static final Logger logger = LoggerFactory.getLogger(AICategorizationService.class);

    private final GeminiService geminiService;

    private static final Map<String, String[]> CATEGORY_KEYWORDS = new HashMap<>();
    private static final Map<String, String[]> URGENCY_KEYWORDS = new HashMap<>();
    private static final Map<String, String[]> SKILL_KEYWORDS = new HashMap<>();

    static {
        CATEGORY_KEYWORDS.put("BLOOD_DONATION", new String[]{
            "blood", "donor", "donation", "transfusion", "plasma", "platelet",
            "blood group", "blood type", "blood bank", "blood needed", "urgent blood"
        });
        CATEGORY_KEYWORDS.put("MEDICAL", new String[]{
            "medical", "doctor", "hospital", "medicine", "health", "emergency",
            "ambulance", "injury", "sick", "fever", "pain", "surgery", "treatment",
            "clinic", "nurse", "oxygen", "ventilator", "icu"
        });
        CATEGORY_KEYWORDS.put("FOOD", new String[]{
            "food", "meal", "hungry", "nutrition", "water", "drinking",
            "groceries", "ration", "cooking", "tiffin", "lunch", "dinner"
        });
        CATEGORY_KEYWORDS.put("TRANSPORT", new String[]{
            "transport", "ride", "vehicle", "car", "ambulance", "travel",
            "pickup", "drop", "cab", "auto", "commute"
        });
        CATEGORY_KEYWORDS.put("EMERGENCY", new String[]{
            "emergency", "fire", "flood", "earthquake", "disaster", "accident",
            "rescue", "sos", "danger", "critical", "life-threatening", "urgent help"
        });

        URGENCY_KEYWORDS.put("CRITICAL", new String[]{
            "dying", "critical", "life-threatening", "immediate", "sos", "emergency",
            "very urgent", "asap", "right now", "cannot wait", "fatal"
        });
        URGENCY_KEYWORDS.put("HIGH", new String[]{
            "urgent", "quickly", "soon", "important", "serious", "severe",
            "rush", "fast", "hurry", "time-sensitive"
        });
        URGENCY_KEYWORDS.put("MEDIUM", new String[]{
            "needed", "required", "help", "assist", "support", "looking for"
        });

        SKILL_KEYWORDS.put("DOCTOR", new String[]{"doctor", "physician", "surgeon", "pediatrician"});
        SKILL_KEYWORDS.put("NURSE", new String[]{"nurse", "dressing", "injection", "medical assistant"});
        SKILL_KEYWORDS.put("DRIVER", new String[]{"driver", "driving", "chauffeur", "pickup", "drop"});
        SKILL_KEYWORDS.put("PHARMACIST", new String[]{"pharmacist", "chemist", "medicine supply"});
        SKILL_KEYWORDS.put("COOK", new String[]{"cook", "cooking", "chef", "meal prep"});
        SKILL_KEYWORDS.put("COUNSELOR", new String[]{"counselor", "psychologist", "mental health", "therapy"});
        SKILL_KEYWORDS.put("FIRST_AID", new String[]{"first aid", "bandage", "cpr", "basic life support"});
    }

    public AICategorizationService(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    public AIResult categorize(String title, String description) {
        // Try Gemini LLM first
        if (geminiService.isAvailable()) {
            try {
                AIResult geminiResult = categorizeWithGemini(title, description);
                if (geminiResult != null) {
                    logger.info("Gemini AI categorized request as: category={}, urgency={}",
                            geminiResult.getCategory(), geminiResult.getUrgency());
                    return geminiResult;
                }
            } catch (Exception e) {
                logger.warn("Gemini categorization failed, falling back to keywords: {}", e.getMessage());
            }
        }

        // Fallback to keyword-based categorization
        return categorizeWithKeywords(title, description);
    }

    private AIResult categorizeWithGemini(String title, String description) {
        String prompt = String.format("""
                You are an AI assistant for a hyperlocal help network in India.
                Analyze the following help request and return a JSON object with these fields:

                - "category": one of BLOOD_DONATION, MEDICAL, FOOD, TRANSPORT, EMERGENCY, CLOTHES, SHELTER, GENERAL
                - "urgency": one of CRITICAL, HIGH, MEDIUM, LOW
                - "summary": a concise 1-2 sentence summary of the request
                - "bloodGroup": the blood group needed (e.g., "B+", "O-") or null if not applicable
                - "requiredSkill": one of DOCTOR, NURSE, DRIVER, PHARMACIST, COOK, COUNSELOR, FIRST_AID, or null
                - "location": extracted location/address from text, or null
                - "timeConstraint": extracted time urgency (e.g., "within 1 hour", "today") or null

                Title: %s
                Description: %s

                Respond ONLY with valid JSON, no explanation.
                """, title != null ? title : "", description != null ? description : "");

        String response = geminiService.generateText(prompt);
        JsonNode json = geminiService.parseJsonResponse(response);

        if (json == null) {
            return null;
        }

        String category = getJsonText(json, "category", "GENERAL");
        String urgency = getJsonText(json, "urgency", "MEDIUM");
        String summary = getJsonText(json, "summary", "AI-categorized request.");
        String bloodGroup = getJsonText(json, "bloodGroup", null);
        String requiredSkill = getJsonText(json, "requiredSkill", null);

        return new AIResult(category, urgency, "🤖 " + summary, bloodGroup, requiredSkill);
    }

    private AIResult categorizeWithKeywords(String title, String description) {
        String text = ((title != null ? title : "") + " " + (description != null ? description : "")).toLowerCase();

        String category = detectCategory(text);
        String urgency = detectUrgency(text);
        String bloodGroup = null;
        String requiredSkill = detectSkill(text);

        if ("BLOOD_DONATION".equals(category)) {
            bloodGroup = extractBloodGroup(text);
        }

        String summary = generateSummary(title, description, category, urgency);

        return new AIResult(category, urgency, summary, bloodGroup, requiredSkill);
    }

    private String getJsonText(JsonNode json, String field, String defaultValue) {
        JsonNode node = json.get(field);
        if (node == null || node.isNull() || node.asText().equalsIgnoreCase("null")) {
            return defaultValue;
        }
        return node.asText();
    }

    private String extractBloodGroup(String text) {
        String upperText = text.toUpperCase();
        String[] groups = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"};
        for (String group : groups) {
            if (upperText.contains(group) || upperText.contains(group.replace("+", " POSITIVE").replace("-", " NEGATIVE"))) {
                return group;
            }
        }
        return null;
    }

    private String detectCategory(String text) {
        int maxScore = 0;
        String bestCategory = "GENERAL";

        for (Map.Entry<String, String[]> entry : CATEGORY_KEYWORDS.entrySet()) {
            int score = 0;
            for (String keyword : entry.getValue()) {
                if (text.contains(keyword)) {
                    score++;
                }
            }
            if (score > maxScore) {
                maxScore = score;
                bestCategory = entry.getKey();
            }
        }

        return bestCategory;
    }

    private String detectUrgency(String text) {
        for (String keyword : URGENCY_KEYWORDS.get("CRITICAL")) {
            if (text.contains(keyword)) return "CRITICAL";
        }
        for (String keyword : URGENCY_KEYWORDS.get("HIGH")) {
            if (text.contains(keyword)) return "HIGH";
        }
        for (String keyword : URGENCY_KEYWORDS.get("MEDIUM")) {
            if (text.contains(keyword)) return "MEDIUM";
        }
        return "LOW";
    }

    private String detectSkill(String text) {
        for (Map.Entry<String, String[]> entry : SKILL_KEYWORDS.entrySet()) {
            for (String keyword : entry.getValue()) {
                if (text.contains(keyword)) {
                    return entry.getKey();
                }
            }
        }
        return null;
    }

    private String generateSummary(String title, String description, String category, String urgency) {
        StringBuilder sb = new StringBuilder();
        sb.append("AI Analysis: ");
        sb.append(urgency).append(" urgency ");
        sb.append(category.toLowerCase().replace("_", " ")).append(" request. ");

        if (description != null && description.length() > 100) {
            sb.append(description.substring(0, 100)).append("...");
        } else if (description != null) {
            sb.append(description);
        }

        return sb.toString();
    }

    public static class AIResult {
        private final String category;
        private final String urgency;
        private final String summary;
        private final String bloodGroup;
        private final String requiredSkill;

        public AIResult(String category, String urgency, String summary, String bloodGroup, String requiredSkill) {
            this.category = category;
            this.urgency = urgency;
            this.summary = summary;
            this.bloodGroup = bloodGroup;
            this.requiredSkill = requiredSkill;
        }

        public String getCategory() { return category; }
        public String getUrgency() { return urgency; }
        public String getSummary() { return summary; }
        public String getBloodGroup() { return bloodGroup; }
        public String getRequiredSkill() { return requiredSkill; }
    }
}
