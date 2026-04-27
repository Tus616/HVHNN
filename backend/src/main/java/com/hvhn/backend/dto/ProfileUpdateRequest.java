package com.hvhn.backend.dto;

public class ProfileUpdateRequest {
    private String fullName;
    private String phone;
    private String address;
    private String bio;
    private String bloodGroup;
    private boolean isBloodDonor;

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
}
