package com.hvhn.backend.service;

import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.Member;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.enums.MemberRole;
import com.hvhn.backend.repository.MemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

@Service
public class CommunityPermissionService {

    private final MemberRepository memberRepository;

    public CommunityPermissionService(MemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    public boolean isPlatformAdmin(User user) {
        return user != null && "ADMIN".equalsIgnoreCase(user.getRole());
    }

    public Optional<Member> membership(User user, String communityId) {
        if (user == null || communityId == null) return Optional.empty();
        return memberRepository.findByUserIdAndCommunityId(user.getId(), communityId);
    }

    public boolean isActiveMember(User user, String communityId) {
        return isPlatformAdmin(user)
                || membership(user, communityId)
                .filter(member -> "ACTIVE".equals(member.getStatus()))
                .filter(member -> !member.isBanned())
                .isPresent();
    }

    public boolean canModerate(User user, String communityId) {
        return isPlatformAdmin(user) || membership(user, communityId)
                .filter(member -> "ACTIVE".equals(member.getStatus()))
                .map(member -> member.getRole() == MemberRole.OWNER
                        || member.getRole() == MemberRole.ADMIN
                        || member.getRole() == MemberRole.MODERATOR)
                .orElse(false);
    }

    public boolean canAdmin(User user, String communityId) {
        return isPlatformAdmin(user) || membership(user, communityId)
                .filter(member -> "ACTIVE".equals(member.getStatus()))
                .map(member -> member.getRole() == MemberRole.OWNER || member.getRole() == MemberRole.ADMIN)
                .orElse(false);
    }

    public boolean isOwner(User user, String communityId) {
        return membership(user, communityId)
                .filter(member -> "ACTIVE".equals(member.getStatus()))
                .map(member -> member.getRole() == MemberRole.OWNER)
                .orElse(false);
    }

    public void requireAuthenticated(User user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required.");
    }

    public void requireActiveCommunity(Community community) {
        if (community == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Community not found.");
        if (!"ACTIVE".equals(community.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Community is not active.");
        }
    }

    public void requireMember(User user, String communityId) {
        requireAuthenticated(user);
        if (!isActiveMember(user, communityId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Active community membership is required.");
        }
    }

    public void requireModerator(User user, String communityId) {
        requireAuthenticated(user);
        if (!canModerate(user, communityId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Community moderation access is required.");
        }
    }

    public void requireAdmin(User user, String communityId) {
        requireAuthenticated(user);
        if (!canAdmin(user, communityId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Community admin access is required.");
        }
    }

    public void requireOwner(User user, String communityId) {
        requireAuthenticated(user);
        if (!isOwner(user, communityId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Community owner access is required.");
        }
    }
}
