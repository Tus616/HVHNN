package com.hvhn.backend.repository;

import com.hvhn.backend.model.HelpRequest;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HelpRequestRepository extends MongoRepository<HelpRequest, String> {
    List<HelpRequest> findByStatus(String status);
    List<HelpRequest> findByStatusInOrderByCreatedAtDesc(List<String> statuses);
    List<HelpRequest> findByRequesterId(String requesterId);
    List<HelpRequest> findByVolunteerId(String volunteerId);
    List<HelpRequest> findByVolunteerIdOrderByCreatedAtDesc(String volunteerId);
    List<HelpRequest> findByCategory(String category);
    List<HelpRequest> findByStatusOrderByCreatedAtDesc(String status);
    List<HelpRequest> findByCategoryAndStatus(String category, String status);
    List<HelpRequest> findByCommunityId(String communityId);

    long countByStatus(String status);
    long countByCategory(String category);
    long countByVerificationStatus(String status);
}
