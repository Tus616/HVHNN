package com.hvhn.backend.service;

import com.hvhn.backend.dto.CommunityRequestCreateRequest;
import com.hvhn.backend.dto.CommunityRequestUpdateRequest;
import com.hvhn.backend.dto.CommunityUpsertRequest;
import com.hvhn.backend.dto.MemberRoleUpdateRequest;
import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.Member;
import com.hvhn.backend.model.Request;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.enums.CommunityCategory;
import com.hvhn.backend.model.enums.MemberRole;
import com.hvhn.backend.model.enums.RequestStatus;
import com.hvhn.backend.model.enums.RequestUrgency;
import com.hvhn.backend.repository.CommunityRepository;
import com.hvhn.backend.repository.MemberRepository;
import com.hvhn.backend.repository.RequestRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;

@Service
public class CommunityService {

    private final CommunityRepository communityRepository;
    private final MemberRepository memberRepository;
    private final RequestRepository requestRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final com.hvhn.backend.repository.UserRepository userRepository;

    public CommunityService(CommunityRepository communityRepository,
                            MemberRepository memberRepository,
                            RequestRepository requestRepository,
                            SimpMessagingTemplate messagingTemplate,
                            com.hvhn.backend.repository.UserRepository userRepository) {
        this.communityRepository = communityRepository;
        this.memberRepository = memberRepository;
        this.requestRepository = requestRepository;
        this.messagingTemplate = messagingTemplate;
        this.userRepository = userRepository;
    }

    public List<Community> getAllCommunities(CommunityCategory category) {
        if (category != null) {
            return communityRepository.findByCategoryOrderByCreatedAtDesc(category);
        }
        return communityRepository.findAllByOrderByCreatedAtDesc();
    }

    public Community getCommunity(String communityId) {
        return findCommunity(communityId);
    }

    public long getMemberCount(String communityId) {
        return memberRepository.countByCommunityId(communityId);
    }

    public long getRequestCount(String communityId) {
        return requestRepository.countByCommunityId(communityId);
    }

    public Community createCommunity(CommunityUpsertRequest payload, User currentUser) {
        // Any authenticated user can create a community.
        // The creator is automatically assigned as the ADMIN member below.

        Community community = new Community(
                payload.getName().trim(),
                payload.getDescription().trim(),
                payload.getLocation().trim(),
                payload.getCategory()
        );

        Community savedCommunity = communityRepository.save(community);
        Member adminMembership = memberRepository.save(
                new Member(currentUser.getId(), savedCommunity.getId(), MemberRole.ADMIN)
        );
        savedCommunity.setMemberIds(List.of(currentUser.getId()));
        return communityRepository.save(savedCommunity);
    }

    public Community updateCommunity(String communityId, CommunityUpsertRequest payload, User currentUser) {
        requireCommunityAdminOrPlatformAdmin(currentUser, communityId);

        Community community = findCommunity(communityId);
        community.setName(payload.getName().trim());
        community.setDescription(payload.getDescription().trim());
        community.setLocation(payload.getLocation().trim());
        community.setCategory(payload.getCategory());
        community.setInstitutionDomain(payload.getInstitutionDomain());
        community.setJoinCode(payload.getJoinCode());
        return communityRepository.save(community);
    }

    public void deleteCommunity(String communityId, User currentUser) {
        requireCommunityAdminOrPlatformAdmin(currentUser, communityId);
        Community community = findCommunity(communityId);

        requestRepository.deleteByCommunityId(communityId);
        memberRepository.deleteByCommunityId(communityId);
        communityRepository.delete(community);
    }

    public Member joinCommunity(String communityId, User currentUser, String code) {
        if (currentUser == null) {
            throw new AccessDeniedException("Authentication is required");
        }
        
        // Ensure user is email verified if we have such a flag (assuming verified=true means email verified)
        // requireVerifiedUser(currentUser); 
        
        Community community = findCommunity(communityId);

        if (memberRepository.existsByUserIdAndCommunityId(currentUser.getId(), communityId)) {
            throw new IllegalArgumentException("User is already a member of this community");
        }

        boolean verifiedByDomain = false;
        boolean verifiedByCode = false;

        // Domain verification
        if (community.getInstitutionDomain() != null && !community.getInstitutionDomain().isBlank()) {
            String userEmail = currentUser.getEmail();
            if (userEmail != null && userEmail.toLowerCase().endsWith("@" + community.getInstitutionDomain().toLowerCase())) {
                verifiedByDomain = true;
            }
        }

        // Code verification
        if (community.getJoinCode() != null && !community.getJoinCode().isBlank()) {
            if (community.getJoinCode().equalsIgnoreCase(code)) {
                verifiedByCode = true;
            } else if (!verifiedByDomain) {
                // If code is provided but wrong, and domain didn't match, block immediately
                throw new IllegalArgumentException("Invalid join code for this community");
            }
        }

        // Final permission check: If community has restrictions, user must have passed at least one
        boolean hasRestrictions = (community.getInstitutionDomain() != null && !community.getInstitutionDomain().isBlank())
                || (community.getJoinCode() != null && !community.getJoinCode().isBlank());

        if (hasRestrictions && !verifiedByDomain && !verifiedByCode) {
            String message = "You do not have permission to join this community.";
            if (community.getInstitutionDomain() != null && !community.getInstitutionDomain().isBlank()) {
                message += " Valid institutional email (@" + community.getInstitutionDomain() + ") required.";
            } else {
                message += " Valid join code required.";
            }
            throw new IllegalArgumentException(message);
        }

        // Promote user if verified by either method
        if (verifiedByDomain || verifiedByCode) {
            if (currentUser.getVerificationLevel() == com.hvhn.backend.model.enums.VerificationLevel.BASIC) {
                currentUser.setVerificationLevel(com.hvhn.backend.model.enums.VerificationLevel.VERIFIED);
                userRepository.save(currentUser);
            }
        }

        Member member = memberRepository.save(new Member(currentUser.getId(), communityId, MemberRole.MEMBER));
        addMemberReference(community, currentUser.getId());
        return member;
    }

