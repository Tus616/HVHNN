package com.hvhn.backend.repository;

import com.hvhn.backend.model.RequestAcceptance;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RequestAcceptanceRepository extends MongoRepository<RequestAcceptance, String> {
    List<RequestAcceptance> findByVolunteerId(String volunteerId);
    List<RequestAcceptance> findByHelpRequestId(String helpRequestId);
}
