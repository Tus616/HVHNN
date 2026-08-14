package com.hvhn.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/locations")
public class LocationController {

    private static final String USER_AGENT = "Sahay/1.0 (location-search; contact: support@hvhn.local)";
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();

    public LocationController(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @GetMapping("/search")
    public ResponseEntity<List<Map<String, Object>>> search(@RequestParam String q,
                                                            @RequestParam(required = false) String type) {
        String query = q == null ? "" : q.trim();
        if (query.length() < 2) return ResponseEntity.ok(List.of());
        List<JsonNode> results = fetchList(searchUrl(query + typeHint(type)));
        if (results.isEmpty() && StringUtils.hasText(type)) {
            results = fetchList(searchUrl(query));
        }
        return ResponseEntity.ok(results.stream().map(this::mapSearchResult).toList());
    }

    @GetMapping("/reverse")
    public ResponseEntity<Map<String, Object>> reverse(@RequestParam double lat, @RequestParam double lon) {
        String url = "https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat="
                + encode(String.valueOf(lat)) + "&lon=" + encode(String.valueOf(lon));
        try {
            JsonNode node = fetchNode(url);
            return ResponseEntity.ok(mapSearchResult(node));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of());
        }
    }

    private List<JsonNode> fetchList(String url) {
        try {
            JsonNode node = fetchNode(url);
            List<JsonNode> results = new ArrayList<>();
            if (node.isArray()) node.forEach(results::add);
            return results;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private JsonNode fetchNode(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(6))
                    .header("User-Agent", USER_AGENT)
                    .header("Accept", "application/json")
                    .header("Accept-Language", "en")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Location provider unavailable.");
            }
            return objectMapper.readTree(response.body());
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Location provider unavailable.");
        }
    }

    private Map<String, Object> mapSearchResult(JsonNode node) {
        Map<String, Object> result = new LinkedHashMap<>();
        JsonNode address = node.path("address");
        Map<String, Object> addressMap = objectMapper.convertValue(address, new TypeReference<>() {});
        String city = first(address, "city", "town", "village", "municipality", "county");
        String district = first(address, "city_district", "district", "county", "state_district");
        String state = first(address, "state", "region");
        String country = first(address, "country");

        result.put("placeId", node.path("place_id").asText(""));
        result.put("displayName", node.path("display_name").asText(""));
        result.put("latitude", parseDouble(node.path("lat").asText(null)));
        result.put("longitude", parseDouble(node.path("lon").asText(null)));
        result.put("type", node.path("type").asText(""));
        result.put("address", addressMap);
        result.put("city", city);
        result.put("district", StringUtils.hasText(district) ? district : city);
        result.put("state", state);
        result.put("country", country);
        return result;
    }

    private String first(JsonNode address, String... keys) {
        for (String key : keys) {
            String value = address.path(key).asText("");
            if (StringUtils.hasText(value)) return value;
        }
        return "";
    }

    private Double parseDouble(String value) {
        try {
            return value == null ? null : Double.valueOf(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String typeHint(String type) {
        if (!StringUtils.hasText(type)) return "";
        return switch (type.trim().toUpperCase()) {
            case "CITY" -> " city";
            case "DISTRICT" -> " district";
            case "STATE" -> " state";
            default -> "";
        };
    }

    private String searchUrl(String query) {
        return "https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&countrycodes=in&q="
                + encode(query);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
