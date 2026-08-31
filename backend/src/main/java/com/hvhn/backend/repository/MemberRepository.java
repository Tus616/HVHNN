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
    List<Member> findByUserIdAndStatus(String userId, String status);
    Optional<Member> findByIdAndCommunityId(String id, String communityId);

    boolean existsByUserIdAndCommunityId(String userId, String communityId);
    boolean existsByUserIdAndCommunityIdAndStatus(String userId, String communityId, String status);
    List<Member> findByCommunityIdOrderByJoinedAtAsc(String communityId);
    List<Member> findByCommunityIdAndStatusOrderByJoinedAtAsc(String communityId, String status);
    long countByCommunityId(String communityId);
    long countByCommunityIdAndStatus(String communityId, String status);
    long countByCommunityIdAndRoleAndStatus(String communityId, MemberRole role, String status);
    long countByCommunityIdAndRole(String communityId, MemberRole role);
    void deleteByUserIdAndCommunityId(String userId, String communityId);
    void deleteByCommunityId(String communityId);
}
