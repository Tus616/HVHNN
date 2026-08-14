package com.hvhn.backend.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "community_questions")
@CompoundIndex(name = "idx_question_community_status_created", def = "{'communityId': 1, 'status': 1, 'createdAt': -1}")
@CompoundIndex(name = "idx_question_community_tags", def = "{'communityId': 1, 'tags': 1}")
public class CommunityQuestion {
    @Id
    private String id;
    @Indexed
    private String communityId;
    @Indexed
    private String authorUserId;
    private String title;
    private String body;
    private List<String> tags = new ArrayList<>();
    private String status = "OPEN";
    private long answerCount = 0;
    private long upvoteCount = 0;
    private String acceptedAnswerId;
    private String moderationStatus = "VISIBLE";
    @CreatedDate
    private LocalDateTime createdAt;
    @LastModifiedDate
    private LocalDateTime updatedAt;
    private LocalDateTime editedAt;
    private LocalDateTime deletedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCommunityId() { return communityId; }
    public void setCommunityId(String communityId) { this.communityId = communityId; }
    public String getAuthorUserId() { return authorUserId; }
    public void setAuthorUserId(String authorUserId) { this.authorUserId = authorUserId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public long getAnswerCount() { return answerCount; }
    public void setAnswerCount(long answerCount) { this.answerCount = answerCount; }
    public long getUpvoteCount() { return upvoteCount; }
    public void setUpvoteCount(long upvoteCount) { this.upvoteCount = upvoteCount; }
    public String getAcceptedAnswerId() { return acceptedAnswerId; }
    public void setAcceptedAnswerId(String acceptedAnswerId) { this.acceptedAnswerId = acceptedAnswerId; }
    public String getModerationStatus() { return moderationStatus; }
    public void setModerationStatus(String moderationStatus) { this.moderationStatus = moderationStatus; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getEditedAt() { return editedAt; }
    public void setEditedAt(LocalDateTime editedAt) { this.editedAt = editedAt; }
    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }
}
