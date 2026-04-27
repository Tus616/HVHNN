package com.hvhn.backend.service;

import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.HelpRequestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class VerificationPipelineService {

    private static final Logger logger = LoggerFactory.getLogger(VerificationPipelineService.class);

    private final RiskScoringService riskScoringService;
    private final OcrVerificationService ocrService;
    private final HelpRequestRepository helpRequestRepository;

    public VerificationPipelineService(RiskScoringService riskScoringService,
                                       OcrVerificationService ocrService,
                                       HelpRequestRepository helpRequestRepository) {
        this.riskScoringService = riskScoringService;
        this.ocrService = ocrService;
        this.helpRequestRepository = helpRequestRepository;
    }

    /**
     * Process a help request through the verification pipeline based on its risk.
     */
    public HelpRequest processVerification(HelpRequest request, User requester, String base64Image) {
        logger.info("Starting verification pipeline for request: {}", request.getId());

        // 1. Calculate Risk Score
        RiskScoringService.RiskAssessment assessment = riskScoringService.assessRisk(request, requester);
        request.setRiskScore(assessment.getRiskScore());
        request.setRiskLevel(assessment.getRiskLevel());

        // 2. Apply Flow Logic based on Risk Level
        switch (assessment.getRiskLevel()) {
            case "LOW":
                handleLowRiskFlow(request);
                break;
            case "MEDIUM":
                handleMediumRiskFlow(request);
                break;
            case "HIGH":
                handleHighRiskFlow(request, base64Image);
                break;
            default:
                request.setVerificationStatus("PENDING");
        }

        return helpRequestRepository.save(request);
    }

    private void handleLowRiskFlow(HelpRequest request) {
        // Low risk requests are automatically verified after OTP (which is assumed done at creation)
        request.setVerificationStatus("VERIFIED");
        addTimelineEntry(request, "VERIFIED", "System", "Automatically verified based on low risk score.");
    }

    private void handleMediumRiskFlow(HelpRequest request) {
        // Medium risk requires manual review
        request.setVerificationStatus("PENDING_REVIEW");
        addTimelineEntry(request, "PENDING_REVIEW", "System", "Request flagged for manual community/admin review.");
    }

    private void handleHighRiskFlow(HelpRequest request, String base64Image) {
        if (base64Image != null && !base64Image.isEmpty()) {
            // If image provided, run OCR
            OcrVerificationService.OcrResult ocrResult = ocrService.verifyMedicalDocument(
                    base64Image, "image/jpeg", request.getTitle(), request.getDescription());
            
            request.setOcrDetails(ocrResult.toMap());
            
            if (ocrResult.isValid()) {
                request.setOcrVerified(true);
                request.setVerificationStatus("PENDING_ADMIN_APPROVAL");
                addTimelineEntry(request, "OCR_SUCCESS", "System", "Medical document verified via AI. Awaiting final admin approval.");
            } else {
                request.setOcrVerified(false);
                request.setVerificationStatus("REJECTED");
                addTimelineEntry(request, "REJECTED", "System", "Medical document validation failed: " + ocrResult.getError());
            }
        } else {
            // No document provided for high risk
            request.setVerificationStatus("REJECTED");
            addTimelineEntry(request, "REJECTED", "System", "High risk request submitted without mandatory medical documentation.");
        }
    }

    private void addTimelineEntry(HelpRequest request, String event, String actorName, String comment) {
        com.hvhn.backend.model.TimelineEntry entry = new com.hvhn.backend.model.TimelineEntry();
        entry.setEvent(event);
        entry.setTimestamp(java.time.LocalDateTime.now());
        entry.setActorName(actorName);
        entry.setComment(comment);
        request.getTimeline().add(entry);
    }
}
