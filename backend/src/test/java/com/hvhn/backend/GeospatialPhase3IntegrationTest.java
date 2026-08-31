package com.hvhn.backend;

import com.hvhn.backend.dto.LocationMigrationReport;
import com.hvhn.backend.dto.NearbyRequestQuery;
import com.hvhn.backend.dto.NearbyVolunteerCandidate;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.service.GeospatialService;
import com.hvhn.backend.service.HelpRequestService;
import com.hvhn.backend.service.LocationMigrationService;
import com.hvhn.backend.service.LocationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
class GeospatialPhase3IntegrationTest {

    @Autowired
    GeospatialService geospatialService;

    @Autowired
    LocationService locationService;

    @Autowired
    LocationMigrationService migrationService;

    @Autowired
    HelpRequestRepository requestRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    MongoTemplate mongoTemplate;

    @BeforeEach
    void resetData() {
        guardTestDatabase();
        mongoTemplate.dropCollection(HelpRequest.class);
        mongoTemplate.dropCollection(User.class);
        geospatialService.ensureIndexes();
    }

    @Test
    void createsGeoJsonPointsAndRejectsUnsafeCoordinates() {
        GeoJsonPoint point = locationService.point(28.6139, 77.2090);

        assertThat(point.getX()).isEqualTo(77.2090);
        assertThat(point.getY()).isEqualTo(28.6139);
        assertThatThrownBy(() -> locationService.point(null, 77.2)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> locationService.point(Double.NaN, 77.2)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> locationService.point(0.0, 0.0)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> geospatialService.validateRadius(101.0)).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> geospatialService.validateLimit(0)).isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void ensuresTwoSphereIndexesForRequestsAndUsers() {
        assertThat(mongoTemplate.indexOps(HelpRequest.class).getIndexInfo())
                .anySatisfy(index -> assertThat(index.getName()).isEqualTo("idx_help_requests_location_2dsphere"));
        assertThat(mongoTemplate.indexOps(User.class).getIndexInfo())
                .anySatisfy(index -> assertThat(index.getName()).isEqualTo("idx_users_location_2dsphere"));
    }

    @Test
    void nearbyRequestsUseGeoNearWithOpenStatusFiltersAndAdministrativeFallback() {
        saveRequest("near-medical", 28.6139, 77.2090, "MEDICAL", "HIGH", "Delhi", "New Delhi", "Delhi", HelpRequestService.REQUEST_OPEN);
        saveRequest("near-food", 28.62, 77.21, "FOOD", "LOW", "Delhi", "New Delhi", "Delhi", HelpRequestService.REQUEST_OPEN);
        saveRequest("far-medical", 19.0760, 72.8777, "MEDICAL", "HIGH", "Mumbai", "Mumbai", "Maharashtra", HelpRequestService.REQUEST_OPEN);
        saveRequest("closed-medical", 28.614, 77.209, "MEDICAL", "HIGH", "Delhi", "New Delhi", "Delhi", "COMPLETED");

        NearbyRequestQuery geoQuery = new NearbyRequestQuery();
        geoQuery.setLatitude(28.6140);
        geoQuery.setLongitude(77.2091);
        geoQuery.setRadiusKm(5.0);
        geoQuery.setCategory("MEDICAL");
        geoQuery.setUrgency("HIGH");
        geoQuery.setCity("delhi");

        List<Map<String, Object>> geoResults = geospatialService.nearbyRequests(geoQuery);

        assertThat(geoResults).hasSize(1);
        assertThat(geoResults.get(0)).containsEntry("title", "near-medical");
        assertThat((Double) geoResults.get(0).get("distanceKm")).isLessThan(1.0);

        NearbyRequestQuery fallback = new NearbyRequestQuery();
        fallback.setState("delhi");
        List<Map<String, Object>> fallbackResults = geospatialService.nearbyRequests(fallback);

        assertThat(fallbackResults).extracting(row -> row.get("title")).containsExactlyInAnyOrder("near-medical", "near-food");
        assertThat(fallbackResults).allSatisfy(row -> assertThat(row).containsEntry("distanceKm", null));
    }

    @Test
    void nearbyVolunteersExcludeRequesterInvalidUsersAndIncompatibleCategories() {
        User requester = saveVolunteer("requester", 28.6139, 77.2090, true, true, "MEDICAL");
        User eligible = saveVolunteer("eligible", 28.6142, 77.2093, true, true, "MEDICAL");
        saveVolunteer("not-verified", 28.6141, 77.2091, false, true, "MEDICAL");
        saveVolunteer("not-onboarded", 28.6141, 77.2091, true, false, "MEDICAL");
        saveVolunteer("wrong-category", 28.6141, 77.2091, true, true, "FOOD");
        saveVolunteer("too-far", 19.0760, 72.8777, true, true, "MEDICAL");
        HelpRequest request = saveRequest("need-doctor", 28.6139, 77.2090, "MEDICAL", "HIGH", "Delhi", "New Delhi", "Delhi", HelpRequestService.REQUEST_OPEN);
        request.setRequesterId(requester.getId());
        requestRepository.save(request);

        List<NearbyVolunteerCandidate> candidates = geospatialService.nearbyVolunteers(request, 5.0, 10);

        assertThat(candidates).extracting(NearbyVolunteerCandidate::volunteerId).containsExactly(eligible.getId());
        assertThat(candidates.get(0).distanceKm()).isLessThan(1.0);
    }

