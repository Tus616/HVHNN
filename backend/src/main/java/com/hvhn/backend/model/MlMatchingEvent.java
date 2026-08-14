package com.hvhn.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "ml_matching_events")
@CompoundIndex(name = "idx_ml_match_request_candidate", def = "{'requestId': 1, 'candidateUserId': 1}")
public class MlMatchingEvent {
    @Id
    private String id;
    @Indexed
    private String requestId;
    @Indexed
    private String candidateUserId;
    private String modelVersion;
    private String rankingMode = "BOOTSTRAP_RANKING";
    private int rank;
    private double score;
    private boolean accepted;
    private boolean completed;
    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();
    private LocalDateTime acceptedAt;
    private LocalDateTime completedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getCandidateUserId() { return candidateUserId; }
    public void setCandidateUserId(String candidateUserId) { this.candidateUserId = candidateUserId; }
    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String modelVersion) { this.modelVersion = modelVersion; }
    public String getRankingMode() { return rankingMode; }
    public void setRankingMode(String rankingMode) { this.rankingMode = rankingMode; }
    public int getRank() { return rank; }
    public void setRank(int rank) { this.rank = rank; }
    public double getScore() { return score; }
    public void setScore(double score) { this.score = score; }
    public boolean isAccepted() { return accepted; }
    public void setAccepted(boolean accepted) { this.accepted = accepted; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getAcceptedAt() { return acceptedAt; }
    public void setAcceptedAt(LocalDateTime acceptedAt) { this.acceptedAt = acceptedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
