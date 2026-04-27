package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.VolunteerSkill;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.ArrayList;
import java.util.List;
import java.time.LocalDateTime;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexed;

@Document(collection = "users")
public class User {
    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private String password;
    private String fullName;
    private String phone;
    private String profileImage;
    private Double latitude;
    private Double longitude;
    @GeoSpatialIndexed(type = GeoSpatialIndexType.GEO_2DSPHERE)
    private GeoJsonPoint location;
    private String address;
    private String role = "USER"; // USER, ADMIN, VOLUNTEER
    private int points = 0;
    private int requestsHelped = 0;
    private int requestsCreated = 0;
    private double rating = 0.0;
    private int ratingCount = 0;
    private boolean verified = false;
    @Field("isVolunteer")
    private boolean volunteer = false;
    private String volunteerStatus = "OFFLINE";
    private List<String> volunteerCategories = new ArrayList<>();
    private String bloodGroup;
    private boolean isBloodDonor = false;
    private String bio;
    private int totalHelpCount = 0;
    private String notificationToken;
    private List<VolunteerSkill> skills = new ArrayList<>();
    private List<EmergencyContact> emergencyContacts = new ArrayList<>();
    
    // Verification System
    private com.hvhn.backend.model.enums.VerificationLevel verificationLevel = com.hvhn.backend.model.enums.VerificationLevel.BASIC;
    
    // Impact & Streaks
    private int currentStreak = 0;
    private int longestStreak = 0;
    private LocalDateTime lastHelpDate;
    private double totalDistanceTraveled = 0.0;
    private int totalPeopleHelped = 0;

    // Availability Scheduler
    private List<AvailabilityEntry> availabilitySchedule = new ArrayList<>();
    private boolean isAlwaysAvailable = false;

    @CreatedDate
    private LocalDateTime createdAt;

    public User() {}

    public User(String email, String password, String fullName) {
        this.email = email;
        this.password = password;
        this.fullName = fullName;
        this.createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getProfileImage() { return profileImage; }
    public void setProfileImage(String profileImage) { this.profileImage = profileImage; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public int getPoints() { return points; }
    public void setPoints(int points) { this.points = points; }

    public int getRequestsHelped() { return requestsHelped; }
    public void setRequestsHelped(int requestsHelped) { this.requestsHelped = requestsHelped; }

    public int getRequestsCreated() { return requestsCreated; }
    public void setRequestsCreated(int requestsCreated) { this.requestsCreated = requestsCreated; }

    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }

    public int getRatingCount() { return ratingCount; }
    public void setRatingCount(int ratingCount) { this.ratingCount = ratingCount; }

    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }

    public boolean isVolunteer() { return volunteer; }
    public void setVolunteer(boolean volunteer) { this.volunteer = volunteer; }

    public String getVolunteerStatus() { return volunteerStatus; }
    public void setVolunteerStatus(String volunteerStatus) { this.volunteerStatus = volunteerStatus; }

    public List<String> getVolunteerCategories() { return volunteerCategories; }
    public void setVolunteerCategories(List<String> volunteerCategories) { this.volunteerCategories = volunteerCategories; }

    public int getTotalHelpCount() { return totalHelpCount; }
    public void setTotalHelpCount(int totalHelpCount) { this.totalHelpCount = totalHelpCount; }

    public String getNotificationToken() { return notificationToken; }
    public void setNotificationToken(String notificationToken) { this.notificationToken = notificationToken; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getBloodGroup() { return bloodGroup; }
    public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }

    public boolean isBloodDonor() { return isBloodDonor; }
    public void setBloodDonor(boolean isBloodDonor) { this.isBloodDonor = isBloodDonor; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public List<VolunteerSkill> getSkills() { return skills; }
    public void setSkills(List<VolunteerSkill> skills) { this.skills = skills; }

    public List<EmergencyContact> getEmergencyContacts() { return emergencyContacts; }
    public void setEmergencyContacts(List<EmergencyContact> emergencyContacts) { this.emergencyContacts = emergencyContacts; }

    public int getCurrentStreak() { return currentStreak; }
    public void setCurrentStreak(int currentStreak) { this.currentStreak = currentStreak; }

    public int getLongestStreak() { return longestStreak; }
    public void setLongestStreak(int longestStreak) { this.longestStreak = longestStreak; }

    public LocalDateTime getLastHelpDate() { return lastHelpDate; }
    public void setLastHelpDate(LocalDateTime lastHelpDate) { this.lastHelpDate = lastHelpDate; }

    public double getTotalDistanceTraveled() { return totalDistanceTraveled; }
    public void setTotalDistanceTraveled(double totalDistanceTraveled) { this.totalDistanceTraveled = totalDistanceTraveled; }

    public int getTotalPeopleHelped() { return totalPeopleHelped; }
    public void setTotalPeopleHelped(int totalPeopleHelped) { this.totalPeopleHelped = totalPeopleHelped; }

    public List<AvailabilityEntry> getAvailabilitySchedule() { return availabilitySchedule; }
    public void setAvailabilitySchedule(List<AvailabilityEntry> availabilitySchedule) { this.availabilitySchedule = availabilitySchedule; }

    public boolean isAlwaysAvailable() { return isAlwaysAvailable; }
    public void setAlwaysAvailable(boolean alwaysAvailable) { isAlwaysAvailable = alwaysAvailable; }

    public com.hvhn.backend.model.enums.VerificationLevel getVerificationLevel() { return verificationLevel; }
    public void setVerificationLevel(com.hvhn.backend.model.enums.VerificationLevel verificationLevel) { this.verificationLevel = verificationLevel; }

    public GeoJsonPoint getLocation() { return location; }
    public void setLocation(GeoJsonPoint location) { this.location = location; }
}
