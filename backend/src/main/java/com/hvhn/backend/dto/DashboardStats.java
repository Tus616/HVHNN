package com.hvhn.backend.dto;

import java.util.Map;

public class DashboardStats {
    private long totalRequests;
    private long openRequests;
    private long completedRequests;
    private long totalUsers;
    private long totalVolunteers;
    private long totalCommunities;
    private Map<String, Long> requestsByCategory;
    private Map<String, Long> requestsByStatus;
    private double averageResponseTimeMinutes;

    public DashboardStats() {}

    public long getTotalRequests() { return totalRequests; }
    public void setTotalRequests(long totalRequests) { this.totalRequests = totalRequests; }
    public long getOpenRequests() { return openRequests; }
    public void setOpenRequests(long openRequests) { this.openRequests = openRequests; }
    public long getCompletedRequests() { return completedRequests; }
    public void setCompletedRequests(long completedRequests) { this.completedRequests = completedRequests; }
    public long getTotalUsers() { return totalUsers; }
    public void setTotalUsers(long totalUsers) { this.totalUsers = totalUsers; }
    public long getTotalVolunteers() { return totalVolunteers; }
    public void setTotalVolunteers(long totalVolunteers) { this.totalVolunteers = totalVolunteers; }
    public long getTotalCommunities() { return totalCommunities; }
    public void setTotalCommunities(long totalCommunities) { this.totalCommunities = totalCommunities; }
    public Map<String, Long> getRequestsByCategory() { return requestsByCategory; }
    public void setRequestsByCategory(Map<String, Long> requestsByCategory) { this.requestsByCategory = requestsByCategory; }
    public Map<String, Long> getRequestsByStatus() { return requestsByStatus; }
    public void setRequestsByStatus(Map<String, Long> requestsByStatus) { this.requestsByStatus = requestsByStatus; }
    public double getAverageResponseTimeMinutes() { return averageResponseTimeMinutes; }
    public void setAverageResponseTimeMinutes(double averageResponseTimeMinutes) { this.averageResponseTimeMinutes = averageResponseTimeMinutes; }

    private long flaggedRequests;
    public long getFlaggedRequests() { return flaggedRequests; }
    public void setFlaggedRequests(long flaggedRequests) { this.flaggedRequests = flaggedRequests; }
}
