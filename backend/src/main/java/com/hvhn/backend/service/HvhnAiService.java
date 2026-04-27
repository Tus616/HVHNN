package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class HvhnAiService {

    private static final Logger log = LoggerFactory.getLogger(HvhnAiService.class);
    private final GeminiService gemini;

    public HvhnAiService(GeminiService gemini) {
        this.gemini = gemini;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> process(Map<String, Object> input) {
        if (input == null || !input.containsKey("mode")) {
            return Map.of("error", "missing_fields", "fields", List.of("mode"));
        }
        String mode = String.valueOf(input.get("mode"));
        Map<String, Object> data = input.containsKey("data") ? (Map<String, Object>) input.get("data") : Map.of();

        return switch (mode) {
            case "parse_request" -> parseRequest(data);
            case "fake_detection" -> fakeDetection(data);
            case "match_volunteers" -> matchVolunteers(data);
            case "predict_demand" -> predictDemand(data);
            case "community_health" -> communityHealth(data);
            case "response_suggestion" -> responseSuggestion(data);
            default -> Map.of("error", "unknown_mode");
        };
    }

    // ==================== MODE: parse_request ====================
    private Map<String, Object> parseRequest(Map<String, Object> d) {
        List<String> missing = checkRequired(d, "raw_text", "user_id", "community_id", "timestamp");
        if (!missing.isEmpty()) return Map.of("error", "missing_fields", "fields", missing);

        String raw = str(d, "raw_text");
        String lang = detectLanguage(raw);
        String category = "general_help";
        String subcategory = "";
        String urgency = "medium";
        String urgencyReason = "Default assignment";
        String bloodGroup = null;
        String locationHint = "";
        String contactInfo = "";
        String quantityNeeded = "";
        String specialNotes = "";
        String summary = "Help request submitted.";
        List<String> missingInfo = new ArrayList<>();
        String followUp = "";
        double confidence = 0.6;
        List<String> tags = new ArrayList<>();

        if (gemini.isAvailable()) {
            try {
                String prompt = "You are HVHN-AI. Analyze this help request text (may be Hindi/English/Hinglish). "
                    + "Return ONLY valid JSON with these fields: "
                    + "language_detected (hi/en/hinglish/other), "
                    + "category (blood_donation/medical_emergency/food_support/shelter/transport/financial/general_help/other), "
                    + "subcategory (string), "
                    + "urgency (critical/high/medium/low), "
                    + "urgency_reason (string), "
                    + "blood_group (string or null), "
                    + "location_hint (string), "
                    + "contact_info (string), "
                    + "quantity_needed (string), "
                    + "special_notes (string), "
                    + "summary_en (1 sentence English summary), "
                    + "missing_info (array of field names user should provide), "
                    + "follow_up_question (string if info unclear), "
                    + "confidence_score (0.0-1.0), "
                    + "tags (array of strings). "
                    + "Text: \"" + raw + "\"";

                String resp = gemini.generateText(prompt);
                JsonNode j = gemini.parseJsonResponse(resp);
                if (j != null) {
                    lang = jStr(j, "language_detected", lang);
                    category = jStr(j, "category", category);
                    subcategory = jStr(j, "subcategory", subcategory);
                    urgency = jStr(j, "urgency", urgency);
                    urgencyReason = jStr(j, "urgency_reason", urgencyReason);
                    bloodGroup = jStrNull(j, "blood_group");
                    locationHint = jStr(j, "location_hint", locationHint);
                    contactInfo = jStr(j, "contact_info", contactInfo);
                    quantityNeeded = jStr(j, "quantity_needed", quantityNeeded);
                    specialNotes = jStr(j, "special_notes", specialNotes);
                    summary = jStr(j, "summary_en", summary);
                    followUp = jStr(j, "follow_up_question", followUp);
                    confidence = j.has("confidence_score") ? j.get("confidence_score").asDouble(confidence) : confidence;
                    if (j.has("missing_info") && j.get("missing_info").isArray()) {
                        for (JsonNode n : j.get("missing_info")) missingInfo.add(n.asText());
                    }
                    if (j.has("tags") && j.get("tags").isArray()) {
                        for (JsonNode n : j.get("tags")) tags.add(n.asText());
                    }
                }
            } catch (Exception e) {
                log.warn("Gemini parse failed, using fallback: {}", e.getMessage());
            }
        }

        // Keyword fallback for category
        if ("general_help".equals(category)) {
            String lower = raw.toLowerCase();
            if (containsAny(lower, "blood", "donor", "transfusion", "plasma")) category = "blood_donation";
            else if (containsAny(lower, "emergency", "ambulance", "icu", "dying")) category = "medical_emergency";
            else if (containsAny(lower, "food", "meal", "hungry", "ration")) category = "food_support";
            else if (containsAny(lower, "shelter", "homeless", "roof")) category = "shelter";
            else if (containsAny(lower, "transport", "ride", "vehicle", "cab")) category = "transport";
            else if (containsAny(lower, "money", "fund", "financial")) category = "financial";

            if (containsAny(lower, "dying", "critical", "sos", "emergency", "asap")) urgency = "critical";
            else if (containsAny(lower, "urgent", "quickly", "fast")) urgency = "high";
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", "parse_request");
        result.put("language_detected", lang);
        result.put("category", category);
        result.put("subcategory", subcategory);
        result.put("urgency", urgency);
        result.put("urgency_reason", urgencyReason);

        Map<String, Object> extracted = new LinkedHashMap<>();
        extracted.put("blood_group", bloodGroup);
        extracted.put("location_hint", locationHint);
        extracted.put("contact_info", contactInfo);
        extracted.put("quantity_needed", quantityNeeded);
        extracted.put("special_notes", specialNotes);
        result.put("extracted_info", extracted);

        result.put("summary_en", summary);
        result.put("missing_info", missingInfo);
        result.put("follow_up_question", followUp);
        result.put("confidence_score", confidence);
        result.put("tags", tags);
        return result;
    }

    // ==================== MODE: fake_detection ====================
    @SuppressWarnings("unchecked")
    private Map<String, Object> fakeDetection(Map<String, Object> d) {
        List<String> missing = checkRequired(d, "user_id", "request_text", "user_history");
        if (!missing.isEmpty()) return Map.of("error", "missing_fields", "fields", missing);

        String text = str(d, "request_text");
        Map<String, Object> history = (Map<String, Object>) d.getOrDefault("user_history", Map.of());
        int totalReq = intVal(history, "total_requests", 0);
        int flagged = intVal(history, "flagged_count", 0);
        double avgResp = dblVal(history, "avg_response_rate", 1.0);
        int accountAge = intVal(history, "account_age_days", 0);
        int similarRecent = intVal(d, "similar_recent_requests", 0);
        boolean verified = boolVal(d, "verified_status", false);

        List<String> signals = new ArrayList<>();
        double score = 0;

        // Rule-based signals
        if (accountAge < 3) { score += 20; signals.add("NEW_ACCOUNT"); }
        if (!verified) { score += 15; signals.add("UNVERIFIED_USER"); }
        if (flagged > 2) { score += 20; signals.add("PREVIOUSLY_FLAGGED"); }
        if (similarRecent > 2) { score += 25; signals.add("DUPLICATE_REQUESTS"); }
        if (avgResp < 0.3) { score += 15; signals.add("LOW_RESPONSE_RATE"); }

        String lower = text.toLowerCase();
        if (containsAny(lower, "send money", "upi", "paytm", "gpay", "bank account", "transfer")) {
            score += 20; signals.add("FINANCIAL_SOLICITATION");
        }
        if (containsAny(lower, "pleeease", "god bless", "i beg")) {
            score += 10; signals.add("EMOTIONAL_MANIPULATION");
        }

        score = Math.min(100, score);
        String riskLevel, action;
        boolean notify;
        if (score >= 70) { riskLevel = "block"; action = "block"; notify = true; }
        else if (score >= 50) { riskLevel = "likely_fake"; action = "manual_review"; notify = true; }
        else if (score >= 25) { riskLevel = "suspicious"; action = "throttle"; notify = false; }
        else { riskLevel = "safe"; action = "approve"; notify = false; }

        String reason = signals.isEmpty() ? "No suspicious signals detected." :
            "Detected: " + String.join(", ", signals);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", "fake_detection");
        result.put("risk_level", riskLevel);
        result.put("risk_score", score);
        result.put("signals_detected", signals);
        result.put("reason", reason);
        result.put("action", action);
        result.put("notify_admin", notify);
        return result;
    }

    // ==================== MODE: match_volunteers ====================
    @SuppressWarnings("unchecked")
    private Map<String, Object> matchVolunteers(Map<String, Object> d) {
        List<String> missing = checkRequired(d, "request", "volunteers");
        if (!missing.isEmpty()) return Map.of("error", "missing_fields", "fields", missing);

        Map<String, Object> req = (Map<String, Object>) d.get("request");
        List<Map<String, Object>> vols = (List<Map<String, Object>>) d.get("volunteers");
        String reqCategory = str(req, "category");
        String reqUrgency = str(req, "urgency");
        String reqBlood = strOrNull(req, "blood_group");

        List<Map<String, Object>> ranked = new ArrayList<>();
        for (Map<String, Object> v : vols) {
            if (!boolVal(v, "is_available", false)) continue;

            int skill = 0;
            List<Object> skills = (List<Object>) v.getOrDefault("skills", List.of());
            for (Object s : skills) {
                if (String.valueOf(s).toLowerCase().contains(reqCategory.toLowerCase().replace("_", " "))) {
                    skill = 30; break;
                }
            }

            double distKm = dblVal(v, "distance_km", 99);
            int distance = distKm > 10 ? 0 : (int) (25.0 * (1.0 - distKm / 10.0));

            int lastActive = intVal(v, "last_active_mins_ago", 999);
            int availability = lastActive <= 10 ? 20 : lastActive <= 30 ? 10 : lastActive <= 60 ? 5 : 0;

            double successRate = dblVal(v, "success_rate", 0);
            int reliability = (int) (successRate * 15);

            int blood = 0;
            if ("blood_donation".equalsIgnoreCase(reqCategory) && reqBlood != null) {
                String vBlood = strOrNull(v, "blood_group");
                if (reqBlood.equalsIgnoreCase(vBlood)) blood = 10;
                else if (isCompatible(reqBlood, vBlood)) blood = 5;
            }

            int total = skill + distance + availability + reliability + blood;
            String name = str(v, "name");

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("volunteer_id", str(v, "volunteer_id"));
            entry.put("name", name);
            entry.put("total_score", total);
            Map<String, Object> breakdown = new LinkedHashMap<>();
            breakdown.put("skill", skill);
            breakdown.put("distance", distance);
            breakdown.put("availability", availability);
            breakdown.put("reliability", reliability);
            breakdown.put("blood", blood);
            entry.put("score_breakdown", breakdown);
            entry.put("notify_message", "");
            entry.put("recommended", total >= 40);
            ranked.add(entry);
        }

        ranked.sort((a, b) -> Integer.compare((int) b.get("total_score"), (int) a.get("total_score")));

        // Generate notify messages for top 3
        String[] msgs = {
            "🚨 Hi %s, a %s %s request nearby needs your help!",
            "🆘 Hey %s, someone near you needs %s support — can you help?",
            "🤝 %s, your skills are needed for a %s request close by!"
        };
        for (int i = 0; i < Math.min(3, ranked.size()); i++) {
            String n = (String) ranked.get(i).get("name");
            ranked.get(i).put("notify_message",
                String.format(msgs[i % 3], n, reqUrgency, reqCategory.replace("_", " ")));
        }

        boolean noGoodMatch = ranked.isEmpty() || (int) ranked.get(0).get("total_score") < 40;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", "match_volunteers");
        result.put("ranked_volunteers", ranked);
        result.put("no_good_match", noGoodMatch);
        result.put("escalate_to_nearby_community", noGoodMatch);
        return result;
    }

    // ==================== MODE: predict_demand ====================
    @SuppressWarnings("unchecked")
    private Map<String, Object> predictDemand(Map<String, Object> d) {
        List<String> missing = checkRequired(d, "community_id", "historical_data", "current_month", "current_active_volunteers");
        if (!missing.isEmpty()) return Map.of("error", "missing_fields", "fields", missing);

        List<Map<String, Object>> history = (List<Map<String, Object>>) d.get("historical_data");
        int activeVols = intVal(d, "current_active_volunteers", 0);

        // Aggregate by category
        Map<String, Integer> categoryTotals = new HashMap<>();
        for (Map<String, Object> h : history) {
            String cat = str(h, "category");
            categoryTotals.merge(cat, intVal(h, "count", 0), Integer::sum);
        }

        int totalDays = Math.max(1, history.size());
        String topRisk = categoryTotals.entrySet().stream()
            .max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse("general_help");

        List<Map<String, Object>> predictions = new ArrayList<>();
        for (int i = 1; i <= 7; i++) {
            for (Map.Entry<String, Integer> e : categoryTotals.entrySet()) {
                int avg = e.getValue() / totalDays;
                int predicted = Math.max(1, avg + (int)(Math.random() * 3 - 1));
                Map<String, Object> p = new LinkedHashMap<>();
                p.put("date", "day_+" + i);
                p.put("category", e.getKey());
                p.put("predicted_requests", predicted);
                p.put("confidence", 0.6 + Math.random() * 0.3);
                predictions.add(p);
            }
        }

        int totalPredicted = predictions.stream().mapToInt(p -> (int) p.get("predicted_requests")).sum() / 7;
        boolean sufficient = activeVols >= totalPredicted;
        List<String> shortages = new ArrayList<>();
        if (!sufficient) {
            shortages.add(topRisk);
        }

        List<String> suggestions = new ArrayList<>();
        if (!sufficient) suggestions.add("Recruit " + (totalPredicted - activeVols) + " more volunteers");
        suggestions.add("Pre-stock resources for " + topRisk.replace("_", " ") + " requests");
        suggestions.add("Send community alert about predicted demand");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", "predict_demand");
        result.put("top_risk_category", topRisk);
        result.put("predictions", predictions);
        Map<String, Object> gap = new LinkedHashMap<>();
        gap.put("sufficient", sufficient);
        gap.put("shortage_categories", shortages);
        result.put("volunteer_gap", gap);
        result.put("admin_suggestions", suggestions);
        result.put("alert_message", sufficient ? "Volunteer coverage is adequate for predicted demand." :
            "Warning: Volunteer shortage expected for " + topRisk.replace("_", " ") + " requests.");
        return result;
    }

    // ==================== MODE: community_health ====================
    @SuppressWarnings("unchecked")
    private Map<String, Object> communityHealth(Map<String, Object> d) {
        List<String> missing = checkRequired(d, "community_id", "stats");
        if (!missing.isEmpty()) return Map.of("error", "missing_fields", "fields", missing);

        Map<String, Object> s = (Map<String, Object>) d.get("stats");
        int totalReq = intVal(s, "total_requests_30d", 0);
        int resolved = intVal(s, "resolved_requests", 0);
        double avgTime = dblVal(s, "avg_resolution_time_hrs", 99);
        int activeVol = intVal(s, "active_volunteers", 0);
        int totalVol = intVal(s, "total_volunteers", 1);
        int fakeFlags = intVal(s, "fake_requests_flagged", 0);
        int members = intVal(s, "member_count", 1);

        // Resolution (30pts)
        double resRate = totalReq > 0 ? (double) resolved / totalReq : 0;
        int resScore = (int) (resRate * 30);

        // Speed (25pts)
        int speedScore = avgTime < 1 ? 25 : avgTime < 6 ? 15 : avgTime < 24 ? 5 : 0;

        // Engagement (25pts)
        double engRate = totalVol > 0 ? (double) activeVol / totalVol : 0;
        int engScore = (int) (engRate * 25);

        // Trust (20pts)
        double fakeRate = totalReq > 0 ? (double) fakeFlags / totalReq : 0;
        int trustScore = (int) ((1.0 - fakeRate) * 20);

        int health = resScore + speedScore + engScore + trustScore;
        String grade = health >= 90 ? "A" : health >= 75 ? "B" : health >= 60 ? "C" : "D";

        List<String> strengths = new ArrayList<>();
        List<String> improvements = new ArrayList<>();

        if (resRate > 0.8) strengths.add("High resolution rate (" + (int)(resRate*100) + "%)");
        else improvements.add("Improve resolution rate (currently " + (int)(resRate*100) + "%)");

        if (speedScore >= 15) strengths.add("Fast response times (avg " + String.format("%.1f", avgTime) + "h)");
        else improvements.add("Reduce average response time (currently " + String.format("%.1f", avgTime) + "h)");

        if (engRate > 0.6) strengths.add("Strong volunteer engagement (" + (int)(engRate*100) + "%)");
        else improvements.add("Increase volunteer engagement (" + (int)(engRate*100) + "% active)");

        if (fakeRate < 0.05) strengths.add("Low fake request rate");
        else improvements.add("Address fake requests (" + fakeFlags + " flagged)");

        if (strengths.size() > 3) strengths = strengths.subList(0, 3);
        if (improvements.size() > 3) improvements = improvements.subList(0, 3);

        String adminSummary = "Community health: Grade " + grade + " (" + health + "/100). " +
            (improvements.isEmpty() ? "All metrics are strong." : "Focus on: " + improvements.get(0) + ".");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", "community_health");
        result.put("health_score", health);
        result.put("grade", grade);
        Map<String, Object> bd = new LinkedHashMap<>();
        bd.put("resolution", resScore);
        bd.put("speed", speedScore);
        bd.put("engagement", engScore);
        bd.put("trust", trustScore);
        result.put("score_breakdown", bd);
        result.put("strengths", strengths);
        result.put("improvements", improvements);
        result.put("admin_summary", adminSummary);
        return result;
    }

    // ==================== MODE: response_suggestion ====================
    @SuppressWarnings("unchecked")
    private Map<String, Object> responseSuggestion(Map<String, Object> d) {
        List<String> missing = checkRequired(d, "request", "volunteer");
        if (!missing.isEmpty()) return Map.of("error", "missing_fields", "fields", missing);

        Map<String, Object> req = (Map<String, Object>) d.get("request");
        Map<String, Object> vol = (Map<String, Object>) d.get("volunteer");

        String volName = str(vol, "name");
        String category = str(req, "category");
        String urgency = str(req, "urgency");
        String summary = str(req, "summary_en");
        double distKm = dblVal(vol, "distance_km", 5);

        String eta = distKm < 2 ? "~10 minutes" : distKm < 5 ? "~20 minutes" : "~35 minutes";

        String message = "Hi, I'm " + volName + ". I can help with your " +
            category.replace("_", " ") + " request. I'm about " +
            String.format("%.1f", distKm) + " km away. ETA: " + eta + ". Stay safe!";

        List<String> steps = List.of(
            "Confirm the exact location with the requester",
            "Gather necessary supplies for " + category.replace("_", " "),
            "Update your status to 'On the way' when departing"
        );

        List<String> tips = new ArrayList<>();
        tips.add("Share your live location with the requester");
        tips.add("Carry a valid ID for verification");
        if (containsAny(category.toLowerCase(), "blood", "medical")) {
            tips.add("Verify medical documents before proceeding");
            tips.add("Do not administer medication without authorization");
        }
        if (containsAny(category.toLowerCase(), "emergency")) {
            tips.add("Contact emergency services (112) if situation escalates");
        }
        tips.add("Report any suspicious activity to community admins");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("mode", "response_suggestion");
        result.put("volunteer_message", message);
        result.put("action_steps", steps);
        result.put("estimated_time_to_reach", eta);
        result.put("safety_tips", tips);
        return result;
    }

    // ==================== HELPERS ====================
    private String detectLanguage(String text) {
        if (text == null || text.isBlank()) return "en";
        boolean hasHindi = text.codePoints().anyMatch(c -> c >= 0x0900 && c <= 0x097F);
        boolean hasLatin = text.codePoints().anyMatch(c -> (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'));
        if (hasHindi && hasLatin) return "hinglish";
        if (hasHindi) return "hi";
        return "en";
    }

    private boolean containsAny(String text, String... keywords) {
        for (String k : keywords) if (text.contains(k)) return true;
        return false;
    }

    private boolean isCompatible(String required, String donor) {
        if (required == null || donor == null) return false;
        if (required.equalsIgnoreCase(donor)) return true;
        if ("AB+".equalsIgnoreCase(required)) return true;
        if ("O-".equalsIgnoreCase(donor)) return true;
        return false;
    }

    private List<String> checkRequired(Map<String, Object> d, String... keys) {
        List<String> m = new ArrayList<>();
        for (String k : keys) if (!d.containsKey(k) || d.get(k) == null) m.add(k);
        return m;
    }

    private String str(Map<String, Object> m, String k) {
        return m.containsKey(k) && m.get(k) != null ? String.valueOf(m.get(k)) : "";
    }

    private String strOrNull(Map<String, Object> m, String k) {
        return m.containsKey(k) && m.get(k) != null ? String.valueOf(m.get(k)) : null;
    }

    private int intVal(Map<String, Object> m, String k, int def) {
        try { return m.containsKey(k) ? ((Number) m.get(k)).intValue() : def; }
        catch (Exception e) { return def; }
    }

    private double dblVal(Map<String, Object> m, String k, double def) {
        try { return m.containsKey(k) ? ((Number) m.get(k)).doubleValue() : def; }
        catch (Exception e) { return def; }
    }

    private boolean boolVal(Map<String, Object> m, String k, boolean def) {
        try { return m.containsKey(k) ? Boolean.parseBoolean(String.valueOf(m.get(k))) : def; }
        catch (Exception e) { return def; }
    }

    private String jStr(JsonNode j, String f, String def) {
        return j.has(f) && !j.get(f).isNull() ? j.get(f).asText(def) : def;
    }

    private String jStrNull(JsonNode j, String f) {
        return j.has(f) && !j.get(f).isNull() && !"null".equalsIgnoreCase(j.get(f).asText()) ? j.get(f).asText() : null;
    }
}
