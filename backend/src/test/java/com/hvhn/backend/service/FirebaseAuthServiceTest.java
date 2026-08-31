package com.hvhn.backend.service;

import com.hvhn.backend.dto.AuthResponse;
import com.hvhn.backend.dto.FirebaseAuthRequest;
import com.hvhn.backend.dto.FirebaseUserDto;
import com.hvhn.backend.exception.FirebaseAuthenticationException;
import com.hvhn.backend.model.User;
import com.hvhn.backend.repository.UserRepository;
import com.hvhn.backend.security.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FirebaseAuthServiceTest {

    private UserRepository userRepository;
    private PasswordEncoder passwordEncoder;
    private JwtUtil jwtUtil;
    private FirebaseTokenVerifier firebaseTokenVerifier;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtUtil = mock(JwtUtil.class);
        firebaseTokenVerifier = mock(FirebaseTokenVerifier.class);
        authService = new AuthService(userRepository, passwordEncoder, jwtUtil, firebaseTokenVerifier, mock(EmailOtpService.class));
        when(passwordEncoder.encode(anyString())).thenReturn("encoded");
        when(jwtUtil.generateToken(any(User.class))).thenReturn("hvhn.jwt");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void validMockedFirebaseIdentityCreatesLocalUserAndHvhnJwt() {
        when(firebaseTokenVerifier.verify("firebase-token"))
                .thenReturn(new FirebaseUserDto("NewUser@sahay.test", "New User", "firebase-uid-1", true));
        when(userRepository.findByFirebaseUid("firebase-uid-1")).thenReturn(Optional.empty());
        when(userRepository.findByNormalizedEmail("newuser@sahay.test")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("newuser@sahay.test")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId("local-1");
            return user;
        });

        AuthResponse response = authService.loginWithFirebase(new FirebaseAuthRequest("firebase-token", null));

        assertThat(response.getToken()).isEqualTo("hvhn.jwt");
        assertThat(response.getEmail()).isEqualTo("newuser@sahay.test");
        assertThat(response.isOnboardingCompleted()).isFalse();
        verify(jwtUtil).generateToken(any(User.class));
    }

    @Test
    void reusingSameFirebaseUidReturnsSameLocalUser() {
        User existing = firebaseUser("local-1", "reuse@hvhn.test", "firebase-uid-1");
        existing.setOnboardingCompleted(true);
        when(firebaseTokenVerifier.verify("firebase-token"))
                .thenReturn(new FirebaseUserDto("reuse@hvhn.test", "Reuse User", "firebase-uid-1", true));
        when(userRepository.findByFirebaseUid("firebase-uid-1")).thenReturn(Optional.of(existing));

        AuthResponse response = authService.loginWithFirebase(new FirebaseAuthRequest("firebase-token", null));

        assertThat(response.getUserId()).isEqualTo("local-1");
        assertThat(response.isOnboardingCompleted()).isTrue();
        verify(userRepository, never()).findByNormalizedEmail("reuse@hvhn.test");
    }

    @Test
    void existingSameEmailAccountIsLinkedSafelyWhenNoFirebaseUidExists() {
        User existing = passwordUser("local-2", "link@hvhn.test");
        when(firebaseTokenVerifier.verify("firebase-token"))
                .thenReturn(new FirebaseUserDto("link@hvhn.test", "Linked User", "firebase-uid-2", true));
        when(userRepository.findByFirebaseUid("firebase-uid-2")).thenReturn(Optional.empty());
        when(userRepository.findByNormalizedEmail("link@hvhn.test")).thenReturn(Optional.of(existing));
        AuthResponse response = authService.loginWithFirebase(new FirebaseAuthRequest("firebase-token", null));

        assertThat(response.getUserId()).isEqualTo("local-2");
        assertThat(existing.getFirebaseUid()).isEqualTo("firebase-uid-2");
        assertThat(existing.getAuthProvider()).isEqualTo("LINKED");
    }

    @Test
    void firebaseIdentityCannotHijackDifferentUidAccount() {
        User existing = firebaseUser("local-3", "target@hvhn.test", "existing-uid");
        when(firebaseTokenVerifier.verify("firebase-token"))
                .thenReturn(new FirebaseUserDto("target@hvhn.test", "Attacker", "other-uid", true));
        when(userRepository.findByFirebaseUid("other-uid")).thenReturn(Optional.empty());
        when(userRepository.findByNormalizedEmail("target@hvhn.test")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> authService.loginWithFirebase(new FirebaseAuthRequest("firebase-token", null)))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void invalidFirebaseTokenReturnsAuthenticationFailure() {
        when(firebaseTokenVerifier.verify("bad-token"))
                .thenThrow(new FirebaseAuthenticationException("Firebase ID token is invalid."));

        assertThatThrownBy(() -> authService.loginWithFirebase(new FirebaseAuthRequest("bad-token", null)))
                .isInstanceOf(FirebaseAuthenticationException.class);
    }

    @Test
    void verifierFailureIsSanitizedServiceFailure() {
        when(firebaseTokenVerifier.verify("down-token"))
                .thenThrow(new IllegalStateException("Firebase authentication service is unavailable"));

        assertThatThrownBy(() -> authService.loginWithFirebase(new FirebaseAuthRequest("down-token", null)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Firebase authentication service is unavailable");
    }

    private User firebaseUser(String id, String email, String uid) {
        User user = passwordUser(id, email);
        user.setFirebaseUid(uid);
        user.setAuthProvider("FIREBASE");
        return user;
    }

    private User passwordUser(String id, String email) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setNormalizedEmail(email);
        user.setPassword("encoded");
        user.setFullName("Existing User");
        user.setAuthProvider("PASSWORD");
        return user;
    }
}
