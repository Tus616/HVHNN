package com.hvhn.backend.model;

import com.hvhn.backend.model.enums.MemberRole;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "community_members")
@CompoundIndex(name = "uk_member_user_community", def = "{'userId': 1, 'communityId': 1}", unique = true)
public class Member {
    @Id
    private String id;

    @Indexed
    private String userId;

    @Indexed
    private String communityId;

    private MemberRole role = MemberRole.MEMBER;

    @CreatedDate
    private LocalDateTime joinedAt;

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

    public LocalDateTime getJoinedAt() { return joinedAt; }
    public void setJoinedAt(LocalDateTime joinedAt) { this.joinedAt = joinedAt; }
}
