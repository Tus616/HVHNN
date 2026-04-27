package com.hvhn.backend.dto;

public class DirectChatRoomRequest {
    private String participantId;
    private String participantEmail;

    public String getParticipantId() { return participantId; }
    public void setParticipantId(String participantId) { this.participantId = participantId; }

    public String getParticipantEmail() { return participantEmail; }
    public void setParticipantEmail(String participantEmail) { this.participantEmail = participantEmail; }
}
