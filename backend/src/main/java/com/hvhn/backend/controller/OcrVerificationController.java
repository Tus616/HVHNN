package com.hvhn.backend.controller;

import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.service.OcrVerificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/api/verification")
public class OcrVerificationController {

    private final OcrVerificationService ocrService;
    private final HelpRequestRepository helpRequestRepository;

    public OcrVerificationController(OcrVerificationService ocrService,
                                      HelpRequestRepository helpRequestRepository) {
        this.ocrService = ocrService;
        this.helpRequestRepository = helpRequestRepository;
    }

    /**
     * Upload a medical document for OCR verification.
     * Optionally link it to a help request for cross-validation.
     */
    @PostMapping("/ocr")
    public ResponseEntity<?> verifyDocument(@RequestBody Map<String, String> payload) {
        try {
            String base64Image = payload.get("documentBase64");
            String requestId = payload.get("requestId");

            if (base64Image == null || base64Image.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "No document provided."));
            }

            // The frontend sends raw base64 (without data uri prefix)
            // Default mime to image/jpeg if not specified
            String mimeType = "image/jpeg"; 

            String requestTitle = null;
            String requestDescription = null;

            if (requestId != null && !requestId.isBlank()) {
                HelpRequest request = helpRequestRepository.findById(requestId).orElse(null);
                if (request != null) {
                    requestTitle = request.getTitle();
                    requestDescription = request.getDescription();
                }
            }

            OcrVerificationService.OcrResult result = ocrService.verifyMedicalDocument(
                    base64Image, mimeType, requestTitle, requestDescription);

            // If linked to a request, update the request's OCR verification status
            if (requestId != null && !requestId.isBlank() && result.isProcessed()) {
                helpRequestRepository.findById(requestId).ifPresent(request -> {
                    request.setOcrVerified(result.isAuthentic() && result.getConfidenceScore() > 0.7);
                    helpRequestRepository.save(request);
                });
            }

            return ResponseEntity.ok(result.toMap());
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "OCR verification failed: " + e.getMessage()));
        }
    }
}
