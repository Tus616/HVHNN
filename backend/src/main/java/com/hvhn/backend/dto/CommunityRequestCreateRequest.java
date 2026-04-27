package com.hvhn.backend.dto;

import com.hvhn.backend.model.enums.RequestUrgency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CommunityRequestCreateRequest {
    @NotBlank(message = "Request title is required")
    private String title;

    @NotBlank(message = "Request description is required")
    private String description;

    @NotBlank(message = "Request location is required")
    private String location;

    @NotNull(message = "Request urgency is required")
    private RequestUrgency urgency;

    public CommunityRequestCreateRequest() {}

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public RequestUrgency getUrgency() { return urgency; }
    public void setUrgency(RequestUrgency urgency) { this.urgency = urgency; }
}
