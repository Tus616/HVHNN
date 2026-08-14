package com.hvhn.backend.dto;

public class MessagingMigrationReport {
    private long roomsScanned;
    private long participantKeysGenerated;
    private long duplicateRoomsReported;
    private long ambiguousRoomsReported;
    private long roomStatesCreated;
    private long stalePresenceRepaired;
    private boolean dryRun;

    public long getRoomsScanned() { return roomsScanned; }
    public void incrementRoomsScanned() { roomsScanned++; }

    public long getParticipantKeysGenerated() { return participantKeysGenerated; }
    public void incrementParticipantKeysGenerated() { participantKeysGenerated++; }

    public long getDuplicateRoomsReported() { return duplicateRoomsReported; }
    public void incrementDuplicateRoomsReported() { duplicateRoomsReported++; }

    public long getAmbiguousRoomsReported() { return ambiguousRoomsReported; }
    public void incrementAmbiguousRoomsReported() { ambiguousRoomsReported++; }

    public long getRoomStatesCreated() { return roomStatesCreated; }
    public void incrementRoomStatesCreated() { roomStatesCreated++; }

    public long getStalePresenceRepaired() { return stalePresenceRepaired; }
    public void incrementStalePresenceRepaired() { stalePresenceRepaired++; }

    public boolean isDryRun() { return dryRun; }
    public void setDryRun(boolean dryRun) { this.dryRun = dryRun; }
}
