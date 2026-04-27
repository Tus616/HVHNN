package com.hvhn.backend.dto;

public class OtpStatusResponse {

    private final String message;
    private final String otp;
    private final boolean verified;

    public OtpStatusResponse(String message, String otp, boolean verified) {
        this.message = message;
        this.otp = otp;
        this.verified = verified;
    }

    public String getMessage() {
        return message;
    }

    public String getOtp() {
        return otp;
    }

    public boolean isVerified() {
        return verified;
    }
}
