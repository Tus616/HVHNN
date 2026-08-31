package com.hvhn.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.util.ArrayList;
import java.util.List;

public class OnboardingRequest {
    @Size(max = 100, message = "Full name must be 100 characters or less")
    private String fullName;
    @Size(max = 40, message = "Phone must be 40 characters or less")
    private String phone;
    @Size(max = 500, message = "Bio must be 500 characters or less")
    private String bio;
    @Size(max = 240, message = "Address must be 240 characters or less")
    private String address;
    @Size(max = 80, message = "City must be 80 characters or less")
    private String city;
    @Size(max = 80, message = "District must be 80 characters or less")
    private String district;
    @Size(max = 80, message = "State must be 80 characters or less")
    private String state;
    @Size(max = 20, message = "Postal code must be 20 characters or less")
    private String postalCode;
    @DecimalMin(value = "-90.0", message = "Latitude must be at least -90")
    @DecimalMax(value = "90.0", message = "Latitude must be at most 90")
    private Double latitude;
    @DecimalMin(value = "-180.0", message = "Longitude must be at least -180")
    @DecimalMax(value = "180.0", message = "Longitude must be at most 180")
    private Double longitude;
    private String locationSource;
    private boolean volunteerEnabled;
    private List<String> volunteerCategories = new ArrayList<>();

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
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
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public String getLocationSource() { return locationSource; }
    public void setLocationSource(String locationSource) { this.locationSource = locationSource; }
    public boolean isVolunteerEnabled() { return volunteerEnabled; }
    public void setVolunteerEnabled(boolean volunteerEnabled) { this.volunteerEnabled = volunteerEnabled; }
    public List<String> getVolunteerCategories() { return volunteerCategories; }
    public void setVolunteerCategories(List<String> volunteerCategories) { this.volunteerCategories = volunteerCategories; }
}