    public void leaveCommunity(String communityId, User currentUser) {
        if (currentUser == null) {
            throw new AccessDeniedException("Authentication is required");
        }

        Community community = findCommunity(communityId);
        Member membership = findMembership(currentUser.getId(), communityId);

        if (membership.getRole() == MemberRole.ADMIN
                && memberRepository.countByCommunityIdAndRole(communityId, MemberRole.ADMIN) <= 1) {
            throw new IllegalArgumentException("Assign another community admin before leaving");
        }

        memberRepository.delete(membership);
        removeMemberReference(community, currentUser.getId());
    }

    public boolean isMember(String communityId, String userId) {
        if (communityId == null || userId == null) return false;
        return memberRepository.existsByUserIdAndCommunityId(userId, communityId);
    }

    public List<Member> getMembers(String communityId) {
        findCommunity(communityId);
        return memberRepository.findByCommunityIdOrderByJoinedAtAsc(communityId);
    }

    public Member updateMemberRole(String communityId,
                                   String memberId,
                                   MemberRoleUpdateRequest payload,
                                   User currentUser) {
        findCommunity(communityId);
        requireCommunityAdminOrPlatformAdmin(currentUser, communityId);

        Member member = memberRepository.findByIdAndCommunityId(memberId, communityId)
                .orElseThrow(() -> new NoSuchElementException("Member not found"));

        if (member.getRole() == MemberRole.ADMIN
                && payload.getRole() != MemberRole.ADMIN
                && memberRepository.countByCommunityIdAndRole(communityId, MemberRole.ADMIN) <= 1) {
            throw new IllegalArgumentException("A community must have at least one admin");
        }

        member.setRole(payload.getRole());
        return memberRepository.save(member);
    }

    public void removeMember(String communityId, String memberId, User currentUser) {
        findCommunity(communityId);
        requireCommunityAdminOrPlatformAdmin(currentUser, communityId);

        Member member = memberRepository.findByIdAndCommunityId(memberId, communityId)
                .orElseThrow(() -> new NoSuchElementException("Member not found"));

        if (member.getRole() == MemberRole.ADMIN
                && memberRepository.countByCommunityIdAndRole(communityId, MemberRole.ADMIN) <= 1) {
            throw new IllegalArgumentException("Cannot remove the last community admin");
        }

        memberRepository.delete(member);
        removeMemberReference(findCommunity(communityId), member.getUserId());
    }

    public void broadcastMessage(String communityId, String content, User currentUser) {
        Community community = findCommunity(communityId);
        requireCommunityAdminOrPlatformAdmin(currentUser, communityId);

        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("Broadcast content cannot be empty");
        }

        List<Member> members = memberRepository.findByCommunityIdOrderByJoinedAtAsc(communityId);
        Map<String, Object> broadcastData = new HashMap<>();
        broadcastData.put("type", "BROADCAST");
        broadcastData.put("communityId", communityId);
        broadcastData.put("communityName", community.getName());
        broadcastData.put("content", content.trim());
        broadcastData.put("timestamp", java.time.LocalDateTime.now().toString());

