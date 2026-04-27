package com.hvhn.backend.repository;

import com.hvhn.backend.model.Announcement;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface AnnouncementRepository extends MongoRepository<Announcement, String> {
    List<Announcement> findByCommunityIdOrderByIsPinnedDescCreatedAtDesc(String communityId);
    List<Announcement> findByCommunityIdAndIsPinnedTrue(String communityId);
}
