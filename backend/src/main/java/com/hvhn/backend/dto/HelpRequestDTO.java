package com.hvhn.backend.dto;

public class HelpRequestDTO {
    private String title;
    private String description;
    private String category;
    private String urgency;
    private Double latitude;
    private Double longitude;
    private String address;
    private String city;
    private String district;
    private String state;
    private String postalCode;
    private String locationSource;
    private String contactPhone;
    private String communityId;
    private String requiredBloodGroup;
    private String requiredSkill;
    private Integer helpNeededWithinMinutes; // Time constraint in minutes

    public HelpRequestDTO() {}

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getUrgency() { return urgency; }
    public void setUrgency(String urgency) { this.urgency = urgency; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }
    public String getLocationSource() { return locationSource; }
    public void setLocationSource(String locationSource) { this.locationSource = locationSource; }
    public String getContactPhone() { return contactPhone; }
    public void setContactPhone(String contactPhone) { this.contactPhone = contactPhone; }
    public String getCommunityId() { return communityId; }
    public void setCommunityId(String communityId) { this.communityId = communityId; }
    public String getRequiredBloodGroup() { return requiredBloodGroup; }
    public void setRequiredBloodGroup(String requiredBloodGroup) { this.requiredBloodGroup = requiredBloodGroup; }
    public String getRequiredSkill() { return requiredSkill; }
    public void setRequiredSkill(String requiredSkill) { this.requiredSkill = requiredSkill; }

    public Integer getHelpNeededWithinMinutes() { return helpNeededWithinMinutes; }
    public void setHelpNeededWithinMinutes(Integer helpNeededWithinMinutes) { this.helpNeededWithinMinutes = helpNeededWithinMinutes; }

    private String documentBase64;
    private String documentMimeType;
    private String rawInput;

    public String getDocumentBase64() { return documentBase64; }
    public void setDocumentBase64(String documentBase64) { this.documentBase64 = documentBase64; }

    public String getDocumentMimeType() { return documentMimeType; }
    public void setDocumentMimeType(String documentMimeType) { this.documentMimeType = documentMimeType; }

    public String getRawInput() { return rawInput; }
    public void setRawInput(String rawInput) { this.rawInput = rawInput; }
}
