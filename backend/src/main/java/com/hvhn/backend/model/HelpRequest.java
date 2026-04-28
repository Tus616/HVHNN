package com.hvhn.backend.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;


@Document(collection = "help_requests")
public class HelpRequest {
    @Id
    private String id;

    private String title;
    private String description;
    @Indexed
    private String category; // BLOOD_DONATION, MEDICAL, FOOD, TRANSPORT, GENERAL, EMERGENCY
    private String urgency; // LOW, MEDIUM, HIGH, CRITICAL
    @Indexed
    private String status; // OPEN, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED, EXPIRED
    private Double latitude;
    private Double longitude;
    private String address;
    private String contactPhone;
    private List<Double> embedding;
    private String requiredBloodGroup;
    private String requiredSkill;
    private List<TimelineEntry> timeline = new ArrayList<>();
    private Long totalResponseTimeMinutes;

    // AI-generated fields
    private String aiCategory;
    private String aiUrgency;
    private String aiSummary;

    // Risk scoring & fake detection
    private int riskScore = 0;
    private String riskLevel = "LOW"; // LOW, MEDIUM, HIGH
    private String verificationStatus = "PENDING"; // PENDING, VERIFIED, FLAGGED, REJECTED
    private boolean ocrVerified = false;
    private boolean adminReviewRequired = false;
    private java.util.List<String> riskFlags = new java.util.ArrayList<>();
    
    // Detailed AI logging
    private Map<String, Object> aiParseResult;
    private Map<String, Object> aiFakeDetectionResult;
    private Map<String, Object> aiMatchingResult;
    private boolean flagged = false;
    private String flagReason;

    // Dynamic radius & time constraint
    private Integer helpNeededWithinMinutes;
    private Double dynamicRadiusKm;
    private Double relayRadiusKm;

    @Indexed
    private String requesterId;

    private String requesterName;

    @Indexed
    private String volunteerId;

    private String volunteerName;

    @Indexed
    private String communityId;

    private String communityName;

    private int currentTier = 1; // 1=immediate, 2=nearby communities, 3=city-wide
    private int viewCount = 0;
    private int responseCount = 0;
    private int shareCount = 0;

    @CreatedDate
    private LocalDateTime createdAt;

    private LocalDateTime acceptedAt;
    private LocalDateTime completedAt;
    private LocalDateTime expiresAt;
    private String volunteerProgressStatus;
    private LocalDateTime volunteerStatusUpdatedAt;
    private boolean requesterRatingPending = false;
    private boolean requesterRated = false;
    private Integer volunteerRating;
    private String volunteerFeedback;

    public HelpRequest() {}

    // Risk scoring getters/setters
    public int getRiskScore() { return riskScore; }
    public void setRiskScore(int riskScore) { this.riskScore = riskScore; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }

    public String getVerificationStatus() { return verificationStatus; }
    public void setVerificationStatus(String verificationStatus) { this.verificationStatus = verificationStatus; }

    public boolean isOcrVerified() { return ocrVerified; }
    public void setOcrVerified(boolean ocrVerified) { this.ocrVerified = ocrVerified; }

    public boolean isAdminReviewRequired() { return adminReviewRequired; }
    public void setAdminReviewRequired(boolean adminReviewRequired) { this.adminReviewRequired = adminReviewRequired; }

    public java.util.List<String> getRiskFlags() { return riskFlags; }
    public void setRiskFlags(java.util.List<String> riskFlags) { this.riskFlags = riskFlags; }

    // Dynamic radius getters/setters
    public Integer getHelpNeededWithinMinutes() { return helpNeededWithinMinutes; }
    public void setHelpNeededWithinMinutes(Integer helpNeededWithinMinutes) { this.helpNeededWithinMinutes = helpNeededWithinMinutes; }

    public Double getDynamicRadiusKm() { return dynamicRadiusKm; }
    public void setDynamicRadiusKm(Double dynamicRadiusKm) { this.dynamicRadiusKm = dynamicRadiusKm; }

    public Double getRelayRadiusKm() { return relayRadiusKm; }
    public void setRelayRadiusKm(Double relayRadiusKm) { this.relayRadiusKm = relayRadiusKm; }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getUrgency() { return urgency; }
    public void setUrgency(String urgency) { this.urgency = urgency; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }

    public java.util.List<Double> getEmbedding() { return embedding; }
    public void setEmbedding(java.util.List<Double> embedding) { this.embedding = embedding; }

    public String getRequiredBloodGroup() { return requiredBloodGroup; }
    public void setRequiredBloodGroup(String requiredBloodGroup) { this.requiredBloodGroup = requiredBloodGroup; }

    public String getAiCategory() { return aiCategory; }
    public void setAiCategory(String aiCategory) { this.aiCategory = aiCategory; }

    public String getAiUrgency() { return aiUrgency; }
    public void setAiUrgency(String aiUrgency) { this.aiUrgency = aiUrgency; }

