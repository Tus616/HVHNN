package com.hvhn.backend.controller;

import com.hvhn.backend.model.Announcement;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.enums.MemberRole;

import com.hvhn.backend.repository.MemberRepository;
import com.hvhn.backend.service.AnnouncementService;
import com.hvhn.backend.service.CommunityService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/community")
public class AnnouncementController {

    private final AnnouncementService announcementService;
    private final MemberRepository memberRepository;

    public AnnouncementController(AnnouncementService announcementService, MemberRepository memberRepository) {
        this.announcementService = announcementService;
        this.memberRepository = memberRepository;
    }

    @GetMapping("/{id}/announcements")
    public List<Announcement> getAnnouncements(@PathVariable String id) {
        return announcementService.getAnnouncements(id);
    }

    @PostMapping("/{id}/announcements")
    public Announcement createAnnouncement(
            @PathVariable String id,
            @RequestBody Announcement announcement,
            @AuthenticationPrincipal User currentUser
    ) {
        validateAdminAccess(id, currentUser);
        return announcementService.createAnnouncement(id, announcement, currentUser);
    }

    @DeleteMapping("/{id}/announcements/{announcementId}")
    public ResponseEntity<Void> deleteAnnouncement(
            @PathVariable String id,
            @PathVariable String announcementId,
            @AuthenticationPrincipal User currentUser
    ) {
        validateAdminAccess(id, currentUser);
        announcementService.deleteAnnouncement(announcementId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/announcements/{announcementId}/pin")
    public Announcement togglePin(
            @PathVariable String id,
            @PathVariable String announcementId,
            @AuthenticationPrincipal User currentUser
    ) {
        validateAdminAccess(id, currentUser);
        return announcementService.togglePin(announcementId);
    }

    // Special endpoint for Help Feed banner
    @GetMapping("/announcements/pinned")
    public List<Announcement> getPinnedAnnouncements(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return List.of();
        // Fetch community IDs user has joined
        List<String> joinedCommunityIds = memberRepository.findByUserId(currentUser.getId()).stream()
                .map(m -> m.getCommunityId())
                .toList();
        return announcementService.getAllPinnedAnnouncements(joinedCommunityIds);
    }

    private void validateAdminAccess(String communityId, User user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if ("ADMIN".equalsIgnoreCase(user.getRole())) {
            return; // Platform admin has full access
        }
        boolean isCommunityAdmin = memberRepository.findByUserIdAndCommunityId(user.getId(), communityId)
                .map(member -> member.getRole() == MemberRole.ADMIN)
                .orElse(false);
        if (!isCommunityAdmin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Community admin access is required");
        }
    }
}
