package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.RequestStatus;

public class CommunityRequestUpdateRequest {
    private String description;
    private RequestStatus status;

    public CommunityRequestUpdateRequest() {}

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public RequestStatus getStatus() { return status; }
    public void setStatus(RequestStatus status) { this.status = status; }
}
