package com.hvhn.backend.controller;

import com.hvhn.backend.dto.AuthRequest;
import com.hvhn.backend.dto.AuthResponse;
import com.hvhn.backend.dto.EmailOtpRequest;
import com.hvhn.backend.dto.FirebaseAuthRequest;
import com.hvhn.backend.dto.FirebaseTokenRequest;
import com.hvhn.backend.dto.FirebaseTokenResponse;
import com.hvhn.backend.dto.OtpStatusResponse;
import com.hvhn.backend.dto.RegisterVerifyRequest;
import com.hvhn.backend.dto.RegisterRequest;
import com.hvhn.backend.dto.VerifyOtpRequest;
import com.hvhn.backend.service.AuthService;
import com.hvhn.backend.service.EmailOtpService;
import com.hvhn.backend.service.FirebaseService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {

    private final AuthService authService;
    private final FirebaseService firebaseService;
    private final EmailOtpService emailOtpService;

    public AuthController(AuthService authService, FirebaseService firebaseService, EmailOtpService emailOtpService) {
        this.authService = authService;
        this.firebaseService = firebaseService;
        this.emailOtpService = emailOtpService;
    }

    @PostMapping("/api/auth/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/api/auth/register/request-otp")
    public ResponseEntity<OtpStatusResponse> requestRegistrationOtp(
            @Valid @RequestBody EmailOtpRequest request,
            HttpServletRequest servletRequest
    ) {
        return ResponseEntity.ok(emailOtpService.sendRegistrationOtp(
                request.getEmail(),
                servletRequest.getRemoteAddr(),
                servletRequest.getHeader("User-Agent")
        ));
    }

    @PostMapping("/api/auth/register/verify")
    public ResponseEntity<AuthResponse> verifyRegistration(@Valid @RequestBody RegisterVerifyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.verifyRegistration(request));
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/api/auth/send-otp")
    public ResponseEntity<OtpStatusResponse> sendOtp(
            @Valid @RequestBody EmailOtpRequest request,
            HttpServletRequest servletRequest
    ) {
        return requestRegistrationOtp(request, servletRequest);
    }

    @PostMapping("/api/auth/verify-otp")
    public ResponseEntity<OtpStatusResponse> verifyOtp(@Valid @RequestBody VerifyOtpRequest request) {
        return ResponseEntity.ok(emailOtpService.verifyOtp(request.getEmail(), request.getOtp()));
    }

    @PostMapping("/api/auth/firebase")
    public ResponseEntity<AuthResponse> loginWithFirebase(@Valid @RequestBody FirebaseAuthRequest request) {
        return ResponseEntity.ok(authService.loginWithFirebase(request));
    }

    @PostMapping({"/verifyToken", "/api/auth/verifyToken"})
    public ResponseEntity<FirebaseTokenResponse> verifyToken(
            @Valid @RequestBody FirebaseTokenRequest request
    ) {
        return ResponseEntity.ok(firebaseService.verifyIdToken(request.getIdToken()));
    }
}