    public String getAiSummary() { return aiSummary; }
    public void setAiSummary(String aiSummary) { this.aiSummary = aiSummary; }

    public String getRequesterId() { return requesterId; }
    public void setRequesterId(String requesterId) { this.requesterId = requesterId; }

    public String getRequesterName() { return requesterName; }
    public void setRequesterName(String requesterName) { this.requesterName = requesterName; }

    public String getVolunteerId() { return volunteerId; }
    public void setVolunteerId(String volunteerId) { this.volunteerId = volunteerId; }

    public String getVolunteerName() { return volunteerName; }
    public void setVolunteerName(String volunteerName) { this.volunteerName = volunteerName; }

    public String getCommunityId() { return communityId; }
    public void setCommunityId(String communityId) { this.communityId = communityId; }

    public String getCommunityName() { return communityName; }
    public void setCommunityName(String communityName) { this.communityName = communityName; }

    public int getCurrentTier() { return currentTier; }
    public void setCurrentTier(int currentTier) { this.currentTier = currentTier; }

    public int getViewCount() { return viewCount; }
    public void setViewCount(int viewCount) { this.viewCount = viewCount; }

    public int getResponseCount() { return responseCount; }
    public void setResponseCount(int responseCount) { this.responseCount = responseCount; }

    public int getShareCount() { return shareCount; }
    public void setShareCount(int shareCount) { this.shareCount = shareCount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    // Backward/alternate JSON field names expected by some clients
    @JsonProperty("location")
    public String getLocation() { return address; }

    @JsonProperty("contact")
    public String getContact() { return contactPhone; }

    @JsonProperty("views")
    public int getViews() { return viewCount; }

    @JsonProperty("userId")
    public String getUserId() { return requesterId; }

    public LocalDateTime getAcceptedAt() { return acceptedAt; }
    public void setAcceptedAt(LocalDateTime acceptedAt) { this.acceptedAt = acceptedAt; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public String getVolunteerProgressStatus() { return volunteerProgressStatus; }
    public void setVolunteerProgressStatus(String volunteerProgressStatus) { this.volunteerProgressStatus = volunteerProgressStatus; }

    public LocalDateTime getVolunteerStatusUpdatedAt() { return volunteerStatusUpdatedAt; }
    public void setVolunteerStatusUpdatedAt(LocalDateTime volunteerStatusUpdatedAt) { this.volunteerStatusUpdatedAt = volunteerStatusUpdatedAt; }

    public boolean isRequesterRatingPending() { return requesterRatingPending; }
    public void setRequesterRatingPending(boolean requesterRatingPending) { this.requesterRatingPending = requesterRatingPending; }

    public boolean isRequesterRated() { return requesterRated; }
    public void setRequesterRated(boolean requesterRated) { this.requesterRated = requesterRated; }

    public Integer getVolunteerRating() { return volunteerRating; }
    public void setVolunteerRating(Integer volunteerRating) { this.volunteerRating = volunteerRating; }

    public String getVolunteerFeedback() { return volunteerFeedback; }
    public void setVolunteerFeedback(String volunteerFeedback) { this.volunteerFeedback = volunteerFeedback; }

    private Map<String, Object> ocrDetails = new java.util.HashMap<>();

    public java.util.Map<String, Object> getOcrDetails() { return ocrDetails; }
    public void setOcrDetails(java.util.Map<String, Object> ocrDetails) { this.ocrDetails = ocrDetails; }

    public String getRequiredSkill() { return requiredSkill; }
    public void setRequiredSkill(String requiredSkill) { this.requiredSkill = requiredSkill; }

    public List<TimelineEntry> getTimeline() { return timeline; }
    public void setTimeline(List<TimelineEntry> timeline) { this.timeline = timeline; }

    public Long getTotalResponseTimeMinutes() { return totalResponseTimeMinutes; }
    public void setTotalResponseTimeMinutes(Long totalResponseTimeMinutes) { this.totalResponseTimeMinutes = totalResponseTimeMinutes; }

    public Map<String, Object> getAiParseResult() { return aiParseResult; }
    public void setAiParseResult(Map<String, Object> aiParseResult) { this.aiParseResult = aiParseResult; }

    public Map<String, Object> getAiFakeDetectionResult() { return aiFakeDetectionResult; }
    public void setAiFakeDetectionResult(Map<String, Object> aiFakeDetectionResult) { this.aiFakeDetectionResult = aiFakeDetectionResult; }

    public Map<String, Object> getAiMatchingResult() { return aiMatchingResult; }
    public void setAiMatchingResult(Map<String, Object> aiMatchingResult) { this.aiMatchingResult = aiMatchingResult; }

    public boolean isFlagged() { return flagged; }
    public void setFlagged(boolean flagged) { this.flagged = flagged; }

    public String getFlagReason() { return flagReason; }
    public void setFlagReason(String flagReason) { this.flagReason = flagReason; }
}
