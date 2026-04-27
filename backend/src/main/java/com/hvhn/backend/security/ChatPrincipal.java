package com.hvhn.backend.security;

import java.security.Principal;

public class ChatPrincipal implements Principal {
    private final String userId;
    private final String email;
    private final String fullName;

    public ChatPrincipal(String userId, String email, String fullName) {
        this.userId = userId;
        this.email = email;
        this.fullName = fullName;
    }

    @Override
    public String getName() {
        return userId;
    }

    public String getUserId() {
        return userId;
    }

    public String getEmail() {
        return email;
    }

    public String getFullName() {
        return fullName;
    }
}
