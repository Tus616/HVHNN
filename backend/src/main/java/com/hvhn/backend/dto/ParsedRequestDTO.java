package com.hvhn.backend.dto;

import java.util.Map;

public class ParsedRequestDTO {
    private String category;
    private String urgency;
    private String location;
    private String timeConstraint;
    private String summary;
    private Map<String, Object> rawJson;

    public ParsedRequestDTO() {}

    public ParsedRequestDTO(String category, String urgency, String location, String timeConstraint, String summary) {
        this.category = category;
        this.urgency = urgency;
        this.location = location;
        this.timeConstraint = timeConstraint;
        this.summary = summary;
    }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getUrgency() { return urgency; }
    public void setUrgency(String urgency) { this.urgency = urgency; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getTimeConstraint() { return timeConstraint; }
    public void setTimeConstraint(String timeConstraint) { this.timeConstraint = timeConstraint; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public Map<String, Object> getRawJson() { return rawJson; }
    public void setRawJson(Map<String, Object> rawJson) { this.rawJson = rawJson; }
}
