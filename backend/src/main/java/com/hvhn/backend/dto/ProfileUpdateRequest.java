package com.hvhn.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

public class ProfileUpdateRequest {
    @Size(max = 100, message = "Full name must be 100 characters or less")
    private String fullName;
    @Size(max = 40, message = "Phone must be 40 characters or less")
    private String phone;
    @Size(max = 240, message = "Address must be 240 characters or less")
    private String address;
    @Size(max = 500, message = "Bio must be 500 characters or less")
    private String bio;
    @Size(max = 8, message = "Blood group must be 8 characters or less")
    private String bloodGroup;
    private boolean isBloodDonor;
    private String city;
    private String district;
    private String state;
    private String postalCode;
    @DecimalMin(value = "-90.0", message = "Latitude must be at least -90")
    @DecimalMax(value = "90.0", message = "Latitude must be at most 90")
    private Double latitude;
    @DecimalMin(value = "-180.0", message = "Longitude must be at least -180")
    @DecimalMax(value = "180.0", message = "Longitude must be at most 180")
    private Double longitude;
    private String locationSource;
    private Boolean clearLocation;

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }

    public boolean getIsBloodDonor() { return isBloodDonor; }
    public void setIsBloodDonor(boolean isBloodDonor) { this.isBloodDonor = isBloodDonor; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public String getLocationSource() { return locationSource; }
    public void setLocationSource(String locationSource) { this.locationSource = locationSource; }
    public Boolean getClearLocation() { return clearLocation; }
    public void setClearLocation(Boolean clearLocation) { this.clearLocation = clearLocation; }
}
