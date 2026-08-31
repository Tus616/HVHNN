package com.hvhn.backend.repository;

import com.hvhn.backend.model.CommunityAnswer;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface CommunityAnswerRepository extends MongoRepository<CommunityAnswer, String> {
    List<CommunityAnswer> findByQuestionIdAndDeletedAtIsNullOrderByCreatedAtAsc(String questionId);
    Optional<CommunityAnswer> findByIdAndQuestionIdAndCommunityIdAndDeletedAtIsNull(String id, String questionId, String communityId);
    long countByQuestionIdAndDeletedAtIsNull(String questionId);
    List<CommunityAnswer> findByQuestionIdAndAcceptedTrue(String questionId);
}
