package com.hvhn.backend.repository;

import com.hvhn.backend.model.UserPresence;
import com.hvhn.backend.model.enums.PresenceStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserPresenceRepository extends MongoRepository<UserPresence, String> {
    Optional<UserPresence> findByUserId(String userId);
    List<UserPresence> findByStatusIn(Collection<PresenceStatus> statuses);
}
