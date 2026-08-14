package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.CommunityCategory;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "communities")
@CompoundIndex(name = "uk_community_slug", def = "{'slug': 1}", unique = true)
@CompoundIndex(name = "idx_community_status_visibility", def = "{'status': 1, 'visibility': 1}")
@CompoundIndex(name = "idx_community_city_status", def = "{'city': 1, 'status': 1}")
@CompoundIndex(name = "idx_community_category_status", def = "{'category': 1, 'status': 1}")
public class Community {
    @Id
    private String id;

    private String name;
    private String slug;
    private String description;

    @Indexed
    private String location;
    private String address;
    private String city;
    private String district;
    private String state;
    private Double latitude;
    private Double longitude;
    @GeoSpatialIndexed(name = "idx_communities_location_2dsphere", type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint geoLocation;

    @Indexed
    private CommunityCategory category;
    private String visibility = "PUBLIC";
    private String joinPolicy = "OPEN";
    private String joinCodeHash;

    private List<String> memberIds = new ArrayList<>();
    private String ownerUserId;
    private String status = "ACTIVE";
    private long memberCount = 0;
    private String coverImageUrl;
    private String logoUrl;
    private List<String> rules = new ArrayList<>();
    private List<String> tags = new ArrayList<>();

    // Verification controls
    private String institutionDomain;
    private String joinCode;

    @CreatedDate
    private LocalDateTime createdAt;

    @LastModifiedDate
    private LocalDateTime updatedAt;

    public Community() {}

    public Community(String name, String description, String location, CommunityCategory category) {
        this.name = name;
        this.description = description;
        this.location = location;
        this.category = category;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public GeoJsonPoint getGeoLocation() { return geoLocation; }
    public void setGeoLocation(GeoJsonPoint geoLocation) { this.geoLocation = geoLocation; }

    public CommunityCategory getCategory() { return category; }
    public void setCategory(CommunityCategory category) { this.category = category; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public String getJoinPolicy() { return joinPolicy; }
    public void setJoinPolicy(String joinPolicy) { this.joinPolicy = joinPolicy; }
    public String getJoinCodeHash() { return joinCodeHash; }
    public void setJoinCodeHash(String joinCodeHash) { this.joinCodeHash = joinCodeHash; }

    public List<String> getMemberIds() { return memberIds; }
    public void setMemberIds(List<String> memberIds) { this.memberIds = memberIds; }
    public String getOwnerUserId() { return ownerUserId; }
    public void setOwnerUserId(String ownerUserId) { this.ownerUserId = ownerUserId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public long getMemberCount() { return memberCount; }
    public void setMemberCount(long memberCount) { this.memberCount = memberCount; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public void setCoverImageUrl(String coverImageUrl) { this.coverImageUrl = coverImageUrl; }
    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public List<String> getRules() { return rules; }
    public void setRules(List<String> rules) { this.rules = rules; }
    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getInstitutionDomain() { return institutionDomain; }
    public void setInstitutionDomain(String institutionDomain) { this.institutionDomain = institutionDomain; }

    public String getJoinCode() { return joinCode; }
    public void setJoinCode(String joinCode) { this.joinCode = joinCode; }
}
