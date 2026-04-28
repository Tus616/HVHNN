package com.hvhn.backend.service;

import com.hvhn.backend.model.EmergencyContact;
import com.hvhn.backend.model.HelpRequest;
import com.hvhn.backend.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String fromAddress;

    public NotificationService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.from:${spring.mail.username:}}") String fromAddress
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.fromAddress = fromAddress;
    }

    public void alertEmergencyContacts(User user, HelpRequest request) {
        if (user.getEmergencyContacts() == null || user.getEmergencyContacts().isEmpty()) {
            log.info("No emergency contacts registered for user: {}", user.getEmail());
            return;
        }

        log.info("Alerting {} emergency contacts for user: {}", user.getEmergencyContacts().size(), user.getEmail());

        for (EmergencyContact contact : user.getEmergencyContacts()) {
            sendEmergencyEmail(contact, user, request);
        }
    }

    private void sendEmergencyEmail(EmergencyContact contact, User user, HelpRequest request) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("Emergency email delivery is not configured because JavaMailSender is unavailable.");
            return;
        }

        String mapsLink = "";
        if (request.getLatitude() != null && request.getLongitude() != null) {
            mapsLink = String.format("https://www.google.com/maps?q=%f,%f", request.getLatitude(), request.getLongitude());
        }

        String timestamp = request.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(contact.getEmail());
        message.setSubject("🚨 URGENT: Emergency SOS Alert from " + user.getFullName());
        
        String body = String.format("""
                Dear %s,
                
                This is an automated emergency alert from HVHN.
                
                %s has just raised an SOS Emergency Request.
                
                Description: %s
                Location: %s
                %s
                Timestamp: %s
                
                Please take immediate action or contact them if possible.
                
                - HVHN Emergency Response System
                """, 
                contact.getName(), 
                user.getFullName(), 
                request.getDescription(), 
                request.getAddress() != null ? request.getAddress() : "Location Shared",
                !mapsLink.isEmpty() ? "View on Maps: " + mapsLink : "",
                timestamp);

        message.setText(body);

        try {
            mailSender.send(message);
            log.info("Emergency email sent successfully to {}", contact.getEmail());
        } catch (MailException exception) {
            log.error("Failed to send emergency email to {}", contact.getEmail(), exception);
        }
    }

    public void sendNotification(String userId, String type, String message) {
        log.info("Sending notification to user {}: [{}] {}", userId, type, message);
    }
}
