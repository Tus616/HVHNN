package com.hvhn.backend;

import com.hvhn.backend.dto.CommunityRequestCreateRequest;
import com.hvhn.backend.dto.CommunityMigrationReport;
import com.hvhn.backend.dto.CommunityUpsertRequest;
import com.hvhn.backend.dto.ChatRoomView;
import com.hvhn.backend.dto.MemberRoleUpdateRequest;
import com.hvhn.backend.controller.CommunityController;
import com.hvhn.backend.model.*;
import com.hvhn.backend.model.enums.ChatRoomType;
import com.hvhn.backend.model.enums.CommunityCategory;
import com.hvhn.backend.model.enums.MemberRole;
import com.hvhn.backend.model.enums.RequestUrgency;
import com.hvhn.backend.repository.*;
import com.hvhn.backend.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class CommunityPhase4IntegrationTest {

    @Autowired CommunityService communityService;
    @Autowired CommunityController communityController;
    @Autowired CommunityMigrationService communityMigrationService;
    @Autowired CommunityQuestionService questionService;
    @Autowired CommunityCampaignService campaignService;
    @Autowired AnnouncementService announcementService;
    @Autowired CommunityRepository communityRepository;
    @Autowired MemberRepository memberRepository;
    @Autowired HelpRequestRepository helpRequestRepository;
    @Autowired CommunityQuestionRepository questionRepository;
    @Autowired CommunityAnswerRepository answerRepository;
    @Autowired CommunityCampaignRepository campaignRepository;
    @Autowired CommunityContributionRepository contributionRepository;
    @Autowired AnnouncementRepository announcementRepository;
    @Autowired ChatRoomRepository chatRoomRepository;
    @Autowired ChatMessageRepository chatMessageRepository;
    @Autowired ChatRoomStateRepository chatRoomStateRepository;
    @Autowired UserRepository userRepository;
    @Autowired MongoTemplate mongoTemplate;

    User owner;
    User adminCandidate;
    User moderatorCandidate;
    User member;
    User outsider;

    @BeforeEach
    void resetData() {
        guardTestDatabase();
        mongoTemplate.dropCollection(Community.class);
        mongoTemplate.dropCollection(Member.class);
        mongoTemplate.dropCollection(HelpRequest.class);
        mongoTemplate.dropCollection(CommunityQuestion.class);
        mongoTemplate.dropCollection(CommunityAnswer.class);
        mongoTemplate.dropCollection(CommunityVote.class);
        mongoTemplate.dropCollection(CommunityCampaign.class);
        mongoTemplate.dropCollection(CommunityContribution.class);
        mongoTemplate.dropCollection(Announcement.class);
        mongoTemplate.dropCollection(ChatRoom.class);
        mongoTemplate.dropCollection(ChatMessage.class);
        mongoTemplate.dropCollection(ChatRoomState.class);
        mongoTemplate.dropCollection(User.class);
        owner = saveUser("owner@hvhn.test", "Owner");
        adminCandidate = saveUser("admin@hvhn.test", "Admin Candidate");
        moderatorCandidate = saveUser("mod@hvhn.test", "Moderator Candidate");
        member = saveUser("member@hvhn.test", "Member");
        outsider = saveUser("outsider@hvhn.test", "Outsider");
    }

    @Test
    void completeCommunityPlatformSmokeFlow() {
        Community community = communityService.createCommunity(openCommunity("Phase Four Community"), owner);
        assertThat(community.getOwnerUserId()).isEqualTo(owner.getId());
        assertThat(memberRepository.findByUserIdAndCommunityId(owner.getId(), community.getId()))
                .get().extracting(Member::getRole).isEqualTo(MemberRole.OWNER);
        assertThat(communityService.getMemberCount(community.getId())).isEqualTo(1);

        Member joined = communityService.joinCommunity(community.getId(), member, null);
        assertThat(joined.getStatus()).isEqualTo("ACTIVE");
        assertThatThrownBy(() -> communityService.joinCommunity(community.getId(), member, null))
                .isInstanceOf(ResponseStatusException.class);

        Member adminJoined = communityService.joinCommunity(community.getId(), adminCandidate, null);
        Member modJoined = communityService.joinCommunity(community.getId(), moderatorCandidate, null);
        MemberRoleUpdateRequest adminRole = new MemberRoleUpdateRequest();
        adminRole.setRole(MemberRole.ADMIN);
        communityService.updateMemberRole(community.getId(), adminJoined.getId(), adminRole, owner);
        MemberRoleUpdateRequest modRole = new MemberRoleUpdateRequest();
        modRole.setRole(MemberRole.MODERATOR);
        communityService.updateMemberRole(community.getId(), modJoined.getId(), modRole, adminCandidate);

        assertThatThrownBy(() -> communityService.dashboard(community.getId(), outsider))
                .isInstanceOf(ResponseStatusException.class);

        CommunityRequestCreateRequest requestPayload = new CommunityRequestCreateRequest();
        requestPayload.setTitle("Need community grocery support");
        requestPayload.setDescription("Need help arranging groceries for an elderly family today.");
        requestPayload.setLocation("Community gate");
        requestPayload.setUrgency(RequestUrgency.HIGH);
        HelpRequest communityRequest = communityService.createUnifiedRequest(community.getId(), requestPayload, member);
        assertThat(communityRequest.getCommunityId()).isEqualTo(community.getId());
        assertThat(communityRequest.getScope()).isEqualTo("COMMUNITY");
        assertThat(communityService.getUnifiedRequests(community.getId(), member)).extracting(HelpRequest::getId).contains(communityRequest.getId());

        Community other = communityService.createCommunity(openCommunity("Other Phase Four Community"), owner);
        assertThat(communityService.getUnifiedRequests(other.getId(), owner)).extracting(HelpRequest::getId).doesNotContain(communityRequest.getId());

        CommunityQuestion question = questionService.createQuestion(community.getId(), Map.of(
                "title", "Where can we coordinate supplies?",
                "body", "Please suggest a reliable pickup location.",
                "tags", List.of("supplies")), member);
        CommunityAnswer answer = questionService.createAnswer(community.getId(), question.getId(), Map.of("body", "Use the main gate desk."), adminCandidate);
        assertThat(questionService.acceptAnswer(community.getId(), question.getId(), answer.getId(), member).isAccepted()).isTrue();
        questionService.upvoteQuestion(community.getId(), question.getId(), owner);
        assertThatThrownBy(() -> questionService.upvoteQuestion(community.getId(), question.getId(), owner))
                .isInstanceOf(ResponseStatusException.class);

        CommunityCampaign campaign = campaignService.createCampaign(community.getId(), Map.of(
                "title", "Medicine support drive",
                "story", "Collect verified medicine pledges for residents.",
                "category", "MEDICAL_AID",
                "targetType", "MONEY_PLEDGE",
                "targetAmount", "1000"), adminCandidate);
        campaignService.contribute(community.getId(), campaign.getId(), Map.of("type", "MONEY_PLEDGE", "amount", "250", "note", "External pledge"), member);
        CommunityCampaign updatedCampaign = campaignRepository.findById(campaign.getId()).orElseThrow();
        assertThat(updatedCampaign.getContributionCount()).isEqualTo(1);
        assertThat(updatedCampaign.getCollectedAmount()).isEqualByComparingTo("250");

        Announcement announcement = new Announcement();
        announcement.setTitle("Supply desk open");
        announcement.setBody("The desk is open from 5 PM.");
        announcementService.createAnnouncement(community.getId(), announcement, adminCandidate);

        Map<String, Object> dashboard = communityService.dashboard(community.getId(), member);
        assertThat(dashboard).containsEntry("memberCount", 4L);
        assertThat(dashboard).containsEntry("activeRequestCount", 1L);
        assertThat(dashboard).containsEntry("openQuestionCount", 0L);
        assertThat(dashboard).containsEntry("activeCampaignCount", 1L);

        communityService.leaveCommunity(community.getId(), member);
        assertThat(communityService.getMemberCount(community.getId())).isEqualTo(3);
        assertThatThrownBy(() -> communityService.leaveCommunity(community.getId(), owner))
                .isInstanceOf(ResponseStatusException.class);

        communityService.transferOwnership(community.getId(), adminCandidate.getId(), owner);
        assertThat(communityRepository.findById(community.getId()).orElseThrow().getOwnerUserId()).isEqualTo(adminCandidate.getId());
        assertThat(memberRepository.findByCommunityIdAndStatusOrderByJoinedAtAsc(community.getId(), "ACTIVE")
                .stream().filter(m -> m.getRole() == MemberRole.OWNER).count()).isEqualTo(1);
    }

    @Test
    void joinPoliciesAreDeterministic() {
        Community joinCode = communityService.createCommunity(joinCodeCommunity(), owner);
        assertThatThrownBy(() -> communityService.joinCommunity(joinCode.getId(), member, "wrong"))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(communityService.joinCommunity(joinCode.getId(), member, "secret-join").getStatus()).isEqualTo("ACTIVE");

        User domainUser = saveUser("student@example.edu", "Student");
        Community domain = communityService.createCommunity(domainCommunity(), owner);
        assertThat(communityService.joinCommunity(domain.getId(), domainUser, null).getStatus()).isEqualTo("ACTIVE");
        assertThatThrownBy(() -> communityService.joinCommunity(domain.getId(), outsider, null))
                .isInstanceOf(ResponseStatusException.class);

        Community approval = communityService.createCommunity(approvalCommunity(), owner);
        assertThat(communityService.joinCommunity(approval.getId(), outsider, null).getStatus()).isEqualTo("PENDING");
    }

    @Test
    void migrationDryRunAndExecutionAreSafeAndIdempotent() {
        Community legacy = new Community();
        legacy.setName("Legacy Phase Four Community");
        legacy.setDescription("Legacy community with missing canonical fields.");
        legacy.setCategory(CommunityCategory.RESIDENTIAL);
        legacy.setLocation("Old address field");
        legacy.setSlug(null);
        legacy.setStatus(null);
        legacy.setVisibility(null);
        legacy.setJoinPolicy(null);
        legacy.setMemberCount(99);
        legacy = communityRepository.save(legacy);

        Member legacyMember = new Member(owner.getId(), legacy.getId(), MemberRole.ADMIN);
        legacyMember.setStatus(null);
        memberRepository.save(legacyMember);

        CommunityMigrationReport dryRun = communityMigrationService.migrate(true);
        assertThat(dryRun.isDryRun()).isTrue();
        assertThat(dryRun.getCommunitiesScanned()).isGreaterThanOrEqualTo(1);
        assertThat(dryRun.getMigrated()).isGreaterThanOrEqualTo(1);
        assertThat(dryRun.getRepaired()).isGreaterThanOrEqualTo(1);
        Community afterDryRun = communityRepository.findById(legacy.getId()).orElseThrow();
        assertThat(afterDryRun.getSlug()).isNull();
        assertThat(afterDryRun.getMemberCount()).isEqualTo(99);

        CommunityMigrationReport executed = communityMigrationService.migrate(false);
        assertThat(executed.isDryRun()).isFalse();
        assertThat(executed.getMigrated()).isGreaterThanOrEqualTo(1);
        assertThat(executed.getRepaired()).isGreaterThanOrEqualTo(1);
        Community repaired = communityRepository.findById(legacy.getId()).orElseThrow();
        assertThat(repaired.getSlug()).isEqualTo("legacy-phase-four-community");
        assertThat(repaired.getStatus()).isEqualTo("ACTIVE");
        assertThat(repaired.getVisibility()).isEqualTo("PUBLIC");
        assertThat(repaired.getJoinPolicy()).isEqualTo("OPEN");
        assertThat(repaired.getMemberCount()).isEqualTo(1);
        assertThat(repaired.getOwnerUserId()).isEqualTo(owner.getId());
        assertThat(memberRepository.findByUserIdAndCommunityId(owner.getId(), legacy.getId()))
                .get().satisfies(membership -> {
                    assertThat(membership.getRole()).isEqualTo(MemberRole.OWNER);
                    assertThat(membership.getStatus()).isEqualTo("ACTIVE");
                });

        CommunityMigrationReport second = communityMigrationService.migrate(false);
        assertThat(second.getMigrated()).isZero();
        assertThat(second.getAlreadyValid()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void communityMemberMessageEntryReusesDirectRoomAndBlocksInvalidMemberships() {
        Community community = communityService.createCommunity(openCommunity("Community Chat Entry"), owner);
        Member memberA = communityService.joinCommunity(community.getId(), member, null);
        Member memberB = communityService.joinCommunity(community.getId(), adminCandidate, null);

        ChatRoomView first = (ChatRoomView) communityController.messageMember(community.getId(), memberB.getId(), member).getBody();
        ChatRoomView second = (ChatRoomView) communityController.messageMember(community.getId(), memberB.getUserId(), member).getBody();
        assertThat(first).isNotNull();
        assertThat(second).isNotNull();
        assertThat(second.getId()).isEqualTo(first.getId());

        List<ChatRoom> directRooms = directRoomsBetween(member.getId(), adminCandidate.getId());
        assertThat(directRooms).hasSize(1);
        assertThat(directRooms.get(0).getParticipantIds()).containsExactlyInAnyOrder(member.getId(), adminCandidate.getId());
        assertThat(directRooms.get(0).getParticipantIds()).doesNotContain(owner.getId());

        assertThatThrownBy(() -> communityController.messageMember(community.getId(), memberA.getId(), member))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> communityController.messageMember(community.getId(), memberB.getId(), outsider))
                .isInstanceOf(ResponseStatusException.class);

        communityService.leaveCommunity(community.getId(), member);
        assertThatThrownBy(() -> communityController.messageMember(community.getId(), memberB.getId(), member))
                .isInstanceOf(ResponseStatusException.class);

        Member rejoinedA = communityService.joinCommunity(community.getId(), member, null);
        communityService.removeMember(community.getId(), memberB.getId(), owner);
        assertThatThrownBy(() -> communityController.messageMember(community.getId(), memberB.getUserId(), member))
                .isInstanceOf(ResponseStatusException.class);

        Community other = communityService.createCommunity(openCommunity("Community Chat Other"), owner);
        Member otherOnly = communityService.joinCommunity(other.getId(), moderatorCandidate, null);
        assertThatThrownBy(() -> communityController.messageMember(community.getId(), otherOnly.getUserId(), member))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(rejoinedA.getStatus()).isEqualTo("ACTIVE");
    }

    private List<ChatRoom> directRoomsBetween(String firstUserId, String secondUserId) {
        return chatRoomRepository.findByTypeAndParticipantIdsContaining(ChatRoomType.DIRECT, firstUserId).stream()
                .filter(room -> room.getParticipantIds().size() == 2)
                .filter(room -> room.getParticipantIds().contains(secondUserId))
                .toList();
    }

    private CommunityUpsertRequest openCommunity(String name) {
        CommunityUpsertRequest dto = new CommunityUpsertRequest();
        dto.setName(name);
        dto.setDescription("A complete Phase 4 test community for verified help workflows.");
        dto.setCategory(CommunityCategory.RESIDENTIAL);
        dto.setVisibility("PUBLIC");
        dto.setJoinPolicy("OPEN");
        dto.setAddress("Test Block");
        dto.setCity("Delhi");
        dto.setDistrict("New Delhi");
        dto.setState("Delhi");
        dto.setTags(List.of("phase4", "test"));
        return dto;
    }

    private CommunityUpsertRequest joinCodeCommunity() {
        CommunityUpsertRequest dto = openCommunity("Join Code Community");
        dto.setJoinPolicy("JOIN_CODE");
        dto.setJoinCode("secret-join");
        return dto;
    }

    private CommunityUpsertRequest domainCommunity() {
        CommunityUpsertRequest dto = openCommunity("Domain Community");
        dto.setJoinPolicy("EMAIL_DOMAIN");
        dto.setInstitutionDomain("example.edu");
        return dto;
    }

    private CommunityUpsertRequest approvalCommunity() {
        CommunityUpsertRequest dto = openCommunity("Approval Community");
        dto.setJoinPolicy("APPROVAL_REQUIRED");
        return dto;
    }

    private User saveUser(String email, String name) {
        User user = new User(email, "password", name);
        user.setVerified(true);
        user.setAccountStatus("ACTIVE");
        return userRepository.save(user);
    }

    private void guardTestDatabase() {
        assertThat(mongoTemplate.getDb().getName()).contains("test");
    }
}
