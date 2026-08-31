package com.hvhn.backend.repository;

import com.hvhn.backend.model.RequestComment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RequestCommentRepository extends MongoRepository<RequestComment, String> {
    List<RequestComment> findByRequestIdAndDeletedFalseOrderByCreatedAtAsc(String requestId);
    void deleteByRequestId(String requestId);
}
