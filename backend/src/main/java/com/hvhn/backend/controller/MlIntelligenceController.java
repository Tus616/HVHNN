package com.hvhn.backend.controller;

import com.hvhn.backend.dto.HelpRequestDTO;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.service.LocationService;
import com.hvhn.backend.service.MlIntelligenceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ml")
public class MlIntelligenceController {
    private final MlIntelligenceService mlService;
    private final LocationService locationService;

    public MlIntelligenceController(MlIntelligenceService mlService, LocationService locationService) {
        this.mlService = mlService;
        this.locationService = locationService;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(mlService.health());
    }

    @PostMapping("/request/analyze")
    public ResponseEntity<Map<String, Object>> analyze(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(mlService.analyzeRequest(
                String.valueOf(body.getOrDefault("title", "")),
                String.valueOf(body.getOrDefault("description", ""))
        ));
    }

    @PostMapping("/request/duplicate")
    public ResponseEntity<Map<String, Object>> duplicate(@RequestBody HelpRequestDTO dto,
                                                        @AuthenticationPrincipal User user) {
        HelpRequest draft = new HelpRequest();
        draft.setTitle(dto.getTitle());
        draft.setDescription(dto.getDescription());
        draft.setCategory(dto.getCategory());
        draft.setCity(dto.getCity());
        draft.setDistrict(dto.getDistrict());
        draft.setState(dto.getState());
        draft.setRequesterId(user == null ? null : user.getId());
        Double latitude = dto.getLatitude();
        Double longitude = dto.getLongitude();
        if (latitude == null && longitude == null && user != null && LocationService.SOURCE_PROFILE.equals(locationService.normalizeSource(dto.getLocationSource(), LocationService.SOURCE_UNKNOWN))) {
            latitude = user.getLatitude();
            longitude = user.getLongitude();
        }
        draft.setLatitude(latitude);
        draft.setLongitude(longitude);
        if (!StringUtils.hasText(draft.getCity()) && user != null) draft.setCity(user.getCity());
        if (!StringUtils.hasText(draft.getDistrict()) && user != null) draft.setDistrict(user.getDistrict());
        if (!StringUtils.hasText(draft.getState()) && user != null) draft.setState(user.getState());
        return ResponseEntity.ok(mlService.detectDuplicate(draft));
    }

    @PostMapping("/search/requests")
    public ResponseEntity<Map<String, Object>> searchRequests(@RequestBody Map<String, Object> body) {
        String query = String.valueOf(body.getOrDefault("query", ""));
        Object rawCandidates = body.get("candidates");
        java.util.List<Map<String, Object>> candidates = rawCandidates instanceof java.util.List<?> list
                ? list.stream()
                    .filter(Map.class::isInstance)
                    .map(item -> (Map<String, Object>) item)
                    .toList()
                : java.util.List.of();
        return ResponseEntity.ok(mlService.searchRequests(query, candidates));
    }
}
