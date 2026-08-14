package com.hvhn.backend.repository;

import com.hvhn.backend.model.CommunityQuestion;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CommunityQuestionRepository extends MongoRepository<CommunityQuestion, String> {
    List<CommunityQuestion> findByCommunityIdAndDeletedAtIsNullOrderByCreatedAtDesc(String communityId);
    Optional<CommunityQuestion> findByIdAndCommunityIdAndDeletedAtIsNull(String id, String communityId);
    long countByCommunityIdAndStatusAndDeletedAtIsNull(String communityId, String status);
}
