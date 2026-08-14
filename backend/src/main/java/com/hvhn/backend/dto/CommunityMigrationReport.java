package com.hvhn.backend.dto;

public class CommunityMigrationReport {
    private boolean dryRun;
    private long communitiesScanned;
    private long membershipsScanned;
    private long migrated;
    private long alreadyValid;
    private long repaired;
    private long invalid;
    private long duplicate;
    private long ambiguous;
    private long skipped;
    private long legacyCommunityRequests;

    public boolean isDryRun() { return dryRun; }
    public void setDryRun(boolean dryRun) { this.dryRun = dryRun; }
    public long getCommunitiesScanned() { return communitiesScanned; }
    public void incCommunitiesScanned() { communitiesScanned++; }
    public long getMembershipsScanned() { return membershipsScanned; }
    public void incMembershipsScanned() { membershipsScanned++; }
    public long getMigrated() { return migrated; }
    public void incMigrated() { migrated++; }
    public long getAlreadyValid() { return alreadyValid; }
    public void incAlreadyValid() { alreadyValid++; }
    public long getRepaired() { return repaired; }
    public void incRepaired() { repaired++; }
    public long getInvalid() { return invalid; }
    public void incInvalid() { invalid++; }
    public long getDuplicate() { return duplicate; }
    public void incDuplicate() { duplicate++; }
    public long getAmbiguous() { return ambiguous; }
    public void incAmbiguous() { ambiguous++; }
    public long getSkipped() { return skipped; }
    public void incSkipped() { skipped++; }
    public long getLegacyCommunityRequests() { return legacyCommunityRequests; }
    public void setLegacyCommunityRequests(long legacyCommunityRequests) { this.legacyCommunityRequests = legacyCommunityRequests; }
}
