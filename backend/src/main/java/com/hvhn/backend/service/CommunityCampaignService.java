package com.hvhn.backend.service;

import com.hvhn.backend.model.CommunityCampaign;
import com.hvhn.backend.model.CommunityContribution;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.CommunityCampaignRepository;
import com.hvhn.backend.repository.CommunityContributionRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class CommunityCampaignService {

    private final CommunityCampaignRepository campaignRepository;
    private final CommunityContributionRepository contributionRepository;
    private final CommunityPermissionService permissions;

    public CommunityCampaignService(CommunityCampaignRepository campaignRepository,
                                    CommunityContributionRepository contributionRepository,
                                    CommunityPermissionService permissions) {
        this.campaignRepository = campaignRepository;
        this.contributionRepository = contributionRepository;
        this.permissions = permissions;
    }

    public List<CommunityCampaign> listCampaigns(String communityId, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        return campaignRepository.findByCommunityIdOrderByCreatedAtDesc(communityId);
    }

    public CommunityCampaign createCampaign(String communityId, Map<String, Object> payload, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        CommunityCampaign campaign = new CommunityCampaign();
        campaign.setCommunityId(communityId);
        campaign.setCreatorUserId(currentUser.getId());
        campaign.setTitle(required(payload, "title", 5, 160));
        campaign.setStory(required(payload, "story", 10, 5000));
        campaign.setCategory(canonical(payload.get("category"), "OTHER"));
        campaign.setUrgency(canonical(payload.get("urgency"), "MEDIUM"));
        campaign.setTargetType(canonical(payload.get("targetType"), "SUPPLIES"));
        campaign.setTargetAmount(amount(payload.get("targetAmount")));
        campaign.setLocation(text(payload.get("location")));
        campaign.setCity(text(payload.get("city")));
        campaign.setDistrict(text(payload.get("district")));
        campaign.setState(text(payload.get("state")));
        campaign.setCreatedAt(LocalDateTime.now().withNano(0));
        return campaignRepository.save(campaign);
    }

    public CommunityContribution contribute(String communityId, String campaignId, Map<String, Object> payload, User currentUser) {
        permissions.requireMember(currentUser, communityId);
        CommunityCampaign campaign = campaignRepository.findByIdAndCommunityId(campaignId, communityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Campaign not found."));
        if (!"ACTIVE".equals(campaign.getStatus())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Campaign is not active.");
        }
        CommunityContribution contribution = new CommunityContribution();
        contribution.setCommunityId(communityId);
        contribution.setCampaignId(campaignId);
        contribution.setContributorUserId(currentUser.getId());
        contribution.setType(canonical(payload.get("type"), "OTHER"));
        contribution.setAmount(amount(payload.get("amount")));
        contribution.setVolunteerHours(intValue(payload.get("volunteerHours")));
        contribution.setNote(text(payload.get("note")));
        CommunityContribution saved = contributionRepository.save(contribution);

        campaign.setContributionCount(contributionRepository.countByCampaignIdAndStatus(campaignId, "RECORDED"));
        if ("MONEY_PLEDGE".equals(contribution.getType())) {
            campaign.setCollectedAmount(campaign.getCollectedAmount().add(contribution.getAmount()));
        }
        if ("VOLUNTEER_TIME".equals(contribution.getType())) {
            campaign.setVolunteerCount(campaign.getVolunteerCount() + 1);
        }
        campaignRepository.save(campaign);
        return saved;
    }

    public CommunityCampaign moderateCampaign(String communityId, String campaignId, Map<String, String> payload, User currentUser) {
        permissions.requireModerator(currentUser, communityId);
        CommunityCampaign campaign = campaignRepository.findByIdAndCommunityId(campaignId, communityId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Campaign not found."));
        String status = canonical(payload == null ? null : payload.get("status"), campaign.getStatus());
        if (!List.of("DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED", "EXPIRED").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Campaign status is invalid.");
        }
        campaign.setStatus(status);
        return campaignRepository.save(campaign);
    }

    private String required(Map<String, Object> payload, String key, int min, int max) {
        String text = text(payload == null ? null : payload.get(key));
        if (text.length() < min || text.length() > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, key + " length is invalid.");
        }
        return text;
    }

    private String canonical(Object value, String fallback) {
        String text = text(value);
        return StringUtils.hasText(text) ? text.trim().toUpperCase().replace(' ', '_') : fallback;
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private BigDecimal amount(Object value) {
        if (value == null || !StringUtils.hasText(String.valueOf(value))) return BigDecimal.ZERO;
        try {
            BigDecimal amount = new BigDecimal(String.valueOf(value));
            if (amount.compareTo(BigDecimal.ZERO) < 0) throw new NumberFormatException();
            return amount;
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Amount is invalid.");
        }
    }

    private int intValue(Object value) {
        if (value == null || !StringUtils.hasText(String.valueOf(value))) return 0;
        try {
            return Math.max(0, Integer.parseInt(String.valueOf(value)));
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Volunteer hours are invalid.");
        }
    }
}
