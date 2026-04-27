package com.hvhn.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * OCR verification service for medical documents using Gemini Vision.
 * Extracts and validates details from doctor's letters, prescriptions, and hospital documents.
 */
@Service
public class OcrVerificationService {

    private static final Logger logger = LoggerFactory.getLogger(OcrVerificationService.class);

    private final GeminiService geminiService;

    public OcrVerificationService(GeminiService geminiService) {
        this.geminiService = geminiService;
    }

    /**
     * Analyze a medical document image and extract structured information.
     *
     * @param base64Image Base64-encoded image data
     * @param mimeType    Image MIME type (e.g., "image/jpeg", "image/png")
     * @param requestTitle The title of the associated help request for cross-validation
     * @param requestDescription The description of the associated help request
     * @return Verification result with extracted data and confidence score
     */
    public OcrResult verifyMedicalDocument(String base64Image, String mimeType,
                                            String requestTitle, String requestDescription) {
        if (!geminiService.isAvailable()) {
            logger.warn("Gemini is not available for OCR verification.");
            return OcrResult.unavailable();
        }

        try {
            String prompt = String.format("""
                    You are a medical document verification AI for a help network.
                    Analyze this medical document image and extract the following information.
                    Also verify if this document appears authentic.

                    Return a JSON object with:
                    - "patientName": extracted patient name or null
                    - "hospitalName": extracted hospital/clinic name or null
                    - "doctorName": extracted doctor name or null
                    - "diagnosis": extracted diagnosis or medical condition or null
                    - "date": extracted date from the document in YYYY-MM-DD format or null
                    - "documentType": one of PRESCRIPTION, DISCHARGE_SUMMARY, REFERRAL_LETTER, LAB_REPORT, MEDICAL_CERTIFICATE, UNKNOWN
                    - "isAuthentic": true if the document appears to be a genuine medical document, false if it looks fake/generated
                    - "confidenceScore": a number from 0.0 to 1.0 indicating your confidence in the extraction
                    - "warnings": array of strings listing any red flags (e.g., "no hospital letterhead", "handwriting inconsistent")
                    - "extractedText": key text content extracted from the document

                    The associated help request has:
                    Title: %s
                    Description: %s

                    Also check if the document details are consistent with the help request.
                    Add "requestMatch": true/false and "matchReason": explaining why.

                    Respond ONLY with valid JSON.
                    """, requestTitle != null ? requestTitle : "N/A",
                    requestDescription != null ? requestDescription : "N/A");

            String response = geminiService.analyzeImage(base64Image, mimeType, prompt);
            JsonNode json = geminiService.parseJsonResponse(response);

            if (json == null) {
                return OcrResult.failed("Failed to parse AI response");
            }

            return new OcrResult(
                    true,
                    getJsonText(json, "patientName", null),
                    getJsonText(json, "hospitalName", null),
                    getJsonText(json, "doctorName", null),
                    getJsonText(json, "diagnosis", null),
                    getJsonText(json, "date", null),
                    getJsonText(json, "documentType", "UNKNOWN"),
                    json.path("isAuthentic").asBoolean(false),
                    json.path("confidenceScore").asDouble(0.0),
                    extractWarnings(json),
                    getJsonText(json, "extractedText", null),
                    json.path("requestMatch").asBoolean(false),
                    getJsonText(json, "matchReason", null)
            );

        } catch (Exception e) {
            logger.error("OCR verification failed: {}", e.getMessage(), e);
            return OcrResult.failed("OCR analysis error: " + e.getMessage());
        }
    }

    private List<String> extractWarnings(JsonNode json) {
        List<String> warnings = new ArrayList<>();
        JsonNode warningsNode = json.get("warnings");
        if (warningsNode != null && warningsNode.isArray()) {
            for (JsonNode w : warningsNode) {
                warnings.add(w.asText());
            }
        }
        return warnings;
    }

    private String getJsonText(JsonNode json, String field, String defaultValue) {
        JsonNode node = json.get(field);
        if (node == null || node.isNull() || node.asText().equalsIgnoreCase("null")) {
            return defaultValue;
        }
        return node.asText();
    }

    /**
     * Result of OCR document verification.
     */
    public static class OcrResult {
        private final boolean processed;
        private final String patientName;
        private final String hospitalName;
        private final String doctorName;
        private final String diagnosis;
        private final String date;
        private final String documentType;
        private final boolean authentic;
        private final double confidenceScore;
        private final List<String> warnings;
        private final String extractedText;
        private final boolean requestMatch;
        private final String matchReason;
        private String error;

        public OcrResult(boolean processed, String patientName, String hospitalName,
                         String doctorName, String diagnosis, String date,
                         String documentType, boolean authentic, double confidenceScore,
                         List<String> warnings, String extractedText,
                         boolean requestMatch, String matchReason) {
            this.processed = processed;
            this.patientName = patientName;
            this.hospitalName = hospitalName;
            this.doctorName = doctorName;
            this.diagnosis = diagnosis;
            this.date = date;
            this.documentType = documentType;
            this.authentic = authentic;
            this.confidenceScore = confidenceScore;
            this.warnings = warnings != null ? warnings : List.of();
            this.extractedText = extractedText;
            this.requestMatch = requestMatch;
            this.matchReason = matchReason;
        }

        public static OcrResult unavailable() {
            OcrResult r = new OcrResult(false, null, null, null, null, null,
                    null, false, 0, List.of(), null, false, null);
            r.error = "AI OCR service is not available";
            return r;
        }

        public static OcrResult failed(String error) {
            OcrResult r = new OcrResult(false, null, null, null, null, null,
                    null, false, 0, List.of(), null, false, null);
            r.error = error;
            return r;
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("processed", processed);
            if (error != null) {
                map.put("error", error);
                return map;
            }
            map.put("patientName", patientName);
            map.put("hospitalName", hospitalName);
            map.put("doctorName", doctorName);
            map.put("diagnosis", diagnosis);
            map.put("date", date);
            map.put("documentType", documentType);
            map.put("isAuthentic", authentic);
            map.put("confidenceScore", confidenceScore);
            map.put("warnings", warnings);
            map.put("extractedText", extractedText);
            map.put("requestMatch", requestMatch);
            map.put("matchReason", matchReason);
            return map;
        }

        // Getters
        /**
         * Perform business validation on the OCR result.
         * Requirements: 
         * 1. Patient name, hospital name, diagnosis, and date must be present.
         * 2. Document must be authentic with > 0.8 confidence.
         * 3. Date must not be older than 6 months.
         */
        public boolean isValid() {
            if (!processed || !authentic || confidenceScore < 0.8) return false;
            if (patientName == null || hospitalName == null || diagnosis == null || date == null) return false;

            try {
                java.time.LocalDate docDate = java.time.LocalDate.parse(date);
                java.time.LocalDate sixMonthsAgo = java.time.LocalDate.now().minusMonths(6);
                if (docDate.isBefore(sixMonthsAgo)) {
                    return false;
                }
            } catch (Exception e) {
                // If date parsing fails, we treat it as invalid for safety
                return false;
            }

            return true;
        }

        public String getPatientName() { return patientName; }
        public String getHospitalName() { return hospitalName; }
        public String getDiagnosis() { return diagnosis; }
        public String getDate() { return date; }
        public boolean isProcessed() { return processed; }
        public boolean isAuthentic() { return authentic; }
        public double getConfidenceScore() { return confidenceScore; }
        public List<String> getWarnings() { return warnings; }
        public boolean isRequestMatch() { return requestMatch; }
        public String getError() { return error; }
    }
}
