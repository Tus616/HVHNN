package com.hvhn.backend.model;

import java.time.LocalDateTime;

public class TimelineEntry {
    private String event; // e.g., REQUEST_RAISED, VOLUNTEER_ACCEPTED
    private LocalDateTime timestamp;
    private String actorName;
    private String actorId;
    private String actorRole;
    private String previousStatus;
    private String newStatus;
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

    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }

    public String getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(String previousStatus) { this.previousStatus = previousStatus; }

    public String getNewStatus() { return newStatus; }
    public void setNewStatus(String newStatus) { this.newStatus = newStatus; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
}
