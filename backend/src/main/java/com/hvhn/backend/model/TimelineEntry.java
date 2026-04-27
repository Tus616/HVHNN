package com.hvhn.backend.model;

import java.time.LocalDateTime;

public class TimelineEntry {
    private String event; // e.g., REQUEST_RAISED, VOLUNTEER_ACCEPTED
    private LocalDateTime timestamp;
    private String actorName;
    private String actorId;
    private String comment;

    public TimelineEntry() {}

    public TimelineEntry(String event, String actorName, String actorId) {
        this.event = event;
        this.timestamp = LocalDateTime.now();
        this.actorName = actorName;
        this.actorId = actorId;
    }

    // Getters and Setters
    public String getEvent() { return event; }
    public void setEvent(String event) { this.event = event; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}
