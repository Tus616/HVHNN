package com.hvhn.backend.service;

import com.hvhn.backend.dto.AuthRequest;
import com.hvhn.backend.dto.AuthResponse;
import com.hvhn.backend.dto.FirebaseAuthRequest;
import com.hvhn.backend.dto.FirebaseUserDto;
import com.hvhn.backend.dto.RegisterVerifyRequest;
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
import java.time.LocalDateTime;

@Service
public class AuthService {

    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final FirebaseTokenVerifier firebaseTokenVerifier;
    private final EmailOtpService emailOtpService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            FirebaseTokenVerifier firebaseTokenVerifier,
            EmailOtpService emailOtpService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.firebaseTokenVerifier = firebaseTokenVerifier;
        this.emailOtpService = emailOtpService;
    }

    public AuthResponse register(RegisterRequest request) {
        throw new IllegalArgumentException("Use /api/auth/register/verify to create an account after OTP verification.");
    }

    public AuthResponse verifyRegistration(RegisterVerifyRequest request) {
        String email = normalizeEmail(request.getEmail());
        emailOtpService.consumeRegistrationOtp(email, request.getOtp());

        if (userRepository.existsByNormalizedEmail(email) || userRepository.existsByEmail(email)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "An account with this email already exists."
            );
        }

        User user = new User();
        user.setEmail(email);
        user.setNormalizedEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFullName(trim(request.getFullName()));
        user.setPhone(trim(request.getPhone()));
        user.setVerified(true);
        user.setEmailVerified(true);
        user.setAuthProvider("PASSWORD");
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());

        return buildAuthResponse(userRepository.save(user));
    }

    public AuthResponse login(AuthRequest request) {
        String email = normalizeEmail(request.getEmail());

        User user = findByNormalizedEmail(email)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.UNAUTHORIZED,
                        "Invalid email or password."
                ));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNAUTHORIZED,
                    "Invalid email or password."
            );
        }

        return buildAuthResponse(normalizeExistingUser(user));
    }

    public AuthResponse loginWithFirebase(FirebaseAuthRequest request) {
        FirebaseUserDto decodedToken = firebaseTokenVerifier.verify(request.getIdToken());
        String email = normalizeEmail(decodedToken.getEmail());

        if (!StringUtils.hasText(email)) {
            throw new RuntimeException("The Firebase account does not have an email address");
        }

        String resolvedName = resolveFullName(request.getFullName(), decodedToken.getName(), email);
        boolean shouldMarkVerified = Boolean.TRUE.equals(decodedToken.isEmailVerified());

        User user = findFirebaseUser(decodedToken.getUid(), email)
                .map(existingUser -> updateFirebaseUser(existingUser, decodedToken.getUid(), resolvedName, shouldMarkVerified))
                .orElseGet(() -> createFirebaseUser(email, decodedToken.getUid(), resolvedName, shouldMarkVerified));

        logger.info(
                "Firebase login completed for email={}, uid={}, verifiedEmail={}",
                email,
                decodedToken.getUid(),
                shouldMarkVerified
        );

        return buildAuthResponse(user);
    }

    private User createFirebaseUser(String email, String firebaseUid, String fullName, boolean verified) {
        User user = new User();
        user.setEmail(email);
        user.setNormalizedEmail(email);
        user.setFirebaseUid(firebaseUid);
        user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setFullName(fullName);
        user.setVerified(verified);
        user.setEmailVerified(verified);
        user.setAuthProvider("FIREBASE");
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        logger.info("Creating new local account for Firebase user email={}", email);
        return userRepository.save(user);
    }

    private User updateFirebaseUser(User user, String firebaseUid, String fullName, boolean verified) {
        boolean changed = false;
        normalizeUserIdentity(user);

        if (StringUtils.hasText(user.getFirebaseUid())
                && StringUtils.hasText(firebaseUid)
                && !user.getFirebaseUid().equals(firebaseUid)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.CONFLICT,
                    "This email is already linked to another Firebase account."
            );
        }

        if (!StringUtils.hasText(user.getFirebaseUid()) && StringUtils.hasText(firebaseUid)) {
            user.setFirebaseUid(firebaseUid);
            changed = true;
        }

        if (!StringUtils.hasText(user.getFullName()) && StringUtils.hasText(fullName)) {
            user.setFullName(fullName);
            changed = true;
        }

        if (verified && !user.isVerified()) {
            user.setVerified(true);
            user.setEmailVerified(true);
            changed = true;
        }

        if (!"FIREBASE".equalsIgnoreCase(user.getAuthProvider())) {
            user.setAuthProvider("LINKED");
            changed = true;
        }

        if (changed) {
            user.setUpdatedAt(LocalDateTime.now());
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
        response.setOnboardingCompleted(user.isOnboardingCompleted());
        response.setAuthProvider(user.getAuthProvider());
        response.setProfileImage(user.getProfileImage());
        response.setBio(user.getBio());
        response.setCity(user.getCity());
        response.setDistrict(user.getDistrict());
        response.setState(user.getState());
        response.setPostalCode(user.getPostalCode());
        response.setTotalHelpCount(totalHelpCount);
        response.setBadges(VolunteerBadgeSupport.badgesFor(totalHelpCount));
        response.setBadge(VolunteerBadgeSupport.highestBadge(totalHelpCount));
        return response;
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private java.util.Optional<User> findByNormalizedEmail(String email) {
        return userRepository.findByNormalizedEmail(email)
                .or(() -> userRepository.findByEmail(email));
    }

    private java.util.Optional<User> findFirebaseUser(String uid, String email) {
        if (StringUtils.hasText(uid)) {
            java.util.Optional<User> byUid = userRepository.findByFirebaseUid(uid);
            if (byUid.isPresent()) return byUid;
        }
        return findByNormalizedEmail(email);
    }

    private User normalizeExistingUser(User user) {
        if (normalizeUserIdentity(user)) {
            user.setUpdatedAt(LocalDateTime.now());
            return userRepository.save(user);
        }
        return user;
    }

    private boolean normalizeUserIdentity(User user) {
        boolean changed = false;
        String normalizedEmail = normalizeEmail(user.getEmail());
        if (StringUtils.hasText(normalizedEmail) && !normalizedEmail.equals(user.getNormalizedEmail())) {
            user.setNormalizedEmail(normalizedEmail);
            user.setEmail(normalizedEmail);
            changed = true;
        }
        if (!StringUtils.hasText(user.getAuthProvider())) {
            user.setAuthProvider(StringUtils.hasText(user.getFirebaseUid()) ? "FIREBASE" : "PASSWORD");
            changed = true;
        }
        if (user.isVerified() && !user.isEmailVerified()) {
            user.setEmailVerified(true);
            changed = true;
        }
        return changed;
    }

    private String trim(String value) {
        return StringUtils.hasText(value) ? value.trim() : value;
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

        return fullName.length() > 0 ? fullName.toString() : "Sahay Member";
    }
}
