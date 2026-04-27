package com.hvhn.backend.repository;

import com.hvhn.backend.model.Request;
import com.hvhn.backend.model.enums.RequestStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RequestRepository extends MongoRepository<Request, String> {
    List<Request> findByCommunityIdOrderByCreatedAtDesc(String communityId);
    List<Request> findByCommunityIdAndStatusOrderByCreatedAtDesc(String communityId, RequestStatus status);
    List<Request> findByLocationContainingIgnoreCaseOrderByCreatedAtDesc(String location);
    Optional<Request> findByIdAndCommunityId(String id, String communityId);
    long countByCommunityId(String communityId);
    void deleteByCommunityId(String communityId);
}
