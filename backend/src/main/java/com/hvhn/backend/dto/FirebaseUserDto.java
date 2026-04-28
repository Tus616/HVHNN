package com.hvhn.backend.dto;

public class FirebaseUserDto {
    private String email;
    private String name;
    private String uid;
    private boolean emailVerified;

    public FirebaseUserDto() {}

    public FirebaseUserDto(String email, String name, String uid, boolean emailVerified) {
        this.email = email;
        this.name = name;
        this.uid = uid;
        this.emailVerified = emailVerified;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getUid() {
        return uid;
    }

    public void setUid(String uid) {
        this.uid = uid;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
    }
}
