package com.hvhn.backend.repository;

import com.hvhn.backend.model.Community;
import com.hvhn.backend.model.enums.CommunityCategory;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommunityRepository extends MongoRepository<Community, String> {
    List<Community> findAllByOrderByCreatedAtDesc();
    List<Community> findByCategoryOrderByCreatedAtDesc(CommunityCategory category);
    List<Community> findByLocationContainingIgnoreCaseOrderByCreatedAtDesc(String location);
    Optional<Community> findBySlug(String slug);
    boolean existsBySlug(String slug);
    List<Community> findByStatusOrderByCreatedAtDesc(String status);
    long countByStatus(String status);
}
