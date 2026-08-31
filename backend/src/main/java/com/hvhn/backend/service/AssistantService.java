package com.hvhn.backend.service;

import com.hvhn.backend.model.User;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AssistantService {

    private final GeminiService geminiService;

    public AssistantService(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    public Map<String, Object> chat(User user, Map<String, Object> payload) {
        String message = safeText(payload == null ? null : payload.get("message"), 800);
        if (!StringUtils.hasText(message)) {
            return Map.of("reply", "Tell me what you need help with in Sahay, and I will guide you.", "provider", "fallback");
        }
        
        String route = safeText(payload == null ? null : payload.get("route"), 120);
        String pageName = safeText(payload == null ? null : payload.get("pageName"), 120);
        
        if (geminiService.isAvailable()) {
            List<Map<String, String>> history = new java.util.ArrayList<>();
            if (payload != null && payload.get("history") instanceof List<?> rawList) {
                for (Object item : rawList) {
                    if (item instanceof Map<?, ?> rawMap) {
                        String role = String.valueOf(rawMap.get("role"));
                        String text = String.valueOf(rawMap.get("message"));
                        if (StringUtils.hasText(text) && !"null".equals(text)) {
                            history.add(Map.of("role", role, "text", text));
                        }
                    }
                }
            }
            
            // If no history, just use the current message
            if (history.isEmpty()) {
                history.add(Map.of("role", "user", "text", message));
            }
            
            // Inject context into the first user message
            boolean contextInjected = false;
            for (int i = 0; i < history.size(); i++) {
                Map<String, String> msg = history.get(i);
                if ("user".equals(msg.get("role"))) {
                    String originalText = msg.get("text");
                    history.set(i, Map.of("role", "user", "text", promptContext(user, route, pageName) + "\n\nUser: " + originalText));
                    contextInjected = true;
                    break;
                }
            }
            
            // Fallback if no user message found in history
            if (!contextInjected) {
                history.add(0, Map.of("role", "user", "text", promptContext(user, route, pageName) + "\n\nUser: hello"));
            }

            String reply = geminiService.generateChat(history);
            if (StringUtils.hasText(reply)) {
                return Map.of("reply", trim(reply, 900), "provider", "gemini");
            }
        }
        return Map.of("reply", fallback(message, route, pageName), "provider", "fallback");
    }

    private String promptContext(User user, String route, String pageName) {
        String status = user == null ? "signed out" : "signed in"
                + ", volunteer=" + user.isVolunteer()
                + ", onboardingComplete=" + user.isOnboardingCompleted()
                + ", verified=" + user.isVerified();
        return """
                You are the Sahay Need Help assistant for Sahay - Help Where It Matters.
                Answer conversationally and practically. You can guide users, but you cannot create,
                delete, accept, or close anything yourself. Do not ask for secrets, tokens, passwords,
                FCM tokens, or exact private coordinates. Do not claim you performed an action unless you actually did.
                Context: route=%s, page=%s, userStatus=%s
                """.formatted(route, pageName, status);
    }

    private String fallback(String message, String route, String pageName) {
        String text = message.toLowerCase(Locale.ROOT);
        if (contains(text, "hello", "hi", "hey")) return "Hi. I can help you raise requests, volunteer, use communities, manage notifications, update your profile, and understand nearby matching.";
        if (contains(text, "how are you")) return "I am ready to help. What are you trying to do in Sahay right now?";
        if (contains(text, "what is sahay", "about sahay", "what is hvhn", "about hvhn")) return "Sahay is a hyperlocal help network for raising practical requests and connecting nearby verified helpers, volunteers, and communities.";
        if (contains(text, "raise request", "create request", "new request")) return "Go to Raise Request, add a clear title, details, urgency, and a safe location summary, then submit. Current location or saved profile location can improve nearby matching.";
        if (contains(text, "volunteer", "become volunteer")) return "Open Volunteer Settings, enable volunteer mode, choose categories you can help with, and keep your location current so nearby requests can match you.";
        if (contains(text, "communit")) return "Communities group members around a place or institution. You can join with the available policy or create one, then use requests, announcements, Q&A, and campaigns inside it.";
        if (contains(text, "not visible", "can't see", "cannot see")) return "A request may be hidden by status, radius, category filters, community scope, or missing location. Try clearing filters or widening the selected radius.";
        if (contains(text, "location", "nearby", "radius")) return "Sahay uses approximate saved or browser location for matching. It should show a radius circle on the map and only show requests inside the selected distance when a center is available.";
        if (contains(text, "profile", "photo", "avatar")) return "Open Profile, choose Edit profile, update your details or upload a photo, and save. The new photo should appear immediately across the app.";
        if (contains(text, "notification", "bell", "unread")) return "Notifications appear in the bell and notification center. You can mark items read or unread, delete them, or mark all current items read.";
        if (contains(text, "delete", "remove")) return "I can explain where delete buttons are, but I cannot delete anything for you. Use the page's Delete button and confirm only when you are sure.";
        String where = StringUtils.hasText(pageName) ? " on " + pageName : StringUtils.hasText(route) ? " on this page" : "";
        return "I can help with requests, volunteering, communities, location, profile, notifications, and messages" + where + ". What would you like to do?";
    }

    private boolean contains(String text, String... terms) {
        return List.of(terms).stream().anyMatch(text::contains);
    }

    private String safeText(Object value, int max) {
        if (value == null) return "";
        return trim(String.valueOf(value).replaceAll("[\\r\\t]+", " ").trim(), max);
    }

    private String trim(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max - 1);
    }
}
