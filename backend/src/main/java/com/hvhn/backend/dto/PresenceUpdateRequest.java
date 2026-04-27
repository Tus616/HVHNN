package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.PresenceStatus;
import jakarta.validation.constraints.NotNull;

public class PresenceUpdateRequest {
    @NotNull(message = "Presence status is required")
    private PresenceStatus status;

    public PresenceStatus getStatus() { return status; }
    public void setStatus(PresenceStatus status) { this.status = status; }
}
