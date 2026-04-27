package com.hvhn.backend.service;

import com.hvhn.backend.model.AvailabilityEntry;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
public class VolunteerSchedulerService {
    private static final Logger logger = LoggerFactory.getLogger(VolunteerSchedulerService.class);
    private final UserRepository userRepository;

    public VolunteerSchedulerService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Scheduled job that runs every 30 minutes to check volunteer schedules 
     * and automatically toggle their online availability status.
     */
    @Scheduled(cron = "0 0/30 * * * *")
    public void checkVolunteerAvailability() {
        logger.info("Starting scheduled volunteer availability check...");
        List<User> volunteers = userRepository.findByVolunteerTrueAndVerifiedTrue();
        
        LocalDateTime now = LocalDateTime.now();
        // Day format: MON, TUE, WED, THU, FRI, SAT, SUN
        String currentDay = now.getDayOfWeek().toString().substring(0, 3); 
        LocalTime currentTime = now.toLocalTime();

        int updatedCount = 0;
        for (User user : volunteers) {
            String oldStatus = user.getVolunteerStatus();
            String newStatus = "OFFLINE";

            if (user.isAlwaysAvailable()) {
                newStatus = "ONLINE";
            } else if (user.getAvailabilitySchedule() != null) {
                for (AvailabilityEntry entry : user.getAvailabilitySchedule()) {
                    if (entry.isEnabled() && entry.getDay().equalsIgnoreCase(currentDay)) {
                        try {
                            LocalTime start = LocalTime.parse(entry.getStartTime());
                            LocalTime end = LocalTime.parse(entry.getEndTime());
                            
                            // If end time is "00:00" or similar, it might be interpreted as start of day.
                            // We assume HH:mm format. If end time is before start time, it likely spans midnight.
                            if (end.isBefore(start)) {
                                if (currentTime.isAfter(start) || currentTime.isBefore(end)) {
                                    newStatus = "ONLINE";
                                    break;
                                }
                            } else {
                                if (!currentTime.isBefore(start) && currentTime.isBefore(end)) {
                                    newStatus = "ONLINE";
                                    break;
                                }
                            }
                        } catch (DateTimeParseException e) {
                            logger.error("Invalid time format for user {}: {} - {}", user.getId(), entry.getStartTime(), entry.getEndTime());
                        }
                    }
                }
            }

            if (!oldStatus.equalsIgnoreCase(newStatus)) {
                user.setVolunteerStatus(newStatus);
                userRepository.save(user);
                updatedCount++;
                logger.info("Auto-updated volunteer {} status to {}", user.getId(), newStatus);
            }
        }
        logger.info("Volunteer availability check completed. Updated {} users.", updatedCount);
    }
}
