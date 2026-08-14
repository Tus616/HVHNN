package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.CommunityCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CommunityUpsertRequest {
    @NotBlank(message = "Community name is required")
    private String name;

    @NotBlank(message = "Community description is required")
    private String description;

    private String location;
    private String address;
    private String city;
    private String district;
    private String state;
    private Double latitude;
    private Double longitude;

    @NotNull(message = "Community category is required")
    private CommunityCategory category;

    private String visibility;
    private String joinPolicy;
    private String institutionDomain;
    private String joinCode;
    private java.util.List<String> rules;
    private java.util.List<String> tags;
    private String coverImageUrl;
    private String logoUrl;

    public CommunityUpsertRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

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

    public CommunityCategory getCategory() { return category; }
    public void setCategory(CommunityCategory category) { this.category = category; }
    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public String getJoinPolicy() { return joinPolicy; }
    public void setJoinPolicy(String joinPolicy) { this.joinPolicy = joinPolicy; }

    public String getInstitutionDomain() { return institutionDomain; }
    public void setInstitutionDomain(String institutionDomain) { this.institutionDomain = institutionDomain; }

    public String getJoinCode() { return joinCode; }
    public void setJoinCode(String joinCode) { this.joinCode = joinCode; }
    public java.util.List<String> getRules() { return rules; }
    public void setRules(java.util.List<String> rules) { this.rules = rules; }
    public java.util.List<String> getTags() { return tags; }
    public void setTags(java.util.List<String> tags) { this.tags = tags; }
    public String getCoverImageUrl() { return coverImageUrl; }
    public void setCoverImageUrl(String coverImageUrl) { this.coverImageUrl = coverImageUrl; }
    public String getLogoUrl() { return logoUrl; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
}
