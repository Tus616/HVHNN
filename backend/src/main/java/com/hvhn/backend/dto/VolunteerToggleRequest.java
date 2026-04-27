package com.hvhn.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class VolunteerToggleRequest {
    @JsonProperty("isVolunteer")
    private boolean isVolunteer;

    public boolean isVolunteer() { return isVolunteer; }
    public void setVolunteer(boolean volunteer) { isVolunteer = volunteer; }
}
