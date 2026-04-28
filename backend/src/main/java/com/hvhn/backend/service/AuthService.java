package com.hvhn.backend.service;

import com.google.firebase.auth.FirebaseToken;
import com.hvhn.backend.dto.AuthRequest;
import com.hvhn.backend.dto.AuthResponse;
import com.hvhn.backend.dto.FirebaseAuthRequest;
import com.hvhn.backend.dto.FirebaseUserDto;
import com.hvhn.backend.dto.RegisterRequest;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.UUID;

@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final FirebaseService firebaseService;
    private final EmailOtpService emailOtpService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            FirebaseService firebaseService,
            EmailOtpService emailOtpService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.firebaseService = firebaseService;
        this.emailOtpService = emailOtpService;
    }

    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.getEmail());

        if (!emailOtpService.consumeVerifiedEmail(email)) {
            throw new IllegalArgumentException("Verify the OTP sent to your email before creating an account.");
        }

        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email already registered");
        }

        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName());
        user.setPhone(request.getPhone());
        user.setLatitude(request.getLatitude());
        user.setLongitude(request.getLongitude());
        user.setAddress(request.getAddress());
        user.setVerified(true);

        User saved = userRepository.save(user);
        return buildAuthResponse(saved);
    }

    public AuthResponse login(AuthRequest request) {
        String email = normalizeEmail(request.getEmail());

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        return buildAuthResponse(user);
    }

    public AuthResponse loginWithFirebase(FirebaseAuthRequest request) {
        FirebaseUserDto decodedToken = firebaseService.verifyAndDecodeIdToken(request.getIdToken());
        String email = normalizeEmail(decodedToken.getEmail());

        if (!StringUtils.hasText(email)) {
            throw new RuntimeException("The Firebase account does not have an email address");
        }

        String resolvedName = resolveFullName(request.getFullName(), decodedToken.getName(), email);
        boolean shouldMarkVerified = Boolean.TRUE.equals(decodedToken.isEmailVerified());

        User user = userRepository.findByEmail(email)
                .map(existingUser -> updateFirebaseUser(existingUser, resolvedName, shouldMarkVerified))
                .orElseGet(() -> createFirebaseUser(email, resolvedName, shouldMarkVerified));

        logger.info(
                "Firebase login completed for email={}, uid={}, verifiedEmail={}",
                email,
                decodedToken.getUid(),
                shouldMarkVerified
        );

        return buildAuthResponse(user);
    }

    private User createFirebaseUser(String email, String fullName, boolean verified) {
        User user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setFullName(fullName);
        user.setVerified(verified);
        logger.info("Creating new local account for Firebase user email={}", email);
        return userRepository.save(user);
    }

    private User updateFirebaseUser(User user, String fullName, boolean verified) {
        boolean changed = false;

        if (!StringUtils.hasText(user.getFullName()) && StringUtils.hasText(fullName)) {
            user.setFullName(fullName);
            changed = true;
        }

        if (verified && !user.isVerified()) {
            user.setVerified(true);
            changed = true;
        }

        if (changed) {
            logger.info("Updating local account details from Firebase for email={}", user.getEmail());
        }
        return changed ? userRepository.save(user) : user;
    }

    private AuthResponse buildAuthResponse(User user) {
        String token = jwtUtil.generateToken(user);
        AuthResponse response = new AuthResponse(token, user.getEmail(), user.getFullName(), user.getRole(), user.getId());
        int totalHelpCount = Math.max(user.getTotalHelpCount(), user.getRequestsHelped());
        response.setPhone(user.getPhone());
        response.setPoints(user.getPoints());
        response.setRequestsHelped(Math.max(user.getRequestsHelped(), totalHelpCount));
        response.setRequestsCreated(user.getRequestsCreated());
        response.setRating(user.getRating());
        response.setVerified(user.isVerified());
        response.setVerificationLevel(user.getVerificationLevel().name());
        response.setLatitude(user.getLatitude());
        response.setLongitude(user.getLongitude());
        response.setAddress(user.getAddress());
        response.setVolunteer(user.isVolunteer());
        response.setVolunteerStatus(user.getVolunteerStatus());
        response.setVolunteerCategories(user.getVolunteerCategories());
        response.setTotalHelpCount(totalHelpCount);
        response.setBadges(VolunteerBadgeSupport.badgesFor(totalHelpCount));
        response.setBadge(VolunteerBadgeSupport.highestBadge(totalHelpCount));
        return response;
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private String resolveFullName(String requestedFullName, String tokenFullName, String email) {
        if (StringUtils.hasText(requestedFullName)) {
            return requestedFullName.trim();
        }
        if (StringUtils.hasText(tokenFullName)) {
            return tokenFullName.trim();
        }

        String localPart = email.split("@")[0];
        String[] parts = localPart.split("[._-]+");
        StringBuilder fullName = new StringBuilder();

        for (String part : parts) {
            if (!StringUtils.hasText(part)) {
                continue;
            }
            if (fullName.length() > 0) {
                fullName.append(' ');
            }
            fullName.append(Character.toUpperCase(part.charAt(0)));
            if (part.length() > 1) {
                fullName.append(part.substring(1));
            }
        }

        return fullName.length() > 0 ? fullName.toString() : "HVHN Member";
    }
}
