package com.hvhn.backend.repository;

import com.hvhn.backend.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByNormalizedEmail(String normalizedEmail);
    Optional<User> findByFirebaseUid(String firebaseUid);
    boolean existsByEmail(String email);
    boolean existsByNormalizedEmail(String normalizedEmail);
    List<User> findByVolunteerTrueAndVerifiedTrue();
}
