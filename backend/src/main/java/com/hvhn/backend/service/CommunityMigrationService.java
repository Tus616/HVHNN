package com.hvhn.backend.service;

import com.hvhn.backend.dto.CommunityMigrationReport;
import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.Member;
import com.hvhn.backend.model.enums.MemberRole;
import com.hvhn.backend.repository.CommunityRepository;
import com.hvhn.backend.repository.MemberRepository;
import com.hvhn.backend.repository.RequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class CommunityMigrationService {

    private final CommunityRepository communityRepository;
    private final MemberRepository memberRepository;
    private final RequestRepository legacyRequestRepository;

    public CommunityMigrationService(CommunityRepository communityRepository,
                                     MemberRepository memberRepository,
                                     RequestRepository legacyRequestRepository) {
        this.communityRepository = communityRepository;
        this.memberRepository = memberRepository;
        this.legacyRequestRepository = legacyRequestRepository;
    }

    public CommunityMigrationReport migrate(boolean dryRun) {
        CommunityMigrationReport report = new CommunityMigrationReport();
        report.setDryRun(dryRun);
        report.setLegacyCommunityRequests(legacyRequestRepository.count());
        for (Community community : communityRepository.findAll()) {
            report.incCommunitiesScanned();
            boolean changed = false;
            if (!StringUtils.hasText(community.getSlug())) {
                community.setSlug(slugify(community.getName()));
                changed = true;
            }
            if (!StringUtils.hasText(community.getStatus())) {
                community.setStatus("ACTIVE");
                changed = true;
            }
            if (!StringUtils.hasText(community.getVisibility())) {
                community.setVisibility("PUBLIC");
                changed = true;
            }
            if (!StringUtils.hasText(community.getJoinPolicy())) {
                community.setJoinPolicy(StringUtils.hasText(community.getJoinCode()) ? "JOIN_CODE" : "OPEN");
                changed = true;
            }
            List<Member> memberships = memberRepository.findByCommunityIdOrderByJoinedAtAsc(community.getId());
            memberships.forEach(member -> report.incMembershipsScanned());
            Set<String> seenUsers = new HashSet<>();
            for (Member member : memberships) {
                if (!seenUsers.add(member.getUserId())) report.incDuplicate();
                if (!StringUtils.hasText(member.getStatus())) {
                    member.setStatus("ACTIVE");
                    if (!dryRun) memberRepository.save(member);
                    report.incRepaired();
                }
            }
            boolean hasOwner = memberships.stream().anyMatch(m -> m.getRole() == MemberRole.OWNER && "ACTIVE".equals(m.getStatus()));
            if (!hasOwner && memberships.size() == 1) {
                Member only = memberships.get(0);
                only.setRole(MemberRole.OWNER);
                only.setStatus("ACTIVE");
                community.setOwnerUserId(only.getUserId());
                if (!dryRun) memberRepository.save(only);
                changed = true;
                report.incRepaired();
            } else if (!hasOwner && memberships.size() > 1) {
                report.incAmbiguous();
            }
            long activeCount = memberships.stream().filter(m -> "ACTIVE".equals(m.getStatus())).count();
            if (community.getMemberCount() != activeCount || community.getMemberIds().size() != activeCount) {
                community.setMemberCount(activeCount);
                community.setMemberIds(memberships.stream().filter(m -> "ACTIVE".equals(m.getStatus())).map(Member::getUserId).toList());
                changed = true;
                report.incRepaired();
            }
            if (changed) {
                report.incMigrated();
                if (!dryRun) communityRepository.save(community);
            } else {
                report.incAlreadyValid();
            }
        }
        return report;
    }

    private String slugify(String value) {
        String slug = value == null ? "community" : value.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return StringUtils.hasText(slug) ? slug : "community";
    }
}
