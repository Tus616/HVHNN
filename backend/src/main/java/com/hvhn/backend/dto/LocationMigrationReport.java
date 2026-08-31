package com.hvhn.backend.dto;

public class LocationMigrationReport {
    private long scanned;
    private long migrated;
    private long alreadyValid;
    private long invalid;
    private long skipped;
    private long ambiguous;
    private boolean dryRun;

    public long getScanned() { return scanned; }
    public void incrementScanned() { scanned++; }
    public long getMigrated() { return migrated; }
    public void incrementMigrated() { migrated++; }
    public long getAlreadyValid() { return alreadyValid; }
    public void incrementAlreadyValid() { alreadyValid++; }
    public long getInvalid() { return invalid; }
    public void incrementInvalid() { invalid++; }
    public long getSkipped() { return skipped; }
    public void incrementSkipped() { skipped++; }
    public long getAmbiguous() { return ambiguous; }
    public void incrementAmbiguous() { ambiguous++; }
    public boolean isDryRun() { return dryRun; }
    public void setDryRun(boolean dryRun) { this.dryRun = dryRun; }
}
