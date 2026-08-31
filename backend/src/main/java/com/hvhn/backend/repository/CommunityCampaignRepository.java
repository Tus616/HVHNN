package com.hvhn.backend.repository;

import com.hvhn.backend.model.CommunityCampaign;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CommunityCampaignRepository extends MongoRepository<CommunityCampaign, String> {
    List<CommunityCampaign> findByCommunityIdOrderByCreatedAtDesc(String communityId);
    List<CommunityCampaign> findByCommunityIdAndStatusOrderByCreatedAtDesc(String communityId, String status);
    Optional<CommunityCampaign> findByIdAndCommunityId(String id, String communityId);
    long countByCommunityIdAndStatus(String communityId, String status);
}
