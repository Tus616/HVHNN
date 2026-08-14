package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.PresenceStatus;

public class ChatParticipantView {
    private String userId;
    private String fullName;
    private String email;
    private String avatarInitial;
    private String avatarUrl;
    private String profileImage;
    private PresenceStatus status;
    private String lastSeen;

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getAvatarInitial() { return avatarInitial; }
    public void setAvatarInitial(String avatarInitial) { this.avatarInitial = avatarInitial; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getProfileImage() { return profileImage; }
    public void setProfileImage(String profileImage) { this.profileImage = profileImage; }

    public PresenceStatus getStatus() { return status; }
    public void setStatus(PresenceStatus status) { this.status = status; }

    public String getLastSeen() { return lastSeen; }
    public void setLastSeen(String lastSeen) { this.lastSeen = lastSeen; }
}
