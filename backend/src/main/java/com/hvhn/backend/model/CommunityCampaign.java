package com.hvhn.backend.model;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "community_campaigns")
@CompoundIndex(name = "idx_campaign_community_status_created", def = "{'communityId': 1, 'status': 1, 'createdAt': -1}")
@CompoundIndex(name = "idx_campaign_community_category", def = "{'communityId': 1, 'category': 1}")
public class CommunityCampaign {
    @Id
    private String id;
    @Indexed
    private String communityId;
    @Indexed
    private String creatorUserId;
    private String title;
    private String story;
    private String category;
    private String urgency;
    private String status = "ACTIVE";
    private String targetType = "SUPPLIES";
    private BigDecimal targetAmount = BigDecimal.ZERO;
    private BigDecimal collectedAmount = BigDecimal.ZERO;
    private long contributionCount = 0;
    private int volunteerGoal = 0;
    private int volunteerCount = 0;
    private String location;
    private String city;
    private String district;
    private String state;
    @GeoSpatialIndexed(name = "idx_campaigns_location_2dsphere", type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint geoLocation;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private List<String> images = new ArrayList<>();
    private String moderationStatus = "VISIBLE";
    @CreatedDate
    private LocalDateTime createdAt;
    @LastModifiedDate
    private LocalDateTime updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getCommunityId() { return communityId; }
    public void setCommunityId(String communityId) { this.communityId = communityId; }
    public String getCreatorUserId() { return creatorUserId; }
    public void setCreatorUserId(String creatorUserId) { this.creatorUserId = creatorUserId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getStory() { return story; }
    public void setStory(String story) { this.story = story; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getUrgency() { return urgency; }
    public void setUrgency(String urgency) { this.urgency = urgency; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getTargetType() { return targetType; }
    public void setTargetType(String targetType) { this.targetType = targetType; }
    public BigDecimal getTargetAmount() { return targetAmount; }
    public void setTargetAmount(BigDecimal targetAmount) { this.targetAmount = targetAmount; }
    public BigDecimal getCollectedAmount() { return collectedAmount; }
    public void setCollectedAmount(BigDecimal collectedAmount) { this.collectedAmount = collectedAmount; }
    public long getContributionCount() { return contributionCount; }
    public void setContributionCount(long contributionCount) { this.contributionCount = contributionCount; }
    public int getVolunteerGoal() { return volunteerGoal; }
    public void setVolunteerGoal(int volunteerGoal) { this.volunteerGoal = volunteerGoal; }
    public int getVolunteerCount() { return volunteerCount; }
    public void setVolunteerCount(int volunteerCount) { this.volunteerCount = volunteerCount; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public GeoJsonPoint getGeoLocation() { return geoLocation; }
    public void setGeoLocation(GeoJsonPoint geoLocation) { this.geoLocation = geoLocation; }
    public LocalDateTime getStartAt() { return startAt; }
    public void setStartAt(LocalDateTime startAt) { this.startAt = startAt; }
    public LocalDateTime getEndAt() { return endAt; }
    public void setEndAt(LocalDateTime endAt) { this.endAt = endAt; }
    public List<String> getImages() { return images; }
    public void setImages(List<String> images) { this.images = images; }
    public String getModerationStatus() { return moderationStatus; }
    public void setModerationStatus(String moderationStatus) { this.moderationStatus = moderationStatus; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
