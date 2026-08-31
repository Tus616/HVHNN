package com.hvhn.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "email_otp_challenges")
@CompoundIndex(name = "email_purpose_active_idx", def = "{'normalizedEmail': 1, 'purpose': 1, 'consumed': 1}")
public class EmailOtpChallenge {
    @Transient
    public static final String PURPOSE_REGISTRATION = "REGISTRATION";

    @Id
    private String id;

    @Indexed
    private String normalizedEmail;

    private String otpHash;
    private String purpose = PURPOSE_REGISTRATION;
    private Instant createdAt;
    private Instant expiresAt;
    private Instant verifiedAt;
    private boolean consumed;
    private int failedAttempts;
    private int resendCount;
    private Instant lastSentAt;
    private String requestIp;
    private String userAgent;

    @Indexed(expireAfterSeconds = 0)
    private Instant deleteAfter;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getNormalizedEmail() { return normalizedEmail; }
    public void setNormalizedEmail(String normalizedEmail) { this.normalizedEmail = normalizedEmail; }
    public String getOtpHash() { return otpHash; }
    public void setOtpHash(String otpHash) { this.otpHash = otpHash; }
    public String getPurpose() { return purpose; }
    public void setPurpose(String purpose) { this.purpose = purpose; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(Instant verifiedAt) { this.verifiedAt = verifiedAt; }
    public boolean isConsumed() { return consumed; }
    public void setConsumed(boolean consumed) { this.consumed = consumed; }
    public int getFailedAttempts() { return failedAttempts; }
    public void setFailedAttempts(int failedAttempts) { this.failedAttempts = failedAttempts; }
    public int getResendCount() { return resendCount; }
    public void setResendCount(int resendCount) { this.resendCount = resendCount; }
    public Instant getLastSentAt() { return lastSentAt; }
    public void setLastSentAt(Instant lastSentAt) { this.lastSentAt = lastSentAt; }
    public String getRequestIp() { return requestIp; }
    public void setRequestIp(String requestIp) { this.requestIp = requestIp; }
    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }
    public Instant getDeleteAfter() { return deleteAfter; }
    public void setDeleteAfter(Instant deleteAfter) { this.deleteAfter = deleteAfter; }
}
