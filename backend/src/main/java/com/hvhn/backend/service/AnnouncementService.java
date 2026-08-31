package com.hvhn.backend.service;

import com.hvhn.backend.model.Announcement;
import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.Member;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.AnnouncementRepository;
import com.hvhn.backend.repository.CommunityRepository;
import com.hvhn.backend.repository.MemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AnnouncementService {
    private static final Logger logger = LoggerFactory.getLogger(AnnouncementService.class);

    private final AnnouncementRepository announcementRepository;
    private final CommunityRepository communityRepository;
    private final MemberRepository memberRepository;
    private final NotificationService notificationService;

    public AnnouncementService(AnnouncementRepository announcementRepository,
                               CommunityRepository communityRepository,
                               MemberRepository memberRepository,
                               NotificationService notificationService) {
        this.announcementRepository = announcementRepository;
        this.communityRepository = communityRepository;
        this.memberRepository = memberRepository;
        this.notificationService = notificationService;
    }

    public List<Announcement> getAnnouncements(String communityId) {
        return announcementRepository.findByCommunityIdOrderByIsPinnedDescCreatedAtDesc(communityId)
                .stream()
                .filter(a -> "ACTIVE".equals(a.getStatus()))
                .toList();
    }

    public List<Announcement> getAllPinnedAnnouncements(List<String> communityIds) {
        return announcementRepository.findAll().stream()
                .filter(a -> a.isPinned() && communityIds.contains(a.getCommunityId()))
                .collect(Collectors.toList());
    }

    public Announcement createAnnouncement(String communityId, Announcement announcement, User author) {
        announcement.setCommunityId(communityId);
        announcement.setAuthorId(author.getId());
        announcement.setAuthorName(author.getFullName());
        Announcement saved = announcementRepository.save(announcement);
        broadcastNotification(saved);
        return saved;
    }

    public void deleteAnnouncement(String communityId, String id) {
        Announcement announcement = announcementRepository.findById(id)
                .filter(entry -> communityId.equals(entry.getCommunityId()))
                .orElseThrow(() -> new RuntimeException("Announcement not found"));
        announcement.setStatus("DELETED");
        announcementRepository.save(announcement);
    }

    public Announcement togglePin(String communityId, String id) {
        Announcement announcement = announcementRepository.findById(id)
                .filter(entry -> communityId.equals(entry.getCommunityId()))
                .orElseThrow(() -> new RuntimeException("Announcement not found"));
        announcement.setPinned(!announcement.isPinned());
        return announcementRepository.save(announcement);
    }

    private void broadcastNotification(Announcement announcement) {
        try {
            Community community = communityRepository.findById(announcement.getCommunityId()).orElse(null);
            if (community == null) return;
            List<String> userIds = memberRepository.findByCommunityIdOrderByJoinedAtAsc(announcement.getCommunityId())
                    .stream()
                    .map(Member::getUserId)
                    .filter(userId -> !userId.equals(announcement.getAuthorId()))
                    .toList();
            notificationService.notifyCommunityAnnouncement(announcement, community, userIds);
        } catch (RuntimeException exception) {
            logger.warn("Community notification broadcast failed for announcementId={}: {}", announcement.getId(), exception.getMessage());
        }
    }
}
