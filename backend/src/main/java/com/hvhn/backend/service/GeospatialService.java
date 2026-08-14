package com.hvhn.backend.service;

import com.hvhn.backend.dto.NearbyRequestQuery;
import com.hvhn.backend.dto.NearbyVolunteerCandidate;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.model.enums.VolunteerCategory;
import com.hvhn.backend.repository.HelpRequestRepository;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.index.GeoSpatialIndexType;
import org.springframework.data.mongodb.core.index.GeospatialIndex;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class GeospatialService {

    public static final double DEFAULT_RADIUS_KM = 10.0d;
    public static final double MIN_RADIUS_KM = 1.0d;
    public static final double MAX_RADIUS_KM = 100.0d;
    public static final int DEFAULT_LIMIT = 25;
    public static final int MAX_LIMIT = 100;

    private final MongoTemplate mongoTemplate;
    private final HelpRequestRepository requestRepository;
    private final RequestViewMapper requestViewMapper;
    private final LocationService locationService;

    public GeospatialService(MongoTemplate mongoTemplate,
                             HelpRequestRepository requestRepository,
                             RequestViewMapper requestViewMapper,
                             LocationService locationService) {
        this.mongoTemplate = mongoTemplate;
        this.requestRepository = requestRepository;
        this.requestViewMapper = requestViewMapper;
        this.locationService = locationService;
    }

    public void ensureIndexes() {
        mongoTemplate.indexOps(HelpRequest.class)
                .ensureIndex(new GeospatialIndex("geoLocation")
                        .typed(GeoSpatialIndexType.GEO_2DSPHERE)
                        .named("idx_help_requests_location_2dsphere"));
        mongoTemplate.indexOps(User.class)
                .ensureIndex(new GeospatialIndex("location")
                        .typed(GeoSpatialIndexType.GEO_2DSPHERE)
                        .named("idx_users_location_2dsphere"));
    }

    public List<Map<String, Object>> nearbyRequests(NearbyRequestQuery query) {
        double radiusKm = validateRadius(query.getRadiusKm());
        int limit = validateLimit(query.getLimit());
        locationService.validateOptional(query.getLatitude(), query.getLongitude());

        if (query.getLatitude() != null) {
            return nearbyRequestsGeo(query, radiusKm, limit);
        }
        return nearbyRequestsAdministrative(query, limit);
    }

    public List<NearbyVolunteerCandidate> nearbyVolunteers(HelpRequest request, double radiusKm, int limit) {
        if (request.getGeoLocation() == null) {
            return List.of();
        }
        double safeRadiusKm = validateRadius(radiusKm);
        int safeLimit = validateLimit(limit);
        Criteria criteria = Criteria.where("isVolunteer").is(true)
                .and("onboardingCompleted").is(true)
                .and("verified").is(true)
                .and("accountStatus").is("ACTIVE")
                .and("location").ne(null);
        if (StringUtils.hasText(request.getRequesterId())) {
            criteria.and("_id").ne(ObjectId.isValid(request.getRequesterId())
                    ? new ObjectId(request.getRequesterId())
                    : request.getRequesterId());
        }

        Aggregation aggregation = Aggregation.newAggregation(
                geoNear("location", request.getGeoLocation(), safeRadiusKm, criteria),
                Aggregation.limit(safeLimit)
        );
        List<Document> documents = mongoTemplate.aggregate(aggregation, "users", Document.class).getMappedResults();
        String requiredCategory = VolunteerCategory.canonicalize(request.getCategory());
        return documents.stream()
                .map(document -> toVolunteerCandidate(document, requiredCategory))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(NearbyVolunteerCandidate::distanceKm)
                        .thenComparing(NearbyVolunteerCandidate::volunteerId))
                .toList();
    }

    public double validateRadius(Double radiusKm) {
        double value = radiusKm == null ? DEFAULT_RADIUS_KM : radiusKm;
        if (!Double.isFinite(value) || value < MIN_RADIUS_KM || value > MAX_RADIUS_KM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "radiusKm must be between " + MIN_RADIUS_KM + " and " + MAX_RADIUS_KM + ".");
        }
        return value;
    }

    public int validateLimit(Integer limit) {
        int value = limit == null ? DEFAULT_LIMIT : limit;
        if (value < 1 || value > MAX_LIMIT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limit must be between 1 and " + MAX_LIMIT + ".");
        }
        return value;
    }

    private List<Map<String, Object>> nearbyRequestsGeo(NearbyRequestQuery query, double radiusKm, int limit) {
        locationService.validateRequired(query.getLatitude(), query.getLongitude());
        Criteria criteria = requestCriteria(query).and("geoLocation").ne(null);
        GeoJsonPoint origin = new GeoJsonPoint(query.getLongitude(), query.getLatitude());
        Aggregation aggregation = Aggregation.newAggregation(
                geoNear("geoLocation", origin, radiusKm, criteria),
                Aggregation.sort(Sort.by(Sort.Order.asc("distanceKm"), Sort.Order.desc("createdAt"))),
                Aggregation.limit(limit)
        );
        List<Document> documents = mongoTemplate.aggregate(aggregation, "help_requests", Document.class).getMappedResults();
        return documents.stream()
                .map(document -> requestViewMapper.toRequestMap(mongoTemplate.getConverter().read(HelpRequest.class, document),
                        document.getDouble("distanceKm")))
                .toList();
    }

    private List<Map<String, Object>> nearbyRequestsAdministrative(NearbyRequestQuery query, int limit) {
        Query mongoQuery = new Query(requestCriteria(query));
        mongoQuery.with(Sort.by(Sort.Order.desc("createdAt"), Sort.Order.asc("_id")));
        mongoQuery.limit(limit);
        return mongoTemplate.find(mongoQuery, HelpRequest.class).stream()
                .map(request -> requestViewMapper.toRequestMap(request, null))
                .toList();
    }

    private Criteria requestCriteria(NearbyRequestQuery query) {
        List<Criteria> all = new ArrayList<>();
        all.add(Criteria.where("status").is(HelpRequestService.REQUEST_OPEN));
        all.add(new Criteria().orOperator(Criteria.where("deletedByRequester").is(false), Criteria.where("deletedByRequester").exists(false)));
        all.add(new Criteria().orOperator(Criteria.where("scope").is("GLOBAL"), Criteria.where("scope").exists(false)));
        if (StringUtils.hasText(query.getCategory())) {
            all.add(Criteria.where("category").is(VolunteerCategory.canonicalize(query.getCategory())));
        }
        if (StringUtils.hasText(query.getUrgency())) {
            all.add(Criteria.where("urgency").is(query.getUrgency().trim().toUpperCase()));
        }
        addAreaCriterion(all, "city", query.getCity());
        addAreaCriterion(all, "district", query.getDistrict());
        addAreaCriterion(all, "state", query.getState());
        return new Criteria().andOperator(all.toArray(Criteria[]::new));
    }

    private void addAreaCriterion(List<Criteria> criteria, String field, String value) {
        String normalized = locationService.normalizeArea(value);
        if (normalized != null) {
            criteria.add(Criteria.where(field).regex("^" + java.util.regex.Pattern.quote(normalized) + "$", "i"));
        }
    }

    private AggregationOperation geoNear(String field, GeoJsonPoint origin, double radiusKm, Criteria criteria) {
        return context -> {
            Map<String, Object> near = new LinkedHashMap<>();
            near.put("type", "Point");
            near.put("coordinates", List.of(origin.getX(), origin.getY()));
            Document geoNear = new Document("near", new Document(near))
                    .append("key", field)
                    .append("distanceField", "distanceKm")
                    .append("spherical", true)
                    .append("maxDistance", radiusKm * 1000.0d)
                    .append("distanceMultiplier", 0.001d)
                    .append("query", criteria.getCriteriaObject());
            return new Document("$geoNear", geoNear);
        };
    }

    @SuppressWarnings("unchecked")
    private NearbyVolunteerCandidate toVolunteerCandidate(Document document, String requiredCategory) {
        List<String> categories = (List<String>) document.getOrDefault("volunteerCategories", List.of());
        if (categories.stream().map(VolunteerCategory::canonicalize).noneMatch(requiredCategory::equals)) {
            return null;
        }
        Object id = document.get("_id");
        Double distanceKm = document.getDouble("distanceKm");
        return new NearbyVolunteerCandidate(
                id == null ? null : id.toString(),
                distanceKm == null ? null : locationService.roundKm(distanceKm),
                requiredCategory,
                Boolean.TRUE.equals(document.getBoolean("verified")) ? "VERIFIED" : "BASIC",
                String.valueOf(document.getOrDefault("volunteerStatus", "UNKNOWN"))
        );
    }
}
