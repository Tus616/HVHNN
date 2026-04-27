package com.hvhn.backend.repository;

import com.hvhn.backend.model.VolunteerRating;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VolunteerRatingRepository extends MongoRepository<VolunteerRating, String> {
    Optional<VolunteerRating> findByRequestIdAndVolunteerId(String requestId, String volunteerId);
    List<VolunteerRating> findByVolunteerIdOrderByCreatedAtDesc(String volunteerId);
}
