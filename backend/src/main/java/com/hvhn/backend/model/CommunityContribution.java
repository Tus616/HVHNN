package com.hvhn.backend.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "community_contributions")
@CompoundIndex(name = "idx_contribution_campaign_status", def = "{'campaignId': 1, 'status': 1}")
@CompoundIndex(name = "idx_contribution_community_campaign", def = "{'communityId': 1, 'campaignId': 1}")
public class CommunityContribution {
    @Id
    private String id;
    private String communityId;
    @Indexed
    private String campaignId;
    @Indexed
    private String contributorUserId;
    private String type;
    private BigDecimal amount = BigDecimal.ZERO;
    private int volunteerHours = 0;
    private String note;
    private String status = "RECORDED";
    @CreatedDate
    private LocalDateTime createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCommunityId() { return communityId; }
    public void setCommunityId(String communityId) { this.communityId = communityId; }
    public String getCampaignId() { return campaignId; }
    public void setCampaignId(String campaignId) { this.campaignId = campaignId; }
    public String getContributorUserId() { return contributorUserId; }
    public void setContributorUserId(String contributorUserId) { this.contributorUserId = contributorUserId; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public int getVolunteerHours() { return volunteerHours; }
    public void setVolunteerHours(int volunteerHours) { this.volunteerHours = volunteerHours; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
