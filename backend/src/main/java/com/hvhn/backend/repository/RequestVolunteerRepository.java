package com.hvhn.backend.repository;

import com.hvhn.backend.model.RequestVolunteer;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RequestVolunteerRepository extends MongoRepository<RequestVolunteer, String> {
    List<RequestVolunteer> findByVolunteerIdAndStatusOrderByAssignedAtDesc(String volunteerId, String status);
    List<RequestVolunteer> findByVolunteerIdOrderByAssignedAtDesc(String volunteerId);
    List<RequestVolunteer> findByRequestId(String requestId);
    Optional<RequestVolunteer> findByRequestIdAndVolunteerId(String requestId, String volunteerId);
    List<RequestVolunteer> findByRequestIdAndStatus(String requestId, String status);
}
