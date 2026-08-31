package com.hvhn.backend.service;

import com.hvhn.backend.dto.CommunityRequestCreateRequest;
import com.hvhn.backend.dto.CommunityUpsertRequest;
import com.hvhn.backend.dto.HelpRequestDTO;
import com.hvhn.backend.dto.MemberRoleUpdateRequest;
import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.Member;
import com.hvhn.backend.model.Request;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.enums.CommunityCategory;
import com.hvhn.backend.model.enums.MemberRole;
import com.hvhn.backend.model.enums.RequestStatus;
import com.hvhn.backend.model.enums.RequestUrgency;
import com.hvhn.backend.repository.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class CommunityService {

    private static final Set<String> VISIBILITIES = Set.of("PUBLIC", "PRIVATE", "RESTRICTED");
    private static final Set<String> JOIN_POLICIES = Set.of("OPEN", "JOIN_CODE", "EMAIL_DOMAIN", "APPROVAL_REQUIRED", "INVITE_ONLY");
    private static final Pattern DOMAIN_PATTERN = Pattern.compile("^[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final CommunityRepository communityRepository;
    private final MemberRepository memberRepository;
    private final RequestRepository legacyRequestRepository;
    private final UserRepository userRepository;
    private final HelpRequestService helpRequestService;
    private final HelpRequestRepository helpRequestRepository;
    private final AnnouncementRepository announcementRepository;
    private final CommunityQuestionRepository questionRepository;
    private final CommunityCampaignRepository campaignRepository;
    private final CommunityPermissionService permissions;
    private final LocationService locationService;

    public CommunityService(CommunityRepository communityRepository,
                            MemberRepository memberRepository,
                            RequestRepository legacyRequestRepository,
                            UserRepository userRepository,
                            HelpRequestService helpRequestService,
                            HelpRequestRepository helpRequestRepository,
                            AnnouncementRepository announcementRepository,
                            CommunityQuestionRepository questionRepository,
                            CommunityCampaignRepository campaignRepository,
                            CommunityPermissionService permissions,
                            LocationService locationService) {
        this.communityRepository = communityRepository;
        this.memberRepository = memberRepository;
        this.legacyRequestRepository = legacyRequestRepository;
        this.userRepository = userRepository;
        this.helpRequestService = helpRequestService;
        this.helpRequestRepository = helpRequestRepository;
        this.announcementRepository = announcementRepository;
        this.questionRepository = questionRepository;
        this.campaignRepository = campaignRepository;
        this.permissions = permissions;
        this.locationService = locationService;
    }

    public List<Map<String, Object>> discover(Map<String, String> filters, User currentUser) {
        String query = normalize(filters.get("query"));
        String category = normalizeUpper(filters.get("category"));
        String city = normalize(filters.get("city"));
        String district = normalize(filters.get("district"));
        String state = normalize(filters.get("state"));
        String visibility = normalizeUpper(filters.get("visibility"));
        String joinPolicy = normalizeUpper(filters.get("joinPolicy"));
        int page = parseInt(filters.get("page"), 0, 0, 10_000);
        int limit = parseInt(filters.get("limit"), 25, 1, 100);

        return communityRepository.findByStatusOrderByCreatedAtDesc("ACTIVE").stream()
                .filter(c -> !"PRIVATE".equals(c.getVisibility()) || permissions.isActiveMember(currentUser, c.getId()))
                .filter(c -> category == null || category.equals(c.getCategory() == null ? null : c.getCategory().name()))
                .filter(c -> visibility == null || visibility.equals(c.getVisibility()))
                .filter(c -> joinPolicy == null || joinPolicy.equals(c.getJoinPolicy()))
                .filter(c -> city == null || city.equalsIgnoreCase(nullSafe(c.getCity())))
                .filter(c -> district == null || district.equalsIgnoreCase(nullSafe(c.getDistrict())))
                .filter(c -> state == null || state.equalsIgnoreCase(nullSafe(c.getState())))
                .filter(c -> query == null || searchable(c).contains(query))
                .skip((long) page * limit)
                .limit(limit)
                .map(c -> toCommunitySummary(c, currentUser))
                .toList();
    }

    public List<Community> getAllCommunities(CommunityCategory category) {
        return discover(Map.of("category", category == null ? "" : category.name()), null).stream()
                .map(row -> findCommunity(String.valueOf(row.get("id"))))
                .toList();
    }

    public Community getCommunity(String communityId) {
        return findCommunity(communityId);
    }

    public Map<String, Object> getCommunityDetail(String communityId, User currentUser) {
        Community community = findCommunity(communityId);
        if (!"ACTIVE".equals(community.getStatus()) && !Objects.equals(community.getOwnerUserId(), currentUser == null ? null : currentUser.getId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Community not found.");
        }
        if ("PRIVATE".equals(community.getVisibility()) && !permissions.isActiveMember(currentUser, communityId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Join this community to view details.");
        }
        return toCommunitySummary(community, currentUser);
    }

    public long getMemberCount(String communityId) {
        return memberRepository.countByCommunityIdAndStatus(communityId, "ACTIVE");
    }

    public long getRequestCount(String communityId) {
        return helpRequestService.getRequestsByCommunity(communityId).size();
    }

    public Community createCommunity(CommunityUpsertRequest payload, User currentUser) {
        permissions.requireAuthenticated(currentUser);
        validateCommunityPayload(payload);
        String slug = uniqueSlug(payload.getName());

        Community community = new Community();
        applyPayload(community, payload);
        community.setSlug(slug);
        community.setOwnerUserId(currentUser.getId());
        community.setStatus("ACTIVE");
        community.setMemberCount(1);
        community.setCreatedAt(LocalDateTime.now().withNano(0));

        try {
            Community saved = communityRepository.save(community);
            Member owner = new Member(currentUser.getId(), saved.getId(), MemberRole.OWNER);
            owner.setStatus("ACTIVE");
            owner.setApprovedBy(currentUser.getId());
            owner.setApprovedAt(LocalDateTime.now().withNano(0));
            memberRepository.save(owner);
            saved.setMemberIds(List.of(currentUser.getId()));
            saved.setMemberCount(1);
            return communityRepository.save(saved);
        } catch (DuplicateKeyException duplicate) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A community with this slug already exists.");
        }
    }

    public Community updateCommunity(String communityId, CommunityUpsertRequest payload, User currentUser) {
        permissions.requireAdmin(currentUser, communityId);
        Community community = findCommunity(communityId);
        validateCommunityPayload(payload);
        applyPayload(community, payload);
        return communityRepository.save(community);
    }

    public void deleteCommunity(String communityId, User currentUser) {
        permissions.requireOwner(currentUser, communityId);
        Community community = findCommunity(communityId);
        community.setStatus("ARCHIVED");
        communityRepository.save(community);
    }

    public Member joinCommunity(String communityId, User currentUser, String code) {
        permissions.requireAuthenticated(currentUser);
        Community community = findCommunity(communityId);
        permissions.requireActiveCommunity(community);

        Member existing = memberRepository.findByUserIdAndCommunityId(currentUser.getId(), communityId).orElse(null);
        if (existing != null) {
            if (existing.isBanned() || "BANNED".equals(existing.getStatus())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot join this community.");
            }
            if ("ACTIVE".equals(existing.getStatus()) || "PENDING".equals(existing.getStatus())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Membership already exists.");
            }
        }

        String nextStatus = switch (community.getJoinPolicy()) {
            case "OPEN" -> "ACTIVE";
            case "JOIN_CODE" -> {
                if (!Objects.equals(hash(code), community.getJoinCodeHash())) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Invalid join code.");
                }
                yield "ACTIVE";
            }
            case "EMAIL_DOMAIN" -> {
                String domain = emailDomain(currentUser.getEmail());
                if (!StringUtils.hasText(domain) || !domain.equalsIgnoreCase(community.getInstitutionDomain())) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Your authenticated email domain is not allowed.");
                }
                yield "ACTIVE";
            }
            case "APPROVAL_REQUIRED" -> "PENDING";
            case "INVITE_ONLY" -> throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This community is invite-only.");
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported join policy.");
        };

        Member member = existing == null ? new Member(currentUser.getId(), communityId, MemberRole.MEMBER) : existing;
        member.setRole(MemberRole.MEMBER);
        member.setStatus(nextStatus);
        member.setBanned(false);
        member.setBanReason(null);
        if ("ACTIVE".equals(nextStatus)) {
            member.setApprovedBy(currentUser.getId());
            member.setApprovedAt(LocalDateTime.now().withNano(0));
        }
        Member saved = memberRepository.save(member);
        reconcileMemberCount(communityId);
        return saved;
    }

    public void leaveCommunity(String communityId, User currentUser) {
        permissions.requireAuthenticated(currentUser);
        Community community = findCommunity(communityId);
        Member membership = activeMembership(currentUser.getId(), communityId);
        if (membership.getRole() == MemberRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Transfer ownership or archive the community before leaving.");
        }
        if (membership.getRole() == MemberRole.ADMIN
                && memberRepository.countByCommunityIdAndRoleAndStatus(communityId, MemberRole.ADMIN, "ACTIVE") == 1
                && memberRepository.countByCommunityIdAndRoleAndStatus(communityId, MemberRole.OWNER, "ACTIVE") == 0) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Assign another community admin before leaving.");
        }
        membership.setStatus("LEFT");
        membership.setRole(MemberRole.MEMBER);
        memberRepository.save(membership);
        removeMemberReference(community, currentUser.getId());
        reconcileMemberCount(communityId);
    }

    public Member approveMembership(String communityId, String memberId, User currentUser) {
        permissions.requireAdmin(currentUser, communityId);
        Member member = memberRepository.findByIdAndCommunityId(memberId, communityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership not found."));
        if (!"PENDING".equals(member.getStatus())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Only pending memberships can be approved.");
        }
        member.setStatus("ACTIVE");
        member.setApprovedBy(currentUser.getId());
        member.setApprovedAt(LocalDateTime.now().withNano(0));
        Member saved = memberRepository.save(member);
        reconcileMemberCount(communityId);
        return saved;
    }

    public Member rejectMembership(String communityId, String memberId, User currentUser) {
        permissions.requireAdmin(currentUser, communityId);
        Member member = memberRepository.findByIdAndCommunityId(memberId, communityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership not found."));
        member.setStatus("REJECTED");
        Member saved = memberRepository.save(member);
        reconcileMemberCount(communityId);
        return saved;
    }

    public Community transferOwnership(String communityId, String newOwnerUserId, User currentUser) {
        permissions.requireOwner(currentUser, communityId);
        Community community = findCommunity(communityId);
        Member oldOwner = activeMembership(currentUser.getId(), communityId);
        Member newOwner = activeMembership(newOwnerUserId, communityId);
        if (newOwner.isBanned()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Target member is banned.");
        }
        oldOwner.setRole(MemberRole.ADMIN);
        newOwner.setRole(MemberRole.OWNER);
        memberRepository.save(oldOwner);
        memberRepository.save(newOwner);
        community.setOwnerUserId(newOwnerUserId);
        return communityRepository.save(community);
    }

    public boolean isMember(String communityId, String userId) {
        return memberRepository.existsByUserIdAndCommunityIdAndStatus(userId, communityId, "ACTIVE");
    }

    public List<Member> getMembers(String communityId) {
        findCommunity(communityId);
        return memberRepository.findByCommunityIdAndStatusOrderByJoinedAtAsc(communityId, "ACTIVE").stream().limit(100).toList();
    }

    public List<Member> getMembers(String communityId, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        return getMembers(communityId);
    }

    public Member updateMemberRole(String communityId, String memberId, MemberRoleUpdateRequest payload, User currentUser) {
        permissions.requireAdmin(currentUser, communityId);
        Member actor = activeMembership(currentUser.getId(), communityId);
        Member member = memberRepository.findByIdAndCommunityId(memberId, communityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found."));
        if (payload.getRole() == MemberRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Use ownership transfer to assign owner.");
        }
        if (member.getRole() == MemberRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Owner role cannot be changed here.");
        }
        if (actor.getRole() != MemberRole.OWNER && payload.getRole() == MemberRole.ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only owners can assign admins.");
        }
        member.setRole(payload.getRole());
        return memberRepository.save(member);
    }

    public void removeMember(String communityId, String memberId, User currentUser) {
        permissions.requireAdmin(currentUser, communityId);
        Member member = memberRepository.findByIdAndCommunityId(memberId, communityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found."));
        if (member.getRole() == MemberRole.OWNER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Owner cannot be removed.");
        }
        member.setStatus("REMOVED");
        memberRepository.save(member);
        removeMemberReference(findCommunity(communityId), member.getUserId());
        reconcileMemberCount(communityId);
    }

    public Map<String, Object> dashboard(String communityId, User currentUser) {
        Community community = findCommunity(communityId);
        permissions.requireMember(currentUser, communityId);
        boolean admin = permissions.canAdmin(currentUser, communityId);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("community", toCommunitySummary(community, currentUser));
        response.put("membership", permissions.membership(currentUser, communityId).map(this::toMemberMap).orElse(null));
        response.put("memberCount", getMemberCount(communityId));
        response.put("activeRequestCount", helpRequestService.getRequestsByCommunity(communityId).stream()
                .filter(req -> Set.of("OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETION_REQUESTED").contains(req.getStatus()))
                .count());
        response.put("openQuestionCount", questionRepository.countByCommunityIdAndStatusAndDeletedAtIsNull(communityId, "OPEN"));
        response.put("activeCampaignCount", campaignRepository.countByCommunityIdAndStatus(communityId, "ACTIVE"));
        response.put("recentAnnouncements", announcementRepository.findByCommunityIdOrderByIsPinnedDescCreatedAtDesc(communityId).stream().limit(5).toList());
        response.put("permissions", Map.of(
                "canManage", admin,
                "canModerate", permissions.canModerate(currentUser, communityId),
                "canCreateContent", permissions.isActiveMember(currentUser, communityId)
        ));
        if (admin) {
            response.put("pendingJoinCount", memberRepository.countByCommunityIdAndStatus(communityId, "PENDING"));
            response.put("legacyCommunityRequestCount", legacyRequestRepository.countByCommunityId(communityId));
        }
        return response;
    }

    public List<HelpRequest> getUnifiedRequests(String communityId, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        return helpRequestService.getRequestsByCommunity(communityId);
    }

    public HelpRequest createUnifiedRequest(String communityId, CommunityRequestCreateRequest payload, User currentUser) {
        Community community = findCommunity(communityId);
        permissions.requireActiveCommunity(community);
        permissions.requireMember(currentUser, communityId);
        HelpRequestDTO dto = new HelpRequestDTO();
        dto.setCommunityId(communityId);
        dto.setTitle(payload.getTitle());
        dto.setDescription(payload.getDescription());
        dto.setAddress(payload.getLocation());
        dto.setUrgency(payload.getUrgency() == null ? "MEDIUM" : payload.getUrgency().name());
        dto.setCategory("GENERAL");
        return helpRequestService.createRequest(dto, currentUser);
    }

    public Request updateRequest(String requestId, com.hvhn.backend.dto.CommunityRequestUpdateRequest payload, User currentUser) {
        Request request = legacyRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Legacy community request not found."));
        if (!Objects.equals(request.getRequestedBy(), currentUser == null ? null : currentUser.getId())
                && !permissions.canModerate(currentUser, request.getCommunityId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot update this community request.");
        }
        if (StringUtils.hasText(payload.getDescription())) request.setDescription(payload.getDescription().trim());
        if (payload.getStatus() != null) request.setStatus(payload.getStatus());
        return legacyRequestRepository.save(request);
    }

    public void deleteRequest(String requestId, User currentUser) {
        Request request = legacyRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Legacy community request not found."));
        permissions.requireModerator(currentUser, request.getCommunityId());
        legacyRequestRepository.delete(request);
    }

    public void broadcastMessage(String communityId, String content, User currentUser) {
        permissions.requireAdmin(currentUser, communityId);
        if (!StringUtils.hasText(content)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Announcement content is required.");
        }
    }

    public List<Request> getRequests(String communityId, RequestUrgency urgency, RequestStatus status, String location, String search) {
        findCommunity(communityId);
        String normalizedLocation = normalize(location);
        String normalizedSearch = normalize(search);
        return legacyRequestRepository.findByCommunityIdOrderByCreatedAtDesc(communityId).stream()
                .filter(request -> urgency == null || request.getUrgency() == urgency)
                .filter(request -> status == null || request.getStatus() == status)
                .filter(request -> normalizedLocation == null || normalize(request.getLocation()).contains(normalizedLocation))
                .filter(request -> normalizedSearch == null || normalize(request.getTitle()).contains(normalizedSearch)
                        || normalize(request.getDescription()).contains(normalizedSearch))
                .toList();
    }

    public Optional<User> getUserById(String userId) {
        return userRepository.findById(userId);
    }

    public Map<String, Object> toCommunitySummary(Community community, User currentUser) {
        Optional<Member> membership = permissions.membership(currentUser, community.getId());
        boolean activeMember = membership.filter(m -> "ACTIVE".equals(m.getStatus())).isPresent();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", community.getId());
        response.put("name", community.getName());
        response.put("slug", community.getSlug());
        response.put("description", community.getDescription());
        response.put("category", community.getCategory() == null ? null : community.getCategory().name());
        response.put("visibility", community.getVisibility());
        response.put("joinPolicy", community.getJoinPolicy());
        response.put("address", firstText(community.getAddress(), community.getLocation()));
        response.put("location", firstText(community.getAddress(), community.getLocation()));
        response.put("city", community.getCity());
        response.put("district", community.getDistrict());
        response.put("state", community.getState());
        response.put("memberCount", getMemberCount(community.getId()));
        response.put("requestCount", getRequestCount(community.getId()));
        response.put("ownerUserId", community.getOwnerUserId());
        response.put("status", community.getStatus());
        response.put("coverImageUrl", community.getCoverImageUrl());
        response.put("logoUrl", community.getLogoUrl());
        response.put("rules", community.getRules());
        response.put("tags", community.getTags());
        response.put("membershipStatus", membership.map(Member::getStatus).orElse(null));
        response.put("currentUserRole", membership.map(Member::getRole).map(Enum::name).orElse(null));
        response.put("canJoin", currentUser != null && !activeMember && !"INVITE_ONLY".equals(community.getJoinPolicy()));
        response.put("approvalRequired", "APPROVAL_REQUIRED".equals(community.getJoinPolicy()));
        response.put("hasJoinCode", "JOIN_CODE".equals(community.getJoinPolicy()));
        response.put("institutionDomain", "EMAIL_DOMAIN".equals(community.getJoinPolicy()) ? community.getInstitutionDomain() : null);
        response.put("createdAt", community.getCreatedAt());
        response.put("updatedAt", community.getUpdatedAt());
        return response;
    }

    public Map<String, Object> toMemberMap(Member member) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", member.getId());
        response.put("userId", member.getUserId());
        response.put("communityId", member.getCommunityId());
        response.put("role", member.getRole() == null ? null : member.getRole().name());
        response.put("status", member.getStatus());
        response.put("joinedAt", member.getJoinedAt());
        userRepository.findById(member.getUserId()).ifPresent(user -> {
            response.put("fullName", user.getFullName());
            response.put("profileImage", user.getProfileImage());
            response.put("avatarUrl", user.getProfileImage());
            response.put("verificationLevel", user.getVerificationLevel() == null ? null : user.getVerificationLevel().name());
            response.put("isVolunteer", user.isVolunteer());
        });
        return response;
    }

    private void validateCommunityPayload(CommunityUpsertRequest payload) {
        if (payload == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required.");
        if (!StringUtils.hasText(payload.getName()) || payload.getName().trim().length() < 3 || payload.getName().length() > 80) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Community name must be 3 to 80 characters.");
        }
        if (!StringUtils.hasText(payload.getDescription()) || payload.getDescription().trim().length() < 10 || payload.getDescription().length() > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Description must be 10 to 1000 characters.");
        }
        if (payload.getCategory() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Category is required.");
        String visibility = normalizeEnum(payload.getVisibility(), "PUBLIC", VISIBILITIES, "visibility");
        String joinPolicy = normalizeEnum(payload.getJoinPolicy(), "OPEN", JOIN_POLICIES, "joinPolicy");
        if ("JOIN_CODE".equals(joinPolicy) && !StringUtils.hasText(payload.getJoinCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Join code is required for JOIN_CODE policy.");
        }
        if ("EMAIL_DOMAIN".equals(joinPolicy)) {
            String domain = normalizeDomain(payload.getInstitutionDomain());
            if (!StringUtils.hasText(domain)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Institution domain is required for EMAIL_DOMAIN policy.");
            }
        }
        if ("PRIVATE".equals(visibility) && "OPEN".equals(joinPolicy)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Private communities cannot use OPEN join policy.");
        }
        locationService.validateOptional(payload.getLatitude(), payload.getLongitude());
    }

    private void applyPayload(Community community, CommunityUpsertRequest payload) {
        community.setName(payload.getName().trim());
        community.setDescription(payload.getDescription().trim());
        community.setCategory(payload.getCategory());
        community.setVisibility(normalizeEnum(payload.getVisibility(), "PUBLIC", VISIBILITIES, "visibility"));
        community.setJoinPolicy(normalizeEnum(payload.getJoinPolicy(), "OPEN", JOIN_POLICIES, "joinPolicy"));
        community.setInstitutionDomain("EMAIL_DOMAIN".equals(community.getJoinPolicy()) ? normalizeDomain(payload.getInstitutionDomain()) : null);
        community.setJoinCodeHash("JOIN_CODE".equals(community.getJoinPolicy()) ? hash(payload.getJoinCode()) : null);
        community.setJoinCode(null);
        community.setAddress(firstText(payload.getAddress(), payload.getLocation()));
        community.setLocation(firstText(payload.getAddress(), payload.getLocation()));
        community.setCity(locationService.normalizeArea(payload.getCity()));
        community.setDistrict(locationService.normalizeArea(payload.getDistrict()));
        community.setState(locationService.normalizeArea(payload.getState()));
        community.setLatitude(payload.getLatitude());
        community.setLongitude(payload.getLongitude());
        community.setGeoLocation(locationService.point(payload.getLatitude(), payload.getLongitude()));
        community.setRules(payload.getRules() == null ? List.of() : payload.getRules().stream().map(String::trim).filter(StringUtils::hasText).limit(20).toList());
        community.setTags(payload.getTags() == null ? List.of() : payload.getTags().stream().map(String::trim).filter(StringUtils::hasText).limit(20).toList());
        community.setCoverImageUrl(payload.getCoverImageUrl());
        community.setLogoUrl(payload.getLogoUrl());
    }

    private Community findCommunity(String communityId) {
        return communityRepository.findById(communityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Community not found."));
    }

    private Member activeMembership(String userId, String communityId) {
        return memberRepository.findByUserIdAndCommunityId(userId, communityId)
                .filter(member -> "ACTIVE".equals(member.getStatus()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Active community membership is required."));
    }

    private void reconcileMemberCount(String communityId) {
        Community community = findCommunity(communityId);
        List<Member> active = memberRepository.findByCommunityIdAndStatusOrderByJoinedAtAsc(communityId, "ACTIVE");
        community.setMemberCount(active.size());
        community.setMemberIds(active.stream().map(Member::getUserId).toList());
        communityRepository.save(community);
    }

    private void removeMemberReference(Community community, String userId) {
        List<String> userIds = new ArrayList<>(community.getMemberIds());
        userIds.remove(userId);
        community.setMemberIds(userIds);
        communityRepository.save(community);
    }

    private String uniqueSlug(String name) {
        String base = slugify(name);
        String slug = base;
        int attempt = 2;
        while (communityRepository.existsBySlug(slug)) {
            slug = base + "-" + attempt++;
        }
        return slug;
    }

    private String slugify(String value) {
        String slug = value == null ? "community" : value.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return StringUtils.hasText(slug) ? slug : "community";
    }

    private String searchable(Community community) {
        return (nullSafe(community.getName()) + " " + nullSafe(community.getDescription()) + " " + String.join(" ", community.getTags()))
                .toLowerCase(Locale.ROOT);
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim().toLowerCase(Locale.ROOT) : null;
    }

    private String normalizeUpper(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : null;
    }

    private String normalizeEnum(String value, String fallback, Set<String> allowed, String field) {
        String normalized = StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : fallback;
        if (!allowed.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is invalid.");
        }
        return normalized;
    }

    private String normalizeDomain(String domain) {
        if (!StringUtils.hasText(domain)) return null;
        String normalized = domain.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("@")) normalized = normalized.substring(1);
        if (!DOMAIN_PATTERN.matcher(normalized).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Institution domain is invalid.");
        }
        return normalized;
    }

    private String emailDomain(String email) {
        if (!StringUtils.hasText(email) || !email.contains("@")) return null;
        return email.substring(email.lastIndexOf('@') + 1).toLowerCase(Locale.ROOT);
    }

    private String hash(String value) {
        if (!StringUtils.hasText(value)) return null;
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.trim().getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte b : digest) builder.append(String.format("%02x", b));
            return builder.toString();
        } catch (Exception exception) {
            throw new IllegalStateException("Could not hash join code");
        }
    }

    private String firstText(String first, String second) {
        return StringUtils.hasText(first) ? first.trim() : StringUtils.hasText(second) ? second.trim() : null;
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private int parseInt(String value, int fallback, int min, int max) {
        if (!StringUtils.hasText(value)) return fallback;
        try {
            int parsed = Integer.parseInt(value);
            return Math.max(min, Math.min(max, parsed));
        } catch (NumberFormatException exception) {
            return fallback;
        }
    }
}
