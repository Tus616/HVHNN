package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.MemberRole;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "community_members")
@CompoundIndex(name = "uk_member_user_community", def = "{'userId': 1, 'communityId': 1}", unique = true)
@CompoundIndex(name = "idx_member_community_status", def = "{'communityId': 1, 'status': 1}")
@CompoundIndex(name = "idx_member_user_status", def = "{'userId': 1, 'status': 1}")
@CompoundIndex(name = "idx_member_community_role", def = "{'communityId': 1, 'role': 1}")
public class Member {
    @Id
    private String id;

    @Indexed
    private String userId;

    @Indexed
    private String communityId;

    private MemberRole role = MemberRole.MEMBER;
    private String status = "ACTIVE";
    private String invitedBy;
    private String approvedBy;
    private LocalDateTime approvedAt;
    private LocalDateTime lastActiveAt;
    private boolean muted = false;
    private boolean banned = false;
    private String banReason;

    @CreatedDate
    private LocalDateTime joinedAt;
    @LastModifiedDate
    private LocalDateTime updatedAt;

    public Member() {}

    public Member(String userId, String communityId, MemberRole role) {
        this.userId = userId;
        this.communityId = communityId;
        this.role = role;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getCommunityId() { return communityId; }
    public void setCommunityId(String communityId) { this.communityId = communityId; }

    public MemberRole getRole() { return role; }
    public void setRole(MemberRole role) { this.role = role; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getInvitedBy() { return invitedBy; }
    public void setInvitedBy(String invitedBy) { this.invitedBy = invitedBy; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public LocalDateTime getApprovedAt() { return approvedAt; }
    public void setApprovedAt(LocalDateTime approvedAt) { this.approvedAt = approvedAt; }
    public LocalDateTime getLastActiveAt() { return lastActiveAt; }
    public void setLastActiveAt(LocalDateTime lastActiveAt) { this.lastActiveAt = lastActiveAt; }
    public boolean isMuted() { return muted; }
    public void setMuted(boolean muted) { this.muted = muted; }
    public boolean isBanned() { return banned; }
    public void setBanned(boolean banned) { this.banned = banned; }
    public String getBanReason() { return banReason; }
    public void setBanReason(String banReason) { this.banReason = banReason; }

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
