package com.hvhn.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "request_comments")
@CompoundIndex(name = "idx_request_comments_created", def = "{'requestId': 1, 'createdAt': 1}")
public class RequestComment {
    @Id
    private String id;
    @Indexed
    private String requestId;
    @Indexed
    private String authorId;
    private String authorName;
    private String authorProfileImage;
    private String avatarUrl;
    private String text;
    private LocalDateTime createdAt;
    private boolean deleted;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }
    public String getAuthorName() { return authorName; }
    public void setAuthorName(String authorName) { this.authorName = authorName; }
    public String getAuthorProfileImage() { return authorProfileImage; }
    public void setAuthorProfileImage(String authorProfileImage) { this.authorProfileImage = authorProfileImage; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }
}
