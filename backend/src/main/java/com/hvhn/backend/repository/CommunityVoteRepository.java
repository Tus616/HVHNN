package com.hvhn.backend.repository;

import com.hvhn.backend.model.CommunityVote;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface CommunityVoteRepository extends MongoRepository<CommunityVote, String> {
    Optional<CommunityVote> findByUserIdAndTargetTypeAndTargetId(String userId, String targetType, String targetId);
    long countByTargetTypeAndTargetId(String targetType, String targetId);
    void deleteByUserIdAndTargetTypeAndTargetId(String userId, String targetType, String targetId);
}