        for (Member member : members) {
            messagingTemplate.convertAndSend("/topic/rooms/" + member.getUserId(), broadcastData);
        }
    }


    public List<Request> getRequests(String communityId,
                                     RequestUrgency urgency,
                                     RequestStatus status,
                                     String location,
                                     String search) {
        findCommunity(communityId);
        String normalizedLocation = normalize(location);
        String normalizedSearch = normalize(search);

        return requestRepository.findByCommunityIdOrderByCreatedAtDesc(communityId)
                .stream()
                .filter(request -> urgency == null || request.getUrgency() == urgency)
                .filter(request -> status == null || request.getStatus() == status)
                .filter(request -> normalizedLocation == null
                        || normalize(request.getLocation()).contains(normalizedLocation))
                .filter(request -> normalizedSearch == null
                        || normalize(request.getTitle()).contains(normalizedSearch)
                        || normalize(request.getDescription()).contains(normalizedSearch))
                .toList();
    }

    public Request createRequest(String communityId,
                                 CommunityRequestCreateRequest payload,
                                 User currentUser) {
        findCommunity(communityId);
        requireMemberOrPlatformAdmin(currentUser, communityId);

        Request request = new Request();
        request.setCommunityId(communityId);
        request.setTitle(payload.getTitle().trim());
        request.setDescription(payload.getDescription().trim());
        request.setLocation(payload.getLocation().trim());
        request.setUrgency(payload.getUrgency());
        request.setStatus(RequestStatus.PENDING);
        request.setRequestedBy(currentUser.getId());
        return requestRepository.save(request);
    }

    public Request updateRequest(String requestId,
                                 CommunityRequestUpdateRequest payload,
                                 User currentUser) {
        Request request = findRequest(requestId);
        if (!canUpdateRequest(currentUser, request)) {
            throw new AccessDeniedException("You are not allowed to update this request");
        }

        boolean hasDescription = payload.getDescription() != null && !payload.getDescription().trim().isEmpty();
        if (!hasDescription && payload.getStatus() == null) {
            throw new IllegalArgumentException("Provide a description or status to update");
        }

        if (hasDescription) {
            request.setDescription(payload.getDescription().trim());
        }
        if (payload.getStatus() != null) {
            request.setStatus(payload.getStatus());
        }

        return requestRepository.save(request);
    }

    public void deleteRequest(String requestId, User currentUser) {
        Request request = findRequest(requestId);
        requireCommunityAdminOrPlatformAdmin(currentUser, request.getCommunityId());
        requestRepository.delete(request);
    }

    public java.util.Optional<User> getUserById(String userId) {
        return userRepository.findById(userId);
    }

    private Community findCommunity(String communityId) {
        return communityRepository.findById(communityId)
                .orElseThrow(() -> new NoSuchElementException("Community not found"));
    }

    private Request findRequest(String requestId) {
        return requestRepository.findById(requestId)
                .orElseThrow(() -> new NoSuchElementException("Request not found"));
    }

    private Member findMembership(String userId, String communityId) {
        return memberRepository.findByUserIdAndCommunityId(userId, communityId)
                .orElseThrow(() -> new NoSuchElementException("Membership not found"));
    }

    private boolean canUpdateRequest(User currentUser, Request request) {
        return currentUser != null
                && (isPlatformAdmin(currentUser)
                || request.getRequestedBy().equals(currentUser.getId())
                || isCommunityAdmin(currentUser, request.getCommunityId()));
    }

    private void requireCommunityAdminOrPlatformAdmin(User currentUser, String communityId) {
        if (currentUser == null || (!isPlatformAdmin(currentUser) && !isCommunityAdmin(currentUser, communityId))) {
            throw new AccessDeniedException("Community admin access is required");
        }
    }

    private void requireMemberOrPlatformAdmin(User currentUser, String communityId) {
        if (currentUser == null) {
            throw new AccessDeniedException("Authentication is required");
        }

        if (!isPlatformAdmin(currentUser) && !memberRepository.existsByUserIdAndCommunityId(currentUser.getId(), communityId)) {
            throw new AccessDeniedException("Join the community before creating requests");
        }
    }

    private void requirePlatformAdmin(User currentUser) {
        if (!isPlatformAdmin(currentUser)) {
            throw new AccessDeniedException("Platform admin access is required");
        }
    }

    private void requireVerifiedUser(User currentUser) {
        if (currentUser == null) {
            throw new AccessDeniedException("Authentication is required");
        }
        if (!currentUser.isVerified()) {
            throw new AccessDeniedException("Only verified users can join communities");
        }
    }

    private boolean isPlatformAdmin(User user) {
        return user != null && "ADMIN".equalsIgnoreCase(user.getRole());
    }

    private boolean isCommunityAdmin(User user, String communityId) {
        if (user == null) {
            return false;
        }

        return memberRepository.findByUserIdAndCommunityId(user.getId(), communityId)
                .map(member -> member.getRole() == MemberRole.ADMIN)
                .orElse(false);
    }

    private void addMemberReference(Community community, String userId) {
        List<String> userIds = new ArrayList<>(community.getMemberIds());
        userIds.add(userId);
        community.setMemberIds(userIds);
        communityRepository.save(community);
    }

    private void removeMemberReference(Community community, String userId) {
        List<String> userIds = new ArrayList<>(community.getMemberIds());
        userIds.remove(userId);
        community.setMemberIds(userIds);
        communityRepository.save(community);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
