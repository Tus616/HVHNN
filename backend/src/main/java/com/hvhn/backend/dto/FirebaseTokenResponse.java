package com.hvhn.backend.dto;

public class FirebaseTokenResponse {

    private boolean valid;
    private String message;
    private String uid;
    private String email;
    private boolean emailVerified;

    public FirebaseTokenResponse() {
    }

    public FirebaseTokenResponse(boolean valid, String message, String uid, String email, boolean emailVerified) {
        this.valid = valid;
        this.message = message;
        this.uid = uid;
        this.email = email;
        this.emailVerified = emailVerified;
    }

    public boolean isValid() {
        return valid;
    }

    public void setValid(boolean valid) {
        this.valid = valid;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
    }
}
