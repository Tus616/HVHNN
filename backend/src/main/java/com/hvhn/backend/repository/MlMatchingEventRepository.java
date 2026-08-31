package com.hvhn.backend.repository;

import com.hvhn.backend.model.MlMatchingEvent;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MlMatchingEventRepository extends MongoRepository<MlMatchingEvent, String> {
    Optional<MlMatchingEvent> findByRequestIdAndCandidateUserId(String requestId, String candidateUserId);
    List<MlMatchingEvent> findByRequestId(String requestId);
}
