package com.hvhn.backend.dto;

public class RequestProgressUpdateRequest {
    private String action;
    private String status;

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
