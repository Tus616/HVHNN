package com.hvhn.backend.controller;

import com.hvhn.backend.dto.CommunityRequestCreateRequest;
import com.hvhn.backend.dto.CommunityUpsertRequest;
import com.hvhn.backend.dto.DirectChatRoomRequest;
import com.hvhn.backend.dto.MemberRoleUpdateRequest;
import com.hvhn.backend.model.*;
import com.hvhn.backend.service.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/communities", "/communities"})
public class CommunityController {

    private final CommunityService communityService;
    private final CommunityQuestionService questionService;
    private final CommunityCampaignService campaignService;
    private final AnnouncementService announcementService;
    private final ChatService chatService;
    private final RequestViewMapper requestViewMapper;
    private final CommunityPermissionService permissions;

    public CommunityController(CommunityService communityService,
                               CommunityQuestionService questionService,
                               CommunityCampaignService campaignService,
                               AnnouncementService announcementService,
                               ChatService chatService,
                               RequestViewMapper requestViewMapper,
                               CommunityPermissionService permissions) {
        this.communityService = communityService;
        this.questionService = questionService;
        this.campaignService = campaignService;
        this.announcementService = announcementService;
        this.chatService = chatService;
        this.requestViewMapper = requestViewMapper;
        this.permissions = permissions;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listCommunities(
            @RequestParam Map<String, String> filters,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(communityService.discover(filters, currentUser));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createCommunity(
            @Valid @RequestBody CommunityUpsertRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        Community community = communityService.createCommunity(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(communityService.toCommunitySummary(community, currentUser));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getCommunity(
            @PathVariable String id,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(communityService.getCommunityDetail(id, currentUser));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> updateCommunity(
            @PathVariable String id,
            @Valid @RequestBody CommunityUpsertRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        Community community = communityService.updateCommunity(id, request, currentUser);
        return ResponseEntity.ok(communityService.toCommunitySummary(community, currentUser));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> archiveCommunity(@PathVariable String id, @AuthenticationPrincipal User currentUser) {
        communityService.deleteCommunity(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<Map<String, Object>> joinCommunity(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, String> payload,
            @AuthenticationPrincipal User currentUser
    ) {
        String code = payload == null ? null : payload.get("code");
        return ResponseEntity.ok(communityService.toMemberMap(communityService.joinCommunity(id, currentUser, code)));
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<Map<String, String>> leaveCommunity(@PathVariable String id, @AuthenticationPrincipal User currentUser) {
        communityService.leaveCommunity(id, currentUser);
        return ResponseEntity.ok(Map.of("message", "Left community successfully."));
    }

    @PostMapping("/{id}/ownership/transfer")
    public ResponseEntity<Map<String, Object>> transferOwnership(
            @PathVariable String id,
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal User currentUser
    ) {
        Community community = communityService.transferOwnership(id, payload.get("newOwnerUserId"), currentUser);
        return ResponseEntity.ok(communityService.toCommunitySummary(community, currentUser));
    }

    @GetMapping("/{id}/dashboard")
    public ResponseEntity<Map<String, Object>> dashboard(@PathVariable String id, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(communityService.dashboard(id, currentUser));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<List<Map<String, Object>>> members(@PathVariable String id, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(communityService.getMembers(id, currentUser).stream().map(communityService::toMemberMap).toList());
    }

    @PutMapping("/{id}/members/{memberId}/role")
    public ResponseEntity<Map<String, Object>> updateMemberRole(
            @PathVariable String id,
            @PathVariable String memberId,
            @RequestBody MemberRoleUpdateRequest payload,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.ok(communityService.toMemberMap(communityService.updateMemberRole(id, memberId, payload, currentUser)));
    }

    @PostMapping("/{id}/members/{memberId}/approve")
    public ResponseEntity<Map<String, Object>> approveMember(@PathVariable String id, @PathVariable String memberId, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(communityService.toMemberMap(communityService.approveMembership(id, memberId, currentUser)));
    }

    @PostMapping("/{id}/members/{memberId}/reject")
    public ResponseEntity<Map<String, Object>> rejectMember(@PathVariable String id, @PathVariable String memberId, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(communityService.toMemberMap(communityService.rejectMembership(id, memberId, currentUser)));
    }

    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<Void> removeMember(@PathVariable String id, @PathVariable String memberId, @AuthenticationPrincipal User currentUser) {
        communityService.removeMember(id, memberId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/members/{memberId}/message")
    public ResponseEntity<?> messageMember(@PathVariable String id, @PathVariable String memberId, @AuthenticationPrincipal User currentUser) {
        permissions.requireMember(currentUser, id);
        Member target = communityService.getMembers(id, currentUser).stream()
                .filter(member -> member.getId().equals(memberId) || member.getUserId().equals(memberId))
                .findFirst()
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found."));
        DirectChatRoomRequest request = new DirectChatRoomRequest();
        request.setParticipantId(target.getUserId());
        return ResponseEntity.ok(chatService.createOrGetDirectRoom(currentUser, request));
    }

    @GetMapping("/{id}/requests")
    public ResponseEntity<List<Map<String, Object>>> communityRequests(@PathVariable String id, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(communityService.getUnifiedRequests(id, currentUser).stream().map(requestViewMapper::toRequestMap).toList());
    }

    @PostMapping("/{id}/requests")
    public ResponseEntity<Map<String, Object>> createCommunityRequest(
            @PathVariable String id,
            @Valid @RequestBody CommunityRequestCreateRequest request,
            @AuthenticationPrincipal User currentUser
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(requestViewMapper.toRequestMap(communityService.createUnifiedRequest(id, request, currentUser)));
    }

    @GetMapping("/{id}/legacy-requests/report")
    public ResponseEntity<Map<String, Object>> legacyRequestReport(@PathVariable String id, @AuthenticationPrincipal User currentUser) {
        permissions.requireAdmin(currentUser, id);
        return ResponseEntity.ok(Map.of("communityId", id, "legacyCommunityRequestCount", communityService.getRequests(id, null, null, null, null).size()));
    }

    @GetMapping("/{id}/questions")
    public ResponseEntity<List<CommunityQuestion>> questions(@PathVariable String id, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(questionService.listQuestions(id, currentUser));
    }

    @PostMapping("/{id}/questions")
    public ResponseEntity<CommunityQuestion> createQuestion(@PathVariable String id, @RequestBody Map<String, Object> payload, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(questionService.createQuestion(id, payload, currentUser));
    }

    @GetMapping("/{id}/questions/{questionId}")
    public ResponseEntity<Map<String, Object>> questionDetail(@PathVariable String id, @PathVariable String questionId, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(questionService.getQuestion(id, questionId, currentUser));
    }

    @DeleteMapping("/{id}/questions/{questionId}")
    public ResponseEntity<Void> deleteQuestion(@PathVariable String id, @PathVariable String questionId, @AuthenticationPrincipal User currentUser) {
        questionService.deleteQuestion(id, questionId, currentUser);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/questions/{questionId}/answers")
    public ResponseEntity<CommunityAnswer> createAnswer(@PathVariable String id, @PathVariable String questionId, @RequestBody Map<String, String> payload, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(questionService.createAnswer(id, questionId, payload, currentUser));
    }

    @PostMapping("/{id}/questions/{questionId}/upvote")
    public ResponseEntity<CommunityQuestion> upvoteQuestion(@PathVariable String id, @PathVariable String questionId, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(questionService.upvoteQuestion(id, questionId, currentUser));
    }

    @DeleteMapping("/{id}/questions/{questionId}/upvote")
    public ResponseEntity<CommunityQuestion> removeQuestionVote(@PathVariable String id, @PathVariable String questionId, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(questionService.removeQuestionVote(id, questionId, currentUser));
    }

    @PostMapping("/{id}/questions/{questionId}/answers/{answerId}/upvote")
    public ResponseEntity<CommunityAnswer> upvoteAnswer(@PathVariable String id, @PathVariable String questionId, @PathVariable String answerId, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(questionService.upvoteAnswer(id, questionId, answerId, currentUser));
    }

    @DeleteMapping("/{id}/questions/{questionId}/answers/{answerId}/upvote")
    public ResponseEntity<CommunityAnswer> removeAnswerVote(@PathVariable String id, @PathVariable String questionId, @PathVariable String answerId, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(questionService.removeAnswerVote(id, questionId, answerId, currentUser));
    }

    @PostMapping("/{id}/questions/{questionId}/answers/{answerId}/accept")
    public ResponseEntity<CommunityAnswer> acceptAnswer(@PathVariable String id, @PathVariable String questionId, @PathVariable String answerId, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(questionService.acceptAnswer(id, questionId, answerId, currentUser));
    }

    @GetMapping("/{id}/campaigns")
    public ResponseEntity<List<CommunityCampaign>> campaigns(@PathVariable String id, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(campaignService.listCampaigns(id, currentUser));
    }

    @PostMapping("/{id}/campaigns")
    public ResponseEntity<CommunityCampaign> createCampaign(@PathVariable String id, @RequestBody Map<String, Object> payload, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(campaignService.createCampaign(id, payload, currentUser));
    }

    @PostMapping("/{id}/campaigns/{campaignId}/contributions")
    public ResponseEntity<CommunityContribution> contribute(@PathVariable String id, @PathVariable String campaignId, @RequestBody Map<String, Object> payload, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(campaignService.contribute(id, campaignId, payload, currentUser));
    }

    @PutMapping("/{id}/campaigns/{campaignId}/moderation")
    public ResponseEntity<CommunityCampaign> moderateCampaign(@PathVariable String id, @PathVariable String campaignId, @RequestBody Map<String, String> payload, @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(campaignService.moderateCampaign(id, campaignId, payload, currentUser));
    }

    @GetMapping("/{id}/announcements")
    public ResponseEntity<List<Announcement>> announcements(@PathVariable String id, @AuthenticationPrincipal User currentUser) {
        permissions.requireMember(currentUser, id);
        return ResponseEntity.ok(announcementService.getAnnouncements(id));
    }

    @PostMapping("/{id}/announcements")
    public ResponseEntity<Announcement> createAnnouncement(@PathVariable String id, @RequestBody Announcement announcement, @AuthenticationPrincipal User currentUser) {
        permissions.requireAdmin(currentUser, id);
        return ResponseEntity.status(HttpStatus.CREATED).body(announcementService.createAnnouncement(id, announcement, currentUser));
    }

    @DeleteMapping("/{id}/announcements/{announcementId}")
    public ResponseEntity<Void> deleteAnnouncement(@PathVariable String id, @PathVariable String announcementId, @AuthenticationPrincipal User currentUser) {
        permissions.requireAdmin(currentUser, id);
        announcementService.deleteAnnouncement(id, announcementId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/announcements/{announcementId}/pin")
    public ResponseEntity<Announcement> togglePin(@PathVariable String id, @PathVariable String announcementId, @AuthenticationPrincipal User currentUser) {
        permissions.requireAdmin(currentUser, id);
        return ResponseEntity.ok(announcementService.togglePin(id, announcementId));
    }

    @PostMapping("/{id}/broadcast")
    public ResponseEntity<Announcement> broadcast(@PathVariable String id, @RequestBody Map<String, String> payload, @AuthenticationPrincipal User currentUser) {
        permissions.requireAdmin(currentUser, id);
        Announcement announcement = new Announcement();
        announcement.setTitle(payload.getOrDefault("title", "Community Announcement"));
        announcement.setBody(payload.getOrDefault("content", payload.getOrDefault("body", "")));
        return ResponseEntity.status(HttpStatus.CREATED).body(announcementService.createAnnouncement(id, announcement, currentUser));
    }
}
