package com.hvhn.backend.repository;

import com.hvhn.backend.model.RequestAcceptance;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RequestAcceptanceRepository extends MongoRepository<RequestAcceptance, String> {
    List<RequestAcceptance> findByVolunteerId(String volunteerId);
    List<RequestAcceptance> findByHelpRequestId(String helpRequestId);
    Optional<RequestAcceptance> findByHelpRequestIdAndVolunteerId(String helpRequestId, String volunteerId);
    void deleteByHelpRequestId(String helpRequestId);
}
