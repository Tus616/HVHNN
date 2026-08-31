package com.hvhn.backend.dto;

public class OtpStatusResponse {

    private final String message;
    private final boolean verified;
    private final long retryAfterSeconds;
    private final long expiresInSeconds;

    public OtpStatusResponse(String message, boolean verified) {
        this(message, verified, 0, 0);
    }

    public OtpStatusResponse(String message, boolean verified, long retryAfterSeconds, long expiresInSeconds) {
        this.message = message;
        this.verified = verified;
        this.retryAfterSeconds = retryAfterSeconds;
        this.expiresInSeconds = expiresInSeconds;
    }

    public String getMessage() {
        return message;
    }

    public boolean isVerified() {
        return verified;
    }

    public long getRetryAfterSeconds() { return retryAfterSeconds; }

    public long getExpiresInSeconds() { return expiresInSeconds; }
}
