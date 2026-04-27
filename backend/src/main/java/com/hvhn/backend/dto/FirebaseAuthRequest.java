package com.hvhn.backend.dto;

import jakarta.validation.constraints.NotBlank;

public class FirebaseAuthRequest {

    @NotBlank(message = "Firebase ID token is required")
    private String idToken;

    private String fullName;

    public FirebaseAuthRequest() {
    }

    public FirebaseAuthRequest(String idToken, String fullName) {
        this.idToken = idToken;
        this.fullName = fullName;
    }

    public String getIdToken() {
        return idToken;
    }

    public void setIdToken(String idToken) {
        this.idToken = idToken;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }
}
