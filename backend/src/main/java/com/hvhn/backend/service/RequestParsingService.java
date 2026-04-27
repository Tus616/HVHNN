package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hvhn.backend.dto.ParsedRequestDTO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class RequestParsingService {

    private static final Logger logger = LoggerFactory.getLogger(RequestParsingService.class);
    private final GeminiService geminiService;

    public RequestParsingService(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    /**
     * Parses raw user input into a structured help request.
     * 
     * @param input Raw text from user (e.g., "I need some food for 5 people in Hauz Khas immediately")
     * @return ParsedRequestDTO containing category, urgency, location, etc.
     */
    public ParsedRequestDTO parseRequest(String input) {
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("Input text cannot be empty");
        }

        String prompt = String.format("""
            You are an expert request analyzer for a hyperlocal help network.
            Analyze the following text describing a help request and extract structured information.

            RULES:
            1. category: Choose one from [FOOD, MEDICAL, BLOOD_DONATION, TRANSPORT, CLOTHES, SHELTER, GENERAL, EMERGENCY]
            2. urgency: Choose one from [LOW, MEDIUM, HIGH, CRITICAL]
            3. location: Extract specific address or landmark.
            4. timeConstraint: Extract how soon help is needed (e.g., "ASAP", "next 2 hours", "today").
            5. summary: A professional 1-sentence summary of the request.

            Input Text: "%s"

            Respond ONLY with valid JSON in this format:
            {
              "category": "...",
              "urgency": "...",
              "location": "...",
              "timeConstraint": "...",
              "summary": "..."
            }
            """, input);

        logger.info("Sending parsing request to Gemini for input: {}", input);

        try {
            String response = geminiService.generateText(prompt);
            JsonNode json = geminiService.parseJsonResponse(response);

            if (json == null) {
                logger.error("Failed to get valid JSON from Gemini parsing response");
                return createFallback(input);
            }

            ParsedRequestDTO dto = new ParsedRequestDTO();
            dto.setCategory(json.path("category").asText("GENERAL").toUpperCase());
            dto.setUrgency(json.path("urgency").asText("MEDIUM").toUpperCase());
            dto.setLocation(json.path("location").asText("Unknown"));
            dto.setTimeConstraint(json.path("timeConstraint").asText("None specified"));
            dto.setSummary(json.path("summary").asText("Request from text input"));

            logger.info("Successfully parsed request: category={}, urgency={}", dto.getCategory(), dto.getUrgency());
            return dto;

        } catch (Exception e) {
            logger.error("Error during request parsing: {}", e.getMessage());
            return createFallback(input);
        }
    }

    private ParsedRequestDTO createFallback(String input) {
        ParsedRequestDTO fallback = new ParsedRequestDTO();
        fallback.setCategory("GENERAL");
        fallback.setUrgency("MEDIUM");
        fallback.setSummary("Parsed from: " + (input.length() > 50 ? input.substring(0, 47) + "..." : input));
        fallback.setLocation("Check description");
        fallback.setTimeConstraint("Unknown");
        return fallback;
    }
}
