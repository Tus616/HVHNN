package com.hvhn.backend.service;

import com.hvhn.backend.model.Announcement;
import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.Member;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.AnnouncementRepository;
import com.hvhn.backend.repository.CommunityRepository;
import com.hvhn.backend.repository.MemberRepository;
import com.hvhn.backend.repository.UserRepository;
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
    private final UserRepository userRepository;
    private final FirebaseService firebaseService;

    public AnnouncementService(AnnouncementRepository announcementRepository,
                               CommunityRepository communityRepository,
                               MemberRepository memberRepository,
                               UserRepository userRepository,
                               FirebaseService firebaseService) {
        this.announcementRepository = announcementRepository;
        this.communityRepository = communityRepository;
        this.memberRepository = memberRepository;
        this.userRepository = userRepository;
        this.firebaseService = firebaseService;
    }

    public List<Announcement> getAnnouncements(String communityId) {
        return announcementRepository.findByCommunityIdOrderByIsPinnedDescCreatedAtDesc(communityId);
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

        // Background notification broadcast
        new Thread(() -> broadcastNotification(saved)).start();

        return saved;
    }

    public void deleteAnnouncement(String id) {
        announcementRepository.deleteById(id);
    }

    public Announcement togglePin(String id) {
        Announcement a = announcementRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Announcement not found"));
        a.setPinned(!a.isPinned());
        return announcementRepository.save(a);
    }

    private void broadcastNotification(Announcement announcement) {
        try {
            Community community = communityRepository.findById(announcement.getCommunityId()).orElse(null);
            if (community == null) return;

            List<Member> members = memberRepository.findByCommunityIdOrderByJoinedAtAsc(announcement.getCommunityId());
            List<String> userIds = members.stream().map(Member::getUserId).collect(Collectors.toList());

            List<User> users = userRepository.findAllById(userIds);
            String title = "📢 " + community.getName() + ": New Announcement";
            String body = announcement.getTitle();

            for (User user : users) {
                if (user.getNotificationToken() != null && !user.getNotificationToken().isBlank()) {
                    try {
                        firebaseService.sendNotification(user.getNotificationToken(), title, body);
                    } catch (Exception e) {
                        logger.warn("Failed to send notification to user {}: {}", user.getId(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            logger.error("Error broadcasting community notification", e);
        }
    }
}
