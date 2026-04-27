package com.hvhn.backend.model;

public class AvailabilityEntry {
    private String day; // MON, TUE, WED, THU, FRI, SAT, SUN
    private String startTime; // HH:mm
    private String endTime; // HH:mm
    private boolean enabled;

    public AvailabilityEntry() {}

    public AvailabilityEntry(String day, String startTime, String endTime, boolean enabled) {
        this.day = day;
        this.startTime = startTime;
        this.endTime = endTime;
        this.enabled = enabled;
    }

    public String getDay() { return day; }
    public void setDay(String day) { this.day = day; }

    public String getStartTime() { return startTime; }
    public void setStartTime(String startTime) { this.startTime = startTime; }

    public String getEndTime() { return endTime; }
    public void setEndTime(String endTime) { this.endTime = endTime; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
}
