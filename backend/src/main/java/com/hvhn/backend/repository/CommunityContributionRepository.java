package com.hvhn.backend.repository;

import com.hvhn.backend.model.CommunityContribution;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface CommunityContributionRepository extends MongoRepository<CommunityContribution, String> {
    List<CommunityContribution> findByCampaignIdOrderByCreatedAtDesc(String campaignId);
    long countByCampaignIdAndStatus(String campaignId, String status);
}
