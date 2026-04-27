package com.hvhn.backend.repository;

import com.hvhn.backend.model.Member;
import com.hvhn.backend.model.enums.MemberRole;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemberRepository extends MongoRepository<Member, String> {
    Optional<Member> findByUserIdAndCommunityId(String userId, String communityId);
    List<Member> findByUserId(String userId);
    Optional<Member> findByIdAndCommunityId(String id, String communityId);

    boolean existsByUserIdAndCommunityId(String userId, String communityId);
    List<Member> findByCommunityIdOrderByJoinedAtAsc(String communityId);
    long countByCommunityId(String communityId);
    long countByCommunityIdAndRole(String communityId, MemberRole role);
    void deleteByUserIdAndCommunityId(String userId, String communityId);
    void deleteByCommunityId(String communityId);
}