    @Test
    void migrationBackfillsFlatCoordinatesWithoutMutatingDryRunsAndIsIdempotent() {
        HelpRequest migratable = saveRequestWithoutGeo("migrate-me", 28.6139, 77.2090);
        saveRequestWithoutGeo("ambiguous-swapped", 77.2090, 28.6139);
        saveRequestWithoutGeo("invalid-zero", 0.0, 0.0);
        User user = saveVolunteerWithoutGeo("flat-user", 28.62, 77.21);

        LocationMigrationReport dryRun = migrationService.migrateRequests(true);
        assertThat(dryRun.getMigrated()).isEqualTo(1);
        assertThat(requestRepository.findById(migratable.getId()).orElseThrow().getGeoLocation()).isNull();

        LocationMigrationReport requestReport = migrationService.migrateRequests(false);
        LocationMigrationReport userReport = migrationService.migrateUsers(false);

        assertThat(requestReport.getMigrated()).isEqualTo(1);
        assertThat(requestReport.getAmbiguous()).isEqualTo(1);
        assertThat(requestReport.getInvalid()).isEqualTo(1);
        assertThat(userReport.getMigrated()).isEqualTo(1);
        assertThat(requestRepository.findById(migratable.getId()).orElseThrow().getLocationSource()).isEqualTo(LocationService.SOURCE_MIGRATED);
        assertThat(userRepository.findById(user.getId()).orElseThrow().getLocation()).isNotNull();
        assertThat(migrationService.migrateRequests(false).getAlreadyValid()).isGreaterThanOrEqualTo(1);
    }

    private HelpRequest saveRequest(String title, double lat, double lng, String category, String urgency,
                                    String city, String district, String state, String status) {
        HelpRequest request = new HelpRequest();
        request.setTitle(title);
        request.setDescription("Need verified help near " + city);
        request.setCategory(category);
        request.setUrgency(urgency);
        request.setStatus(status);
        request.setLatitude(lat);
        request.setLongitude(lng);
        request.setGeoLocation(locationService.point(lat, lng));
        request.setLocationSource(LocationService.SOURCE_MANUAL);
        request.setAddress(title + " address");
        request.setCity(city);
        request.setDistrict(district);
        request.setState(state);
        request.setCreatedAt(LocalDateTime.now());
        return requestRepository.save(request);
    }

    private HelpRequest saveRequestWithoutGeo(String title, double lat, double lng) {
        HelpRequest request = new HelpRequest();
        request.setTitle(title);
        request.setDescription("Legacy request with flat coordinates only");
        request.setCategory("MEDICAL");
        request.setUrgency("HIGH");
        request.setStatus(HelpRequestService.REQUEST_OPEN);
        request.setLatitude(lat);
        request.setLongitude(lng);
        request.setLocationSource(LocationService.SOURCE_UNKNOWN);
        request.setAddress(title + " legacy address");
        request.setCity("Delhi");
        request.setDistrict("New Delhi");
        request.setState("Delhi");
        request.setCreatedAt(LocalDateTime.now());
        return requestRepository.save(request);
    }

    private User saveVolunteer(String name, double lat, double lng, boolean verified, boolean onboarded, String category) {
        User user = new User(name + "@example.test", "password", name);
        user.setVolunteer(true);
        user.setVerified(verified);
        user.setOnboardingCompleted(onboarded);
        user.setAccountStatus("ACTIVE");
        user.setVolunteerStatus("ONLINE");
        user.setVolunteerCategories(List.of(category));
        user.setLatitude(lat);
        user.setLongitude(lng);
        user.setLocation(locationService.point(lat, lng));
        user.setLocationSource(LocationService.SOURCE_BROWSER);
        return userRepository.save(user);
    }

    private User saveVolunteerWithoutGeo(String name, double lat, double lng) {
        User user = saveVolunteer(name, lat, lng, true, true, "MEDICAL");
        user.setLocation(null);
        user.setLocationSource(LocationService.SOURCE_UNKNOWN);
        return userRepository.save(user);
    }

    private void guardTestDatabase() {
        String databaseName = mongoTemplate.getDb().getName();
        assertThat(databaseName).contains("test");
    }
}
