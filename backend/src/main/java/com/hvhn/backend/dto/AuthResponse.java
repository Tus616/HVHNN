package com.hvhn.backend.dto;

import java.util.ArrayList;
import java.util.List;

public class AuthResponse {
    private String token;
    private String email;
    private String fullName;
    private String role;
    private String userId;
    private String phone;
    private int points;
    private int requestsHelped;
    private int requestsCreated;
    private double rating;
    private boolean verified;
    private Double latitude;
    private Double longitude;
    private String address;
    private boolean isVolunteer;
    private String volunteerStatus;
    private List<String> volunteerCategories = new ArrayList<>();
    private String bloodGroup;
    private boolean isBloodDonor;
    private int totalHelpCount;
    private String badge;
    private List<String> badges = new ArrayList<>();
    private String verificationLevel;
    private boolean onboardingCompleted;
    private String authProvider;
    private String profileImage;
    private String bio;
    private String city;
    private String district;
    private String state;
    private String postalCode;

    public AuthResponse() {}
    public AuthResponse(String token, String email, String fullName, String role, String userId) {
        this.token = token;
        this.email = email;
        this.fullName = fullName;
        this.role = role;
        this.userId = userId;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public int getPoints() { return points; }
    public void setPoints(int points) { this.points = points; }
    public int getRequestsHelped() { return requestsHelped; }
    public void setRequestsHelped(int requestsHelped) { this.requestsHelped = requestsHelped; }
    public int getRequestsCreated() { return requestsCreated; }
    public void setRequestsCreated(int requestsCreated) { this.requestsCreated = requestsCreated; }
    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }
    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }
    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public boolean isVolunteer() { return isVolunteer; }
    public void setVolunteer(boolean volunteer) { isVolunteer = volunteer; }
    public String getVolunteerStatus() { return volunteerStatus; }
    public void setVolunteerStatus(String volunteerStatus) { this.volunteerStatus = volunteerStatus; }
    public List<String> getVolunteerCategories() { return volunteerCategories; }
    public void setVolunteerCategories(List<String> volunteerCategories) { this.volunteerCategories = volunteerCategories; }
    public int getTotalHelpCount() { return totalHelpCount; }
    public void setTotalHelpCount(int totalHelpCount) { this.totalHelpCount = totalHelpCount; }
    public String getBadge() { return badge; }
    public void setBadge(String badge) { this.badge = badge; }
    public List<String> getBadges() { return badges; }
    public void setBadges(List<String> badges) { this.badges = badges; }
    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }
    public boolean getIsBloodDonor() { return isBloodDonor; }
    public void setIsBloodDonor(boolean isBloodDonor) { this.isBloodDonor = isBloodDonor; }

    public String getVerificationLevel() { return verificationLevel; }
    public void setVerificationLevel(String verificationLevel) { this.verificationLevel = verificationLevel; }
    public boolean isOnboardingCompleted() { return onboardingCompleted; }
    public void setOnboardingCompleted(boolean onboardingCompleted) { this.onboardingCompleted = onboardingCompleted; }
    public String getAuthProvider() { return authProvider; }
    public void setAuthProvider(String authProvider) { this.authProvider = authProvider; }
    public String getProfileImage() { return profileImage; }
    public void setProfileImage(String profileImage) { this.profileImage = profileImage; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }
    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
    public String getPostalCode() { return postalCode; }
    public void setPostalCode(String postalCode) { this.postalCode = postalCode; }
}
