package com.hvhn.backend.service;

import com.hvhn.backend.dto.LocationMigrationReport;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.HelpRequestRepository;
import com.hvhn.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LocationMigrationService {

    private final HelpRequestRepository requestRepository;
    private final UserRepository userRepository;
    private final LocationService locationService;

    public LocationMigrationService(HelpRequestRepository requestRepository,
                                    UserRepository userRepository,
                                    LocationService locationService) {
        this.requestRepository = requestRepository;
        this.userRepository = userRepository;
        this.locationService = locationService;
    }

    public LocationMigrationReport migrateRequests(boolean dryRun) {
        LocationMigrationReport report = new LocationMigrationReport();
        report.setDryRun(dryRun);
        for (HelpRequest request : requestRepository.findAll()) {
            report.incrementScanned();
            if (request.getGeoLocation() != null) {
                report.incrementAlreadyValid();
                continue;
            }
            if (request.getLatitude() == null && request.getLongitude() == null) {
                report.incrementSkipped();
                continue;
            }
            if (isAmbiguous(request.getLatitude(), request.getLongitude())) {
                report.incrementAmbiguous();
                continue;
            }
            try {
                var point = locationService.point(request.getLatitude(), request.getLongitude());
                if (!dryRun) {
                    request.setGeoLocation(point);
                    request.setLocationSource(LocationService.SOURCE_MIGRATED);
                    request.setLocationUpdatedAt(locationService.nowIfLocated(point));
                    request.setCity(locationService.normalizeArea(request.getCity()));
                    request.setDistrict(locationService.normalizeArea(request.getDistrict()));
                    request.setState(locationService.normalizeArea(request.getState()));
                    requestRepository.save(request);
                }
                report.incrementMigrated();
            } catch (ResponseStatusException exception) {
                report.incrementInvalid();
            }
        }
        return report;
    }

    public LocationMigrationReport migrateUsers(boolean dryRun) {
        LocationMigrationReport report = new LocationMigrationReport();
        report.setDryRun(dryRun);
        for (User user : userRepository.findAll()) {
            report.incrementScanned();
            if (user.getLocation() != null) {
                report.incrementAlreadyValid();
                continue;
            }
            if (user.getLatitude() == null && user.getLongitude() == null) {
                report.incrementSkipped();
                continue;
            }
            if (isAmbiguous(user.getLatitude(), user.getLongitude())) {
                report.incrementAmbiguous();
                continue;
            }
            try {
                var point = locationService.point(user.getLatitude(), user.getLongitude());
                if (!dryRun) {
                    user.setLocation(point);
                    user.setLocationSource(LocationService.SOURCE_MIGRATED);
                    user.setLocationUpdatedAt(locationService.nowIfLocated(point));
                    user.setCity(locationService.normalizeArea(user.getCity()));
                    user.setDistrict(locationService.normalizeArea(user.getDistrict()));
                    user.setState(locationService.normalizeArea(user.getState()));
                    userRepository.save(user);
                }
                report.incrementMigrated();
            } catch (ResponseStatusException exception) {
                report.incrementInvalid();
            }
        }
        return report;
    }

    private boolean isAmbiguous(Double latitude, Double longitude) {
        if (latitude == null || longitude == null) return false;
        return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 90
                && looksLikeIndiaLongitude(latitude)
                && looksLikeIndiaLatitude(longitude);
    }

    private boolean looksLikeIndiaLatitude(double value) {
        return value >= 6 && value <= 38;
    }

    private boolean looksLikeIndiaLongitude(double value) {
        return value >= 68 && value <= 98;
    }
}
